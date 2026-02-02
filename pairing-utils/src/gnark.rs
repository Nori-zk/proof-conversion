//! gnark format conversions for Groth16 proofs.
//!
//! This module provides functions to decompress gnark-formatted Groth16 proofs
//! and verification keys into arkworks format.
//!
//! The decompression functions are adapted from:
//! - https://github.com/anza-xyz/agave/blob/c54d840/curves/bn254/src/compression.rs
//! - https://github.com/SoundnessLabs/sp1-sui/blob/15d84fd/verifier/src/ark_converter.rs

use ark_bn254::{Bn254, G1Affine, G2Affine};
use ark_ec::AffineRepr;
use ark_groth16::{Proof, VerifyingKey};
use ark_serialize::{CanonicalDeserialize, Compress, Validate};
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
    #[error("Invalid proof length")]
    InvalidProofLength,
    #[error("Invalid verification key length")]
    InvalidVKLength,
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    JsonError(#[from] serde_json::Error),
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
pub const GROTH16_VK_5_0_0_BYTES: &[u8] = include_bytes!("../sp1_v5_groth16_vk.bin");

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
pub fn decompress_g1(g1_bytes: &[u8; 32]) -> Result<G1Affine, ConversionError> {
    let g1_bytes = gnark_compressed_x_to_ark_compressed_x(g1_bytes)?;
    let g1_bytes: &[u8; 32] = g1_bytes.as_slice().try_into()
        .map_err(|_| ConversionError::G1CompressionError)?;
    let g1_bytes = convert_endianness::<32, 32>(g1_bytes);
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
pub fn decompress_g2(g2_bytes: &[u8; 64]) -> Result<G2Affine, ConversionError> {
    let g2_bytes = gnark_compressed_x_to_ark_compressed_x(g2_bytes)?;
    let g2_bytes: &[u8; 64] = g2_bytes.as_slice().try_into()
        .map_err(|_| ConversionError::G2CompressionError)?;
    let g2_bytes = convert_endianness::<64, 64>(g2_bytes);
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
pub fn load_ark_proof_from_bytes(buffer: &[u8]) -> Result<Proof<Bn254>, ConversionError> {
    let a_bytes: &[u8; 64] = buffer.get(..64)
        .and_then(|s| s.try_into().ok())
        .ok_or(ConversionError::InvalidProofLength)?;
    let b_bytes: &[u8; 128] = buffer.get(64..192)
        .and_then(|s| s.try_into().ok())
        .ok_or(ConversionError::InvalidProofLength)?;
    let c_bytes: &[u8; 64] = buffer.get(192..256)
        .and_then(|s| s.try_into().ok())
        .ok_or(ConversionError::InvalidProofLength)?;

    Ok(Proof::<Bn254> {
        a: gnark_decompressed_g1_to_ark_decompressed_g1(a_bytes)?,
        b: gnark_decompressed_g2_to_ark_decompressed_g2(b_bytes)?,
        c: gnark_decompressed_g1_to_ark_decompressed_g1(c_bytes)?,
    })
}

/// Load Groth16 verification key from gnark format bytes
///
/// Taken from https://github.com/SoundnessLabs/sp1-sui/blob/15d84fd/verifier/src/ark_converter.rs#L156-L201
pub fn load_ark_groth16_verifying_key_from_bytes(
    buffer: &[u8],
) -> Result<VerifyingKey<Bn254>, ConversionError> {
    let alpha_bytes: &[u8; 32] = buffer.get(..32)
        .and_then(|s| s.try_into().ok())
        .ok_or(ConversionError::InvalidVKLength)?;
    let beta_bytes: &[u8; 64] = buffer.get(64..128)
        .and_then(|s| s.try_into().ok())
        .ok_or(ConversionError::InvalidVKLength)?;
    let gamma_bytes: &[u8; 64] = buffer.get(128..192)
        .and_then(|s| s.try_into().ok())
        .ok_or(ConversionError::InvalidVKLength)?;
    let delta_bytes: &[u8; 64] = buffer.get(224..288)
        .and_then(|s| s.try_into().ok())
        .ok_or(ConversionError::InvalidVKLength)?;

    let alpha_g1 = decompress_g1(alpha_bytes)?;
    let beta_g2 = decompress_g2(beta_bytes)?;
    let gamma_g2 = decompress_g2(gamma_bytes)?;
    let delta_g2 = decompress_g2(delta_bytes)?;

    let num_k_bytes = buffer.get(288..292)
        .ok_or(ConversionError::InvalidVKLength)?;
    let num_k = u32::from_be_bytes([num_k_bytes[0], num_k_bytes[1], num_k_bytes[2], num_k_bytes[3]]);
    let mut k = Vec::new();
    let mut offset = 292;
    for _ in 0..num_k {
        let point_bytes: &[u8; 32] = buffer.get(offset..offset + 32)
            .and_then(|s| s.try_into().ok())
            .ok_or(ConversionError::InvalidVKLength)?;
        let point = decompress_g1(point_bytes)?;
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
