//! o1js format types and format conversions.
//!
//! This module provides types for reading proofs and verification keys from snarkjs
//! and sp1 groth16 types and converting them to o1js format for verification.

use ark_bn254::Bn254;
use ark_ec::pairing::Pairing;
use ark_groth16;
use serde::Serialize;

use crate::gnark::{load_ark_proof_from_bytes, load_ark_groth16_verifying_key_from_bytes, GROTH16_VK_5_0_0_BYTES};
use crate::serialize::{serialize_fq12, Field12};
use crate::snarkjs::{SnarkjsProof, SnarkjsVK};
use crate::sp1::SP1ProofWithPublicValues;
use crate::types::{AffinePoint2d, ComplexAffinePoint2d};

/// Groth16 proof in o1js format.
///
/// Contains the three proof curve points plus public inputs:
/// - `negA`: Negated A point (G1)
/// - `B`: B point (G2 - complex coordinates)
/// - `C`: C point (G1)
/// - `pi1` through `pi6`: Public inputs (max 6 supported)
#[derive(Serialize, Debug)]
pub struct O1jsProof {
    #[serde(rename = "negA")]
    pub neg_a: AffinePoint2d,
    #[serde(rename = "B")]
    pub b: ComplexAffinePoint2d,
    #[serde(rename = "C")]
    pub c: AffinePoint2d,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pi1: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pi2: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pi3: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pi4: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pi5: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pi6: Option<String>,
}

impl O1jsProof {
    /// Converts from snarkjs/circom Groth16 proof format with the given public inputs.
    ///
    /// - `pi_a` is negated to produce `negA` (arkworks `G1Affine` negation)
    /// - `pi_b` → `B` (converted to `ComplexAffinePoint2d`)
    /// - `pi_c` → `C` (converted to `AffinePoint2d`)
    ///
    /// # Arguments
    ///
    /// - `proof`: The snarkjs-formatted Groth16 proof
    /// - `public_inputs`: The public inputs (max 6 supported)
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - More than 6 public inputs are provided
    /// - Any point coordinate cannot be parsed as a valid `Fq` field element
    pub fn from_snarkjs_groth16(proof: &SnarkjsProof, public_inputs: &[String]) -> Result<Self, String> {
        use ark_ec::AffineRepr;
        use ark_ff::PrimeField;

        if public_inputs.len() > 6 {
            return Err(format!(
                "O1jsProof <- SnarkjsProof: too many public inputs ({}, max 6)",
                public_inputs.len()
            ));
        }

        // Negate pi_a using arkworks
        let a_g1 = proof.pi_a.to_g1_affine()
            .map_err(|e| format!("O1jsProof <- SnarkjsProof: pi_a: {}", e))?;
        let neg_a_g1 = -a_g1;
        let neg_a = AffinePoint2d {
            x: neg_a_g1.x().unwrap().into_bigint().to_string(),
            y: neg_a_g1.y().unwrap().into_bigint().to_string(),
        };

        // Convert B and C (no negation needed)
        let b = proof.pi_b.to_affine_2d();
        let c = proof.pi_c.to_affine_2d();

        // Map public inputs to pi1-pi6
        let get_pi = |i: usize| -> Option<String> {
            public_inputs.get(i).cloned()
        };

        Ok(O1jsProof {
            neg_a,
            b,
            c,
            pi1: get_pi(0),
            pi2: get_pi(1),
            pi3: get_pi(2),
            pi4: get_pi(3),
            pi5: get_pi(4),
            pi6: get_pi(5),
        })
    }

