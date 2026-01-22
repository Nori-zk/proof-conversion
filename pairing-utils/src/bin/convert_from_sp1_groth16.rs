//! ## Usage
//!
//! ```bash
//! cargo run --bin convert_from_sp1_groth16 --features sp1-bin -- <sp1_proof.bin> <output_proof.json> <output_vk.json>
//! ```
//!
//! ## Arguments
//! - `sp1_proof.bin`: SP1 binary file containing gnark Groth16 proof
//! - `output_proof.json`: output o1js-blobstream format proof file
//! - `output_vk.json`: output o1js-blobstream format verification key file

use ark_bn254::{Bn254, Fq, Fq12, Fr, G1Affine, G2Affine};
use ark_ec::pairing::Pairing;
use ark_ec::AffineRepr;
use ark_ff::PrimeField;
use ark_groth16::{Proof, VerifyingKey};
use ark_serialize::{CanonicalDeserialize, Compress, Validate};
use ark_snark::SNARK;
use num_bigint::BigUint;
use num_traits::Num;
use serde::Serialize;
use serde_json;
use sp1_sdk::SP1ProofWithPublicValues;
use std::collections::HashMap;
use std::env;
use std::fs;
use thiserror::Error;

// ============= Error Types =============
#[derive(Error, Debug)]
pub enum ConversionError {
    #[error("G1 compression error")]
    G1CompressionError,
    #[error("G2 compression error")]
    G2CompressionError,
    #[error("Invalid input")]
    InvalidInput,
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
    #[error("SP1 SDK error: {0}")]
    SP1Error(String),
}

// ============= Constants =============
pub const GNARK_MASK: u8 = 0b11 << 6;
pub const GNARK_COMPRESSED_POSITIVE: u8 = 0b10 << 6;
pub const GNARK_COMPRESSED_NEGATIVE: u8 = 0b11 << 6;
pub const GNARK_COMPRESSED_INFINITY: u8 = 0b01 << 6;

pub const ARK_MASK: u8 = 0b11 << 6;
pub const ARK_COMPRESSED_POSITIVE: u8 = 0b00 << 6;
pub const ARK_COMPRESSED_NEGATIVE: u8 = 0b10 << 6;
pub const ARK_COMPRESSED_INFINITY: u8 = 0b01 << 6;

// SP1 v5 Groth16 VK embedded
pub const GROTH16_VK_5_0_0_BYTES: &[u8] = include_bytes!("../../sp1_v5_groth16_vk.bin");

// ============= Output Types =============
#[derive(Serialize, Debug)]
struct O1jsProof {
    #[serde(rename = "negA")]
    neg_a: G1Point,
    #[serde(rename = "B")]
    b: G2Point,
    #[serde(rename = "C")]
    c: G1Point,
    #[serde(flatten)]
    public_inputs: HashMap<String, String>,
}

#[derive(Serialize, Debug)]
struct G1Point {
    x: String,
    y: String,
}

#[derive(Serialize, Debug)]
struct G2Point {
    x_c0: String,
    x_c1: String,
    y_c0: String,
    y_c1: String,
}

#[derive(Serialize, Debug)]
struct Fp12Element {
    g00: String,
    g01: String,
    g10: String,
    g11: String,
    g20: String,
    g21: String,
    h00: String,
    h01: String,
    h10: String,
    h11: String,
    h20: String,
    h21: String,
}

#[derive(Serialize, Debug)]
struct O1jsVK {
    alpha: G1Point,
    beta: G2Point,
    gamma: G2Point,
    delta: G2Point,
    alpha_beta: Fp12Element,
    w27: Fp12Element,
    #[serde(flatten)]
    ic_points: HashMap<String, G1Point>,
}

// ============= Conversion Functions =============

/// Convert endianness of a byte array, chunk by chunk
///
/// Taken from https://github.com/anza-xyz/agave/blob/c54d840/curves/bn254/src/compression.rs#L176-L189
fn convert_endianness<const CHUNK_SIZE: usize, const ARRAY_SIZE: usize>(
    bytes: &[u8; ARRAY_SIZE],
) -> [u8; ARRAY_SIZE] {
    let reversed: [_; ARRAY_SIZE] = bytes
        .chunks_exact(CHUNK_SIZE)
        .flat_map(|chunk| chunk.iter().rev().copied())
        .enumerate()
        .fold([0u8; ARRAY_SIZE], |mut acc, (i, v)| {
            acc[i] = v;
            acc
        });
    reversed
}

