//! This tool converts Groth16 proofs and verification keys from snarkjs format to the
//! o1js-blobstream format used by the "proof conversion" system.
//!
//! ## Usage
//!
//! ```bash
//! cargo run --bin convert_from_snarkjs <proof.json> <public.json> <vk.json> <output_proof.json> <output_vk.json>
//! ```
//!
//! ## Arguments
//!
//! - `proof.json`: snarkjs proof file
//! - `public.json`: public inputs file
//! - `vk.json`: snarkjs verification key file
//! - `output_proof.json`: output o1js-blobstream format proof file
//! - `output_vk.json`: output o1js-blobstream format verification key file

//! ## What it does
//!
//! 1. **Proof conversion**: Converts snarkjs proof format to o1js-blobstream format
//!    - Negates pi_a using arkworks for proper G1 point negation
//!    - Converts pi_b to G2 format
//!    - Converts pi_c to G1 format
//!    - Maps public inputs to pi1-pi5 fields
//!
//! 2. **Verification key conversion**: Converts snarkjs VK to o1js-blobstream format
//!    - Converts alpha, beta, gamma, delta points to named fields
//!    - Computes alpha-beta pairing `e(α, β) ∈ Fp12` using arkworks `multi_miller_loop`
//!    - Adds hardcoded w27 for pairing optimizations
//!    - Maps IC points to ic0-ic5 format
//!
//! ## Input format requirements
//!
//! - VK nPublic must match the number of public inputs
//! - VK IC points must equal public inputs + 1 (for the constant)
//! - Works with circuits that have exactly 5 public inputs (due to Risc0 pi computation in o1js-blobstream format)
//! - All files must be valid JSON

use ark_bn254::{Bn254, Fq, Fq12, Fq2, G1Affine, G2Affine};
use ark_ec::pairing::Pairing;
use ark_ec::AffineRepr;
use ark_ff::{PrimeField, Zero};
use num_bigint::BigUint;
use serde::{Deserialize, Serialize};
use serde_json;
use std::env;
use std::fs;
use std::str::FromStr;

#[derive(Deserialize, Debug)]
struct SnarkjsProof {
    pi_a: Vec<String>,
    pi_b: Vec<Vec<String>>,
    pi_c: Vec<String>,
}

#[derive(Deserialize, Debug)]
struct SnarkjsVK {
    #[serde(rename = "nPublic")]
    n_public: usize,
    vk_alpha_1: Vec<String>,
    vk_beta_2: Vec<Vec<String>>,
    vk_gamma_2: Vec<Vec<String>>,
    vk_delta_2: Vec<Vec<String>>,
    #[serde(rename = "IC")]
    ic: Vec<Vec<String>>,
}

#[derive(Serialize, Debug)]
struct O1jsProof {
    #[serde(rename = "negA")]
    neg_a: G1Point,
    #[serde(rename = "B")]
    b: G2Point,
    #[serde(rename = "C")]
    c: G1Point,
    pi1: String,
    pi2: String,
    pi3: String,
    pi4: String,
    pi5: String,
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
    ic0: G1Point,
    ic1: G1Point,
    ic2: G1Point,
    ic3: G1Point,
    ic4: G1Point,
    ic5: G1Point,
}

fn negate_g1_point(point: &[String]) -> G1Point {
    let x_val = BigUint::parse_bytes(point[0].as_bytes(), 10).unwrap();
    let y_val = BigUint::parse_bytes(point[1].as_bytes(), 10).unwrap();

    let x_fq = Fq::from_str(&x_val.to_str_radix(10)).unwrap();
    let y_fq = Fq::from_str(&y_val.to_str_radix(10)).unwrap();

    let g1_point = G1Affine::new(x_fq, y_fq);
    let neg_point = -g1_point;

    G1Point {
        x: neg_point.x().unwrap().into_bigint().to_string(),
        y: neg_point.y().unwrap().into_bigint().to_string(),
    }
}

fn convert_g1_point(point: &[String]) -> G1Point {
    G1Point {
        x: point[0].clone(),
        y: point[1].clone(),
    }
}