    /// Converts from arkworks `Proof<Bn254>` with the given public inputs.
    ///
    /// - `proof.a` is negated to produce `negA`
    /// - `proof.b` → `B`
    /// - `proof.c` → `C`
    ///
    /// # Arguments
    ///
    /// - `proof`: The arkworks Groth16 proof
    /// - `public_inputs`: The public inputs (max 6 supported)
    ///
    /// # Errors
    ///
    /// Returns an error if more than 6 public inputs are provided.
    pub fn from_arkworks_groth16(
        proof: &ark_groth16::Proof<Bn254>,
        public_inputs: &[String],
    ) -> Result<Self, String> {
        use ark_ff::PrimeField;

        if public_inputs.len() > 6 {
            return Err(format!(
                "O1jsProof <- Proof<Bn254>: too many public inputs ({}, max 6)",
                public_inputs.len()
            ));
        }

        // Negate A for o1js compatibility
        let neg_a_g1 = -proof.a;
        let neg_a = AffinePoint2d {
            x: neg_a_g1.x.into_bigint().to_string(),
            y: neg_a_g1.y.into_bigint().to_string(),
        };

        // Convert B (G2 point)
        let b = ComplexAffinePoint2d::from_g2_affine(&proof.b);

        // Convert C (G1 point)
        let c = AffinePoint2d::from_g1_affine(&proof.c);

        // Map public inputs to pi1-pi6
        let get_pi = |i: usize| -> Option<String> {
            public_inputs.get(i).cloned()
        };

        Ok(O1jsProof {
            neg_a,
            b,
            c,
            pi1: get_pi(0),
            pi2: get_pi(1),
            pi3: get_pi(2),
            pi4: get_pi(3),
            pi5: get_pi(4),
            pi6: get_pi(5),
        })
    }

    /// Converts from an SP1 Groth16 proof.
    ///
    /// Extracts the gnark-formatted proof from the SP1 proof, decompresses it,
    /// and converts to o1js format.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The proof is not the Groth16 variant
    /// - The proof is empty (mock proof)
    /// - gnark decompression fails
    pub fn from_sp1_groth16(sp1: &SP1ProofWithPublicValues) -> Result<Self, String> {
        // Get the Groth16 proof
        let groth16_proof = sp1.proof.try_as_groth_16()
            .ok_or("O1jsProof <- SP1ProofWithPublicValues: proof is not Groth16 variant")?;

        // Get proof bytes (this hex-decodes encoded_proof and prepends vkey hash)
        let proof_bytes = sp1.bytes();
        if proof_bytes.is_empty() {
            return Err("O1jsProof <- SP1ProofWithPublicValues: empty proof (mock proof not supported)".to_string());
        }

        // Skip the first 4 bytes (vkey hash prefix) and load arkworks proof
        let ark_proof = load_ark_proof_from_bytes(&proof_bytes[4..])
            .map_err(|e| format!("O1jsProof <- SP1ProofWithPublicValues: failed to load proof: {}", e))?;

        // Convert to o1js format
        let public_inputs: Vec<String> = groth16_proof.public_inputs.to_vec();
        Self::from_arkworks_groth16(&ark_proof, &public_inputs)
    }
}

/// Groth16 verification key in o1js format.
///
/// Contains the verification key parameters needed for proof verification:
///
/// - `alpha`: Alpha point from trusted setup (G1)
/// - `beta`, `gamma`, `delta`: Curve points from the trusted setup (G2)
/// - `alpha_beta`: Precomputed pairing e(alpha, beta) as a 12-element field value
/// - `w27`: A 27th root of unity used for pairing optimizations
/// - `ic0` through `ic6`: Input commitment points for public input verification.
///   `ic0` is always present (the constant term). `ic1`-`ic6` are optional based on
///   how many public inputs the circuit has (max 6 supported).
///
/// The Groth16 verification equation uses: `PI = ic0 + Σ(public_input[i] * ic[i+1])`
#[derive(Serialize, Debug)]
pub struct O1jsVK {
    pub alpha: AffinePoint2d,
    pub beta: ComplexAffinePoint2d,
    pub gamma: ComplexAffinePoint2d,
    pub delta: ComplexAffinePoint2d,
    pub alpha_beta: Field12,
    pub w27: Field12,
    pub ic0: AffinePoint2d,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ic1: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ic2: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ic3: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ic4: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ic5: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ic6: Option<AffinePoint2d>,
}