/// Taken from https://github.com/SoundnessLabs/sp1-sui/blob/15d84fd/verifier/src/ark_converter.rs#L79-L92
fn gnark_flag_to_ark_flag(msb: u8) -> Result<u8, ConversionError> {
    let gnark_flag = msb & GNARK_MASK;

    let ark_flag = match gnark_flag {
        GNARK_COMPRESSED_POSITIVE => ARK_COMPRESSED_POSITIVE,
        GNARK_COMPRESSED_NEGATIVE => ARK_COMPRESSED_NEGATIVE,
        GNARK_COMPRESSED_INFINITY => ARK_COMPRESSED_INFINITY,
        _ => return Err(ConversionError::InvalidInput),
    };

    Ok(msb & !ARK_MASK | ark_flag)
}

/// Taken from https://github.com/SoundnessLabs/sp1-sui/blob/15d84fd/verifier/src/ark_converter.rs#L95-L106
fn gnark_compressed_x_to_ark_compressed_x(x: &[u8]) -> Result<Vec<u8>, ConversionError> {
    if x.len() != 32 && x.len() != 64 {
        return Err(ConversionError::InvalidInput);
    }
    let mut x_copy = x.to_owned();

    let msb = gnark_flag_to_ark_flag(x_copy[0])?;
    x_copy[0] = msb;

    x_copy.reverse();
    Ok(x_copy)
}

/// Decompress a G1 point from gnark format.
///
/// Taken from https://github.com/anza-xyz/agave/blob/c54d840/curves/bn254/src/compression.rs#L219-L234
fn decompress_g1(g1_bytes: &[u8; 32]) -> Result<G1Affine, ConversionError> {
    let g1_bytes = gnark_compressed_x_to_ark_compressed_x(g1_bytes)?;
    let g1_bytes = convert_endianness::<32, 32>(&g1_bytes.as_slice().try_into().unwrap());
    let decompressed_g1 = G1Affine::deserialize_with_mode(
        convert_endianness::<32, 32>(&g1_bytes).as_slice(),
        Compress::Yes,
        Validate::No,
    )
    .map_err(|_| ConversionError::G1CompressionError)?;
    Ok(decompressed_g1)
}

/// Decompress a G2 point from gnark format.
///
/// Adapted from https://github.com/anza-xyz/agave/blob/c54d840/curves/bn254/src/compression.rs#L255
fn decompress_g2(g2_bytes: &[u8; 64]) -> Result<G2Affine, ConversionError> {
    let g2_bytes = gnark_compressed_x_to_ark_compressed_x(g2_bytes)?;
    let g2_bytes = convert_endianness::<64, 64>(&g2_bytes.as_slice().try_into().unwrap());
    let decompressed_g2 = G2Affine::deserialize_with_mode(
        convert_endianness::<64, 64>(&g2_bytes).as_slice(),
        Compress::Yes,
        Validate::No,
    )
    .map_err(|_| ConversionError::G2CompressionError)?;
    Ok(decompressed_g2)
}

/// Deserialize a gnark decompressed G1 point to arkworks
/// 
/// Taken from https://github.com/SoundnessLabs/sp1-sui/blob/15d84fd/verifier/src/ark_converter.rs#L95-L125
fn gnark_decompressed_g1_to_ark_decompressed_g1(
    buf: &[u8; 64],
) -> Result<G1Affine, ConversionError> {
    let buf = convert_endianness::<32, 64>(buf);
    if buf == [0u8; 64] {
        return Ok(G1Affine::zero());
    }
    let g1 = G1Affine::deserialize_with_mode(
        &*[&buf[..], &[0u8][..]].concat(),
        Compress::No,
        Validate::Yes,
    )
    .map_err(|_| ConversionError::G1CompressionError)?;
    Ok(g1)
}

/// Deserialize a gnark decompressed G2 point to arkworks
/// 
/// Taken from https://github.com/SoundnessLabs/sp1-sui/blob/15d84fd/verifier/src/ark_converter.rs#L128-L142
fn gnark_decompressed_g2_to_ark_decompressed_g2(
    buf: &[u8; 128],
) -> Result<G2Affine, ConversionError> {
    let buf = convert_endianness::<64, 128>(buf);
    if buf == [0u8; 128] {
        return Ok(G2Affine::zero());
    }
    let g2 = G2Affine::deserialize_with_mode(
        &*[&buf[..], &[0u8][..]].concat(),
        Compress::No,
        Validate::Yes,
    )
    .map_err(|_| ConversionError::G2CompressionError)?;
    Ok(g2)
}