fn convert_g2_point(point: &[Vec<String>]) -> G2Point {
    G2Point {
        x_c0: point[0][0].clone(),
        x_c1: point[0][1].clone(),
        y_c0: point[1][0].clone(),
        y_c1: point[1][1].clone(),
    }
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

fn serialize_fq12(f: Fq12) -> Fp12Element {
    let to_string = |x: Fq| -> String {
        if x == Fq::zero() {
            "0".to_string()
        } else {
            x.to_string()
        }
    };

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

fn compute_alpha_beta_pairing(alpha: &[String], beta: &[Vec<String>]) -> Fp12Element {
    // Parse alpha (G1)
    let alpha_x: Fq = Fq::from_str(alpha[0].as_str()).unwrap();
    let alpha_y: Fq = Fq::from_str(alpha[1].as_str()).unwrap();

    // Parse beta (G2)
    let beta_x_c0: Fq = Fq::from_str(beta[0][0].as_str()).unwrap();
    let beta_x_c1: Fq = Fq::from_str(beta[0][1].as_str()).unwrap();
    let beta_y_c0: Fq = Fq::from_str(beta[1][0].as_str()).unwrap();
    let beta_y_c1: Fq = Fq::from_str(beta[1][1].as_str()).unwrap();

    let beta_x = Fq2::new(beta_x_c0, beta_x_c1);
    let beta_y = Fq2::new(beta_y_c0, beta_y_c1);

    let alpha_g1 = G1Affine::new(alpha_x, alpha_y);
    let beta_g2 = G2Affine::new(beta_x, beta_y);

    // Compute pairing
    let alpha_beta = Bn254::multi_miller_loop(&[alpha_g1], &[beta_g2]).0;

    serialize_fq12(alpha_beta)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();

    if args.len() != 6 {
        eprintln!(
            "Usage: {} <proof.json> <public.json> <vk.json> <output_proof.json> <output_vk.json>",
            args[0]
        );
        eprintln!("Example: {} proof.json public.json vk.json converted_proof.json converted_vk.json", args[0]);
        std::process::exit(1);
    }

    let proof_path = &args[1];
    let public_path = &args[2];
    let vk_path = &args[3];
    let output_proof_path = &args[4];
    let output_vk_path = &args[5];

    // Read proof.json
    let proof_content = fs::read_to_string(proof_path)?;
    let snarkjs_proof: SnarkjsProof = serde_json::from_str(&proof_content)?;

    // Read public.json
    let public_content = fs::read_to_string(public_path)?;
    let public_inputs: Vec<String> = serde_json::from_str(&public_content)?;

    // Read verification_key.json
    let vk_content = fs::read_to_string(vk_path)?;
    let snarkjs_vk: SnarkjsVK = serde_json::from_str(&vk_content)?;

    // Amount of public inputs in the verification key (nPublic) should be equal to amount of public inputs in the public.json file
    if snarkjs_vk.n_public != public_inputs.len() {
        eprintln!(
            "❌ VK nPublic ({}) doesn't match public inputs ({})",
            snarkjs_vk.n_public,
            public_inputs.len()
        );
        std::process::exit(1);
    }

    // Input commitment points in the verification key file should be equal to amount of public inputs in the public.json file + 1 (the constant)
    if snarkjs_vk.ic.len() != public_inputs.len() + 1 {
        eprintln!(
            "❌ VK IC points ({}) should be {}",
            snarkjs_vk.ic.len(),
            public_inputs.len() + 1
        );
        std::process::exit(1);
    }

    // Convert proof to o1js format
    let o1js_proof = O1jsProof {
        neg_a: negate_g1_point(&snarkjs_proof.pi_a), // pi_a is negated here
        b: convert_g2_point(&snarkjs_proof.pi_b),
        c: convert_g1_point(&snarkjs_proof.pi_c),
        pi1: public_inputs.get(0).unwrap_or(&"0".to_string()).clone(),
        pi2: public_inputs.get(1).unwrap_or(&"0".to_string()).clone(),
        pi3: public_inputs.get(2).unwrap_or(&"0".to_string()).clone(),
        pi4: public_inputs.get(3).unwrap_or(&"0".to_string()).clone(),
        pi5: public_inputs.get(4).unwrap_or(&"0".to_string()).clone(),
    };

    // Convert VK to o1js format
    let o1js_vk = O1jsVK {
        alpha: convert_g1_point(&snarkjs_vk.vk_alpha_1),
        beta: convert_g2_point(&snarkjs_vk.vk_beta_2),
        gamma: convert_g2_point(&snarkjs_vk.vk_gamma_2),
        delta: convert_g2_point(&snarkjs_vk.vk_delta_2),
        alpha_beta: compute_alpha_beta_pairing(&snarkjs_vk.vk_alpha_1, &snarkjs_vk.vk_beta_2),
        w27: create_default_w27(),
        ic0: convert_g1_point(&snarkjs_vk.ic[0]),
        ic1: convert_g1_point(&snarkjs_vk.ic[1]),
        ic2: convert_g1_point(&snarkjs_vk.ic[2]),
        ic3: convert_g1_point(&snarkjs_vk.ic[3]),
        ic4: convert_g1_point(&snarkjs_vk.ic[4]),
        ic5: convert_g1_point(&snarkjs_vk.ic[5]),
    };

    // Write outputs
    let proof_json = serde_json::to_string_pretty(&o1js_proof)?;
    let vk_json = serde_json::to_string_pretty(&o1js_vk)?;

    fs::write(output_proof_path, proof_json)?;
    fs::write(output_vk_path, vk_json)?;

    println!("✅ Successfully converted to o1js-blobstream format:");
    println!("📁 Input proof: {}", proof_path);
    println!("📁 Input public: {}", public_path);
    println!("📁 Input VK: {}", vk_path);
    println!("📁 Output proof: {}", output_proof_path);
    println!("📁 Output VK: {}", output_vk_path);
    println!("🔧 Applied negation to pi_a using arkworks");
    println!("🔧 Computed alpha-beta pairing using arkworks");
    println!(
        "🔧 Converted {} public inputs to pi1-pi5 format",
        public_inputs.len()
    );
    println!(
        "🔧 Converted {} IC points to ic0-ic5 format",
        snarkjs_vk.ic.len()
    );

    Ok(())
}