impl O1jsVK {
    /// Converts from snarkjs/circom Groth16 verification key format.
    ///
    /// - `vk_alpha_1` → `alpha` (G1)
    /// - `vk_beta_2` → `beta` (G2)
    /// - `vk_gamma_2` → `gamma` (G2)
    /// - `vk_delta_2` → `delta` (G2)
    /// - Computes `alpha_beta` pairing using arkworks `multi_miller_loop`
    /// - Adds hardcoded `w27` (27th root of unity for pairing optimizations)
    /// - Maps IC points to `ic0`-`ic6`
    ///
    /// # Errors
    ///
    /// Returns an error if any coordinate cannot be parsed as a valid field element.
    pub fn from_snarkjs_groth16(vk: &SnarkjsVK) -> Result<Self, String> {
        // Convert alpha and beta, then compute pairing
        let alpha_g1 = vk.vk_alpha_1.to_g1_affine()
            .map_err(|e| format!("O1jsVK <- SnarkjsVK: vk_alpha_1: {}", e))?;
        let beta_g2 = vk.vk_beta_2.to_g2_affine()
            .map_err(|e| format!("O1jsVK <- SnarkjsVK: vk_beta_2: {}", e))?;

        // Compute alpha_beta pairing
        let alpha_beta_fq12 = Bn254::multi_miller_loop(&[alpha_g1], &[beta_g2]).0;
        let alpha_beta = serialize_fq12(alpha_beta_fq12);

        // Hardcoded w27 (27th root of unity for pairing optimizations)
        // https://eprint.iacr.org/2024/640
        let w27 = Field12 {
            g00: "0".to_string(),
            g01: "0".to_string(),
            g10: "0".to_string(),
            g11: "0".to_string(),
            g20: "8204864362109909869166472767738877274689483185363591877943943203703805152849".to_string(),
            g21: "17912368812864921115467448876996876278487602260484145953989158612875588124088".to_string(),
            h00: "0".to_string(),
            h01: "0".to_string(),
            h10: "0".to_string(),
            h11: "0".to_string(),
            h20: "0".to_string(),
            h21: "0".to_string(),
        };

        // Map IC points (ic0 is always present, ic1-ic6 are optional)
        let get_ic = |i: usize| -> Option<AffinePoint2d> {
            vk.ic.get(i).map(|p| p.to_affine_2d())
        };

        // ic0 must exist
        let ic0 = get_ic(0).ok_or("O1jsVK <- SnarkjsVK: missing ic0 (constant term)")?;

        Ok(O1jsVK {
            alpha: vk.vk_alpha_1.to_affine_2d(),
            beta: vk.vk_beta_2.to_affine_2d(),
            gamma: vk.vk_gamma_2.to_affine_2d(),
            delta: vk.vk_delta_2.to_affine_2d(),
            alpha_beta,
            w27,
            ic0,
            ic1: get_ic(1),
            ic2: get_ic(2),
            ic3: get_ic(3),
            ic4: get_ic(4),
            ic5: get_ic(5),
            ic6: get_ic(6),
        })
    }