/// Load Groth16 proof from gnark format bytes
/// 
/// Taken from https://github.com/SoundnessLabs/sp1-sui/blob/15d84fd/verifier/src/ark_converter.rs#L146-L152
fn load_ark_proof_from_bytes(buffer: &[u8]) -> Result<Proof<Bn254>, ConversionError> {
    Ok(Proof::<Bn254> {
        a: gnark_decompressed_g1_to_ark_decompressed_g1(buffer[..64].try_into().unwrap())?,
        b: gnark_decompressed_g2_to_ark_decompressed_g2(buffer[64..192].try_into().unwrap())?,
        c: gnark_decompressed_g1_to_ark_decompressed_g1(&buffer[192..256].try_into().unwrap())?,
    })
}

/// Load Groth16 verification key from gnark format bytes
/// 
/// Taken from https://github.com/SoundnessLabs/sp1-sui/blob/15d84fd/verifier/src/ark_converter.rs#L156-L201
fn load_ark_groth16_verifying_key_from_bytes(
    buffer: &[u8],
) -> Result<VerifyingKey<Bn254>, ConversionError> {
    let alpha_g1 = decompress_g1(buffer[..32].try_into().unwrap())?;
    let beta_g2 = decompress_g2(buffer[64..128].try_into().unwrap())?;
    let gamma_g2 = decompress_g2(buffer[128..192].try_into().unwrap())?;
    let delta_g2 = decompress_g2(buffer[224..288].try_into().unwrap())?;

    let num_k = u32::from_be_bytes([buffer[288], buffer[289], buffer[290], buffer[291]]);
    let mut k = Vec::new();
    let mut offset = 292;
    for _ in 0..num_k {
        let point = decompress_g1(&buffer[offset..offset + 32].try_into().unwrap())?;
        k.push(point);
        offset += 32;
    }

    Ok(VerifyingKey {
        alpha_g1,
        beta_g2,
        gamma_g2,
        delta_g2,
        gamma_abc_g1: k,
    })
}

fn convert_g1_to_o1js(point: &G1Affine) -> G1Point {
    G1Point {
        x: point.x.into_bigint().to_string(),
        y: point.y.into_bigint().to_string(),
    }
}

fn convert_g2_to_o1js(point: &G2Affine) -> G2Point {
    G2Point {
        x_c0: point.x.c0.into_bigint().to_string(),
        x_c1: point.x.c1.into_bigint().to_string(),
        y_c0: point.y.c0.into_bigint().to_string(),
        y_c1: point.y.c1.into_bigint().to_string(),
    }
}

fn serialize_fq12(f: Fq12) -> Fp12Element {
    fn to_string(fq: Fq) -> String {
        fq.into_bigint().to_string()
    }

    Fp12Element {
        g00: to_string(f.c0.c0.c0),
        g01: to_string(f.c0.c0.c1),
        g10: to_string(f.c0.c1.c0),
        g11: to_string(f.c0.c1.c1),
        g20: to_string(f.c0.c2.c0),
        g21: to_string(f.c0.c2.c1),
        h00: to_string(f.c1.c0.c0),
        h01: to_string(f.c1.c0.c1),
        h10: to_string(f.c1.c1.c0),
        h11: to_string(f.c1.c1.c1),
        h20: to_string(f.c1.c2.c0),
        h21: to_string(f.c1.c2.c1),
    }
}

fn compute_alpha_beta_pairing(alpha_g1: &G1Affine, beta_g2: &G2Affine) -> Fp12Element {
    let alpha_beta = Bn254::multi_miller_loop(&[*alpha_g1], &[*beta_g2]).0;
    serialize_fq12(alpha_beta)
}