    /// Converts from arkworks `VerifyingKey<Bn254>`.
    ///
    /// - `alpha_g1` → `alpha` (G1)
    /// - `beta_g2` → `beta` (G2)
    /// - `gamma_g2` → `gamma` (G2)
    /// - `delta_g2` → `delta` (G2)
    /// - Computes `alpha_beta` pairing using arkworks `multi_miller_loop`
    /// - Adds hardcoded `w27` (27th root of unity for pairing optimizations)
    /// - Maps `gamma_abc_g1` to `ic0`-`ic6`
    ///
    /// # Errors
    ///
    /// Returns an error if IC is empty (missing ic0).
    pub fn from_arkworks_groth16(vk: &ark_groth16::VerifyingKey<Bn254>) -> Result<Self, String> {
        // Compute alpha_beta pairing
        let alpha_beta_fq12 = Bn254::multi_miller_loop(&[vk.alpha_g1], &[vk.beta_g2]).0;
        let alpha_beta = serialize_fq12(alpha_beta_fq12);

        // Hardcoded w27 (27th root of unity for pairing optimizations)
        // https://eprint.iacr.org/2024/640
        let w27 = Field12 {
            g00: "0".to_string(),
            g01: "0".to_string(),
            g10: "0".to_string(),
            g11: "0".to_string(),
            g20: "8204864362109909869166472767738877274689483185363591877943943203703805152849".to_string(),
            g21: "17912368812864921115467448876996876278487602260484145953989158612875588124088".to_string(),
            h00: "0".to_string(),
            h01: "0".to_string(),
            h10: "0".to_string(),
            h11: "0".to_string(),
            h20: "0".to_string(),
            h21: "0".to_string(),
        };

        // Map IC points (ic0 is always present, ic1-ic6 are optional)
        let get_ic = |i: usize| -> Option<AffinePoint2d> {
            vk.gamma_abc_g1.get(i).map(|p| AffinePoint2d::from_g1_affine(p))
        };

        // ic0 must exist
        let ic0 = get_ic(0).ok_or("O1jsVK <- VerifyingKey<Bn254>: missing ic0 (constant term)")?;

        Ok(O1jsVK {
            alpha: AffinePoint2d::from_g1_affine(&vk.alpha_g1),
            beta: ComplexAffinePoint2d::from_g2_affine(&vk.beta_g2),
            gamma: ComplexAffinePoint2d::from_g2_affine(&vk.gamma_g2),
            delta: ComplexAffinePoint2d::from_g2_affine(&vk.delta_g2),
            alpha_beta,
            w27,
            ic0,
            ic1: get_ic(1),
            ic2: get_ic(2),
            ic3: get_ic(3),
            ic4: get_ic(4),
            ic5: get_ic(5),
            ic6: get_ic(6),
        })
    }

    /// Converts the embedded SP1 v5.0.0 verification key to o1js format.
    ///
    /// This uses the hardcoded SP1 v5.0.0 VK bytes since all SP1 Groth16 proofs
    /// use the same verification key.
    ///
    /// # Errors
    ///
    /// Returns an error if the embedded VK fails to load (should never happen).
    pub fn from_sp1_groth16() -> Result<Self, String> {
        let ark_vk = load_ark_groth16_verifying_key_from_bytes(GROTH16_VK_5_0_0_BYTES)
            .map_err(|e| format!("O1jsVK <- SP1 v5.0.0 VK: failed to load: {}", e))?;
        Self::from_arkworks_groth16(&ark_vk)
    }
}

/// Groth16 proof and verification key in o1js format.
///
/// Contains both the converted proof and verification key ready for
/// verification in Mina using o1js.
#[derive(Serialize, Debug)]
pub struct O1jsGroth16 {
    pub proof: O1jsProof,
    pub vk: O1jsVK,
}

impl O1jsGroth16 {
    /// Converts an SP1 Groth16 proof to o1js format.
    ///
    /// This extracts the gnark-formatted proof from the SP1 proof, decompresses it,
    /// and converts both the proof and the embedded SP1 v5.0.0 verification key to o1js format.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The proof is not the Groth16 variant
    /// - The proof is empty (mock proof)
    /// - gnark decompression fails
    pub fn from_sp1_groth16(sp1: &SP1ProofWithPublicValues) -> Result<Self, String> {
        let proof = O1jsProof::from_sp1_groth16(sp1)?;
        let vk = O1jsVK::from_sp1_groth16()?;
        Ok(O1jsGroth16 { proof, vk })
    }
}