// Hardcoded w27 (used for pairing optimizations)
// https://eprint.iacr.org/2024/640
fn create_default_w27() -> Fp12Element {
    Fp12Element {
        g00: "0".to_string(),
        g01: "0".to_string(),
        g10: "0".to_string(),
        g11: "0".to_string(),
        g20: "8204864362109909869166472767738877274689483185363591877943943203703805152849"
            .to_string(),
        g21: "17912368812864921115467448876996876278487602260484145953989158612875588124088"
            .to_string(),
        h00: "0".to_string(),
        h01: "0".to_string(),
        h10: "0".to_string(),
        h11: "0".to_string(),
        h20: "0".to_string(),
        h21: "0".to_string(),
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();

    if args.len() != 4 {
        eprintln!(
            "Usage: {} <sp1_proof.bin> <output_proof.json> <output_vk.json>",
            args[0]
        );
        eprintln!(
            "Example: {} proof.bin converted_proof.json converted_vk.json",
            args[0]
        );
        std::process::exit(1);
    }

    let proof_path = &args[1];
    let output_proof_path = &args[2];
    let output_vk_path = &args[3];

    println!("🔄 Loading SP1 proof from: {}", proof_path);

    // Load SP1 proof
    let sp1_proof_with_public_values = SP1ProofWithPublicValues::load(proof_path)
        .map_err(|e| ConversionError::SP1Error(e.to_string()))?;

    let proof_bytes = sp1_proof_with_public_values.bytes();

    let groth16_proof = sp1_proof_with_public_values
        .proof
        .try_as_groth_16()
        .ok_or_else(|| ConversionError::SP1Error("Failed to extract Groth16 proof".to_string()))?;

    println!(
        "📊 Public inputs found: {} inputs",
        groth16_proof.public_inputs.len()
    );

    // Parse all public inputs dynamically
    let mut ark_public_inputs = Vec::new();
    for input_str in &groth16_proof.public_inputs {
        let input_bigint = BigUint::from_str_radix(input_str, 10).unwrap();
        let input_bytes = input_bigint.to_bytes_be();

        // Pad to 32 bytes
        let mut padded_input = vec![0u8; 32usize.saturating_sub(input_bytes.len())];
        padded_input.extend_from_slice(&input_bytes);
        let padded_array: [u8; 32] = padded_input.try_into().unwrap();

        ark_public_inputs.push(Fr::from_be_bytes_mod_order(&padded_array));
    }

    println!("🔐 Converting gnark format to arkworks...");

    // Load arkworks proof from gnark bytes
    let ark_proof = load_ark_proof_from_bytes(&proof_bytes[4..])?;

    // Load arkworks VK for SP1 v5.0.0
    let ark_vk = load_ark_groth16_verifying_key_from_bytes(GROTH16_VK_5_0_0_BYTES)?;

    println!("✅ Verifying proof with arkworks...");

    // Verify the proof to ensure conversion is correct
    let ark_pvk = ark_groth16::prepare_verifying_key(&ark_vk);
    let verified = ark_groth16::Groth16::<Bn254>::verify_with_processed_vk(
        &ark_pvk,
        &ark_public_inputs,
        &ark_proof,
    )?;

    if !verified {
        eprintln!("❌ Proof verification failed!");
        std::process::exit(1);
    }

    println!("✅ Proof verified successfully with arkworks!");
    println!("🔄 Converting to o1js-blobstream format...");

    // Convert proof to the expected format
    // We negate A for o1js-blobstream compatibility
    let neg_a = -ark_proof.a;

    // Create dynamic public inputs map
    let mut public_inputs_map = HashMap::new();
    for (i, input_str) in groth16_proof.public_inputs.iter().enumerate() {
        let key = format!("pi{}", i + 1);
        public_inputs_map.insert(key, input_str.clone());
    }

    let o1js_proof = O1jsProof {
        neg_a: convert_g1_to_o1js(&neg_a),
        b: convert_g2_to_o1js(&ark_proof.b),
        c: convert_g1_to_o1js(&ark_proof.c),
        public_inputs: public_inputs_map,
    };

    // Create dynamic IC points map
    let mut ic_points_map = HashMap::new();
    for (i, ic_point) in ark_vk.gamma_abc_g1.iter().enumerate() {
        let key = format!("ic{}", i);
        let point = convert_g1_to_o1js(ic_point);
        ic_points_map.insert(key, point);
    }

    // Convert VK to o1js-blobstream format
    let o1js_vk = O1jsVK {
        alpha: convert_g1_to_o1js(&ark_vk.alpha_g1),
        beta: convert_g2_to_o1js(&ark_vk.beta_g2),
        gamma: convert_g2_to_o1js(&ark_vk.gamma_g2),
        delta: convert_g2_to_o1js(&ark_vk.delta_g2),
        alpha_beta: compute_alpha_beta_pairing(&ark_vk.alpha_g1, &ark_vk.beta_g2),
        w27: create_default_w27(),
        ic_points: ic_points_map,
    };

    // Write outputs
    let proof_json = serde_json::to_string_pretty(&o1js_proof)?;
    let vk_json = serde_json::to_string_pretty(&o1js_vk)?;

    fs::write(output_proof_path, proof_json)?;
    fs::write(output_vk_path, vk_json)?;

    println!("✅ Successfully converted SP1 Groth16 proof to o1js-blobstream format!");
    println!("📁 Output proof: {}", output_proof_path);
    println!("📁 Output VK: {}", output_vk_path);
    println!("🔧 Applied negation to point A for o1js compatibility");
    println!("🔧 Computed alpha-beta pairing using arkworks");
    println!(
        "🔧 Converted {} public inputs to pi1-pi{} format",
        groth16_proof.public_inputs.len(),
        groth16_proof.public_inputs.len()
    );
    println!(
        "🔧 Converted {} IC points to ic0-ic{} format",
        ark_vk.gamma_abc_g1.len(),
        ark_vk.gamma_abc_g1.len() - 1
    );
    println!("🔧 Using SP1 v5.0.0 verification key");

    Ok(())
}
