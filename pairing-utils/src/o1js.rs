//! o1js format types and format conversions.
//!
//! This module provides types for reading proofs and verification keys from snarkjs
//! and sp1 groth16 types and converting them to o1js format for verification.

use ark_bn254::{Bn254, G1Affine, G2Affine};
use ark_ec::pairing::Pairing;
use ark_groth16;
use serde::Serialize;

#[cfg(feature = "wasm")]
use tsify::Tsify;

use crate::gnark::{load_ark_proof_from_bytes, load_ark_groth16_verifying_key_from_bytes, GROTH16_VK_5_0_0_BYTES};
use crate::serialize::{serialize_fq12, Field12};
use crate::snarkjs::{SnarkjsProof, SnarkjsVK};
use crate::sp1::SP1ProofWithPublicValues;
use crate::types::{AffinePoint2d, ComplexAffinePoint2d};

fn get_pi(public_inputs: &[String], i: usize) -> Option<String> {
    public_inputs.get(i).cloned()
}

fn get_ic<T>(ic: &[T], i: usize) -> Option<AffinePoint2d>
where
    for<'a> &'a T: Into<AffinePoint2d>,
{
    ic.get(i).map(|p| p.into())
}

/// Groth16 proof in o1js format.
///
/// Contains the three proof curve points plus public inputs:
/// - `negA`: Negated A point (G1)
/// - `B`: B point (G2 - complex coordinates)
/// - `C`: C point (G1)
/// - `pi1` through `pi6`: Public inputs (max 6 supported)
#[derive(Serialize, Debug)]
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi))]
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

impl O1jsProof {}

impl TryFrom<(&SnarkjsProof, &[String])> for O1jsProof {
    type Error = String;

    /// Converts from `SnarkjsProof` (snarkjs/circom Groth16 proof format) to `O1jsProof` with the given public inputs.
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
    fn try_from((proof, public_inputs): (&SnarkjsProof, &[String])) -> Result<Self, Self::Error> {
        use ark_ec::AffineRepr;
        use ark_ff::PrimeField;

        if public_inputs.len() > 6 {
            return Err(format!(
                "O1jsProof <- SnarkjsProof: too many public inputs ({}, max 6)",
                public_inputs.len()
            ));
        }

        // Negate pi_a using arkworks
        let a_g1: G1Affine = (&proof.pi_a).try_into()
            .map_err(|e: String| format!("O1jsProof <- SnarkjsProof: pi_a: {}", e))?;
        let neg_a_g1 = -a_g1;
        let neg_a = AffinePoint2d {
            x: neg_a_g1.x().unwrap().into_bigint().to_string(),
            y: neg_a_g1.y().unwrap().into_bigint().to_string(),
        };

        // Convert B and C (no negation needed)
        let b: ComplexAffinePoint2d = (&proof.pi_b).into();
        let c: AffinePoint2d = (&proof.pi_c).into();

        Ok(O1jsProof {
            neg_a,
            b,
            c,
            pi1: get_pi(public_inputs, 0),
            pi2: get_pi(public_inputs, 1),
            pi3: get_pi(public_inputs, 2),
            pi4: get_pi(public_inputs, 3),
            pi5: get_pi(public_inputs, 4),
            pi6: get_pi(public_inputs, 5),
        })
    }
}

impl TryFrom<(&ark_groth16::Proof<Bn254>, &[String])> for O1jsProof {
    type Error = String;

    /// Converts from arkworks `Proof<Bn254>` to `O1jsProof` with the given public inputs.
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
    fn try_from((proof, public_inputs): (&ark_groth16::Proof<Bn254>, &[String])) -> Result<Self, Self::Error> {
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
        let b: ComplexAffinePoint2d = (&proof.b).into();

        // Convert C (G1 point)
        let c: AffinePoint2d = (&proof.c).into();

        Ok(O1jsProof {
            neg_a,
            b,
            c,
            pi1: get_pi(public_inputs, 0),
            pi2: get_pi(public_inputs, 1),
            pi3: get_pi(public_inputs, 2),
            pi4: get_pi(public_inputs, 3),
            pi5: get_pi(public_inputs, 4),
            pi6: get_pi(public_inputs, 5),
        })
    }
}

impl TryFrom<&SP1ProofWithPublicValues> for O1jsProof {
    type Error = String;

    /// Converts from `SP1ProofWithPublicValues` (SP1 Groth16 proof format) to `O1jsProof`.
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
    fn try_from(sp1: &SP1ProofWithPublicValues) -> Result<Self, Self::Error> {
        // Get the Groth16 proof
        let groth16_proof = match &sp1.proof {
            crate::sp1::SP1Proof::Groth16(proof) => proof,
            _ => return Err("O1jsProof <- SP1ProofWithPublicValues: proof is not Groth16 variant".to_string()),
        };

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
        (&ark_proof, &public_inputs[..]).try_into()
            .map_err(|e: String| format!("O1jsProof <- SP1ProofWithPublicValues: ark_proof conversion: {}", e))
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
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi))]
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

impl O1jsVK {}

impl TryFrom<&SnarkjsVK> for O1jsVK {
    type Error = String;

    /// Converts from `SnarkjsVK` (snarkjs/circom Groth16 verification key format) to `O1jsVK`.
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
    fn try_from(vk: &SnarkjsVK) -> Result<Self, Self::Error> {
        // Convert alpha and beta, then compute pairing
        let alpha_g1: G1Affine = (&vk.vk_alpha_1).try_into()
            .map_err(|e: String| format!("O1jsVK <- SnarkjsVK: vk_alpha_1: {}", e))?;
        let beta_g2: G2Affine = (&vk.vk_beta_2).try_into()
            .map_err(|e: String| format!("O1jsVK <- SnarkjsVK: vk_beta_2: {}", e))?;

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

        Ok(O1jsVK {
            alpha: AffinePoint2d::from(&vk.vk_alpha_1),
            beta: ComplexAffinePoint2d::from(&vk.vk_beta_2),
            gamma: ComplexAffinePoint2d::from(&vk.vk_gamma_2),
            delta: ComplexAffinePoint2d::from(&vk.vk_delta_2),
            alpha_beta,
            w27,
            ic0: get_ic(&vk.ic, 0).ok_or("O1jsVK <- SnarkjsVK: missing ic0 (constant term)")?,
            ic1: get_ic(&vk.ic, 1),
            ic2: get_ic(&vk.ic, 2),
            ic3: get_ic(&vk.ic, 3),
            ic4: get_ic(&vk.ic, 4),
            ic5: get_ic(&vk.ic, 5),
            ic6: get_ic(&vk.ic, 6),
        })
    }
}

impl TryFrom<&ark_groth16::VerifyingKey<Bn254>> for O1jsVK {
    type Error = String;

    /// Converts from arkworks `VerifyingKey<Bn254>` to `O1jsVK`.
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
    fn try_from(vk: &ark_groth16::VerifyingKey<Bn254>) -> Result<Self, Self::Error> {
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

        Ok(O1jsVK {
            alpha: AffinePoint2d::from(&vk.alpha_g1),
            beta: ComplexAffinePoint2d::from(&vk.beta_g2),
            gamma: ComplexAffinePoint2d::from(&vk.gamma_g2),
            delta: ComplexAffinePoint2d::from(&vk.delta_g2),
            alpha_beta,
            w27,
            ic0: get_ic(&vk.gamma_abc_g1, 0).ok_or("O1jsVK <- VerifyingKey<Bn254>: missing ic0 (constant term)")?,
            ic1: get_ic(&vk.gamma_abc_g1, 1),
            ic2: get_ic(&vk.gamma_abc_g1, 2),
            ic3: get_ic(&vk.gamma_abc_g1, 3),
            ic4: get_ic(&vk.gamma_abc_g1, 4),
            ic5: get_ic(&vk.gamma_abc_g1, 5),
            ic6: get_ic(&vk.gamma_abc_g1, 6),
        })
    }
}

/// Groth16 proof and verification key in o1js format.
///
/// Contains both the converted proof and verification key ready for
/// verification in Mina using o1js.
#[derive(Serialize, Debug)]
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi))]
pub struct O1jsGroth16 {
    pub proof: O1jsProof,
    pub vk: O1jsVK,
}

impl O1jsGroth16 {}

impl TryFrom<(&SnarkjsVK, &SnarkjsProof, &[String])> for O1jsGroth16 {
    type Error = String;

    /// Converts from SnarkJS Groth16 proof and verification key to `O1jsGroth16` format.
    ///
    /// This extracts the proof from the SnarkJS, validates the verification key,
    /// and converts both the proof and the verification key to o1js format.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The proof is not a valid format
    /// - VK validation fails (`nPublic` doesn't match public inputs count, wrong IC length, n_public > 6)
    fn try_from((snarkjs_vk, snarkjs_proof, public_inputs): (&SnarkjsVK, &SnarkjsProof, &[String])) -> Result<Self, Self::Error> {
        // Validate vk against public inputs
        snarkjs_vk.validate(public_inputs.len())?;
        // Convert proof and vk format
        let proof: O1jsProof = (snarkjs_proof, public_inputs).try_into()
            .map_err(|e: String| format!("O1jsGroth16 <- SnarkjsVK/SnarkjsProof: proof: {}", e))?;
        let vk: O1jsVK = snarkjs_vk.try_into()
            .map_err(|e: String| format!("O1jsGroth16 <- SnarkjsVK/SnarkjsProof: vk: {}", e))?;
        Ok(O1jsGroth16 { proof, vk })
    }
}

impl TryFrom<&SP1ProofWithPublicValues> for O1jsGroth16 {
    type Error = String;

    /// Converts from `SP1ProofWithPublicValues` (SP1 Groth16 proof format) to `O1jsGroth16`.
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
    fn try_from(sp1: &SP1ProofWithPublicValues) -> Result<Self, Self::Error> {
        let proof: O1jsProof = sp1.try_into()
            .map_err(|e: String| format!("O1jsGroth16 <- SP1ProofWithPublicValues: proof: {}", e))?;

        // Load the embedded SP1 v5.0.0 VK and convert to o1js format
        let ark_vk = load_ark_groth16_verifying_key_from_bytes(GROTH16_VK_5_0_0_BYTES)
            .map_err(|e| format!("O1jsGroth16 <- SP1ProofWithPublicValues: failed to load SP1 v5.0.0 VK: {}", e))?;
        let vk: O1jsVK = (&ark_vk).try_into()
            .map_err(|e: String| format!("O1jsGroth16 <- SP1ProofWithPublicValues: vk: {}", e))?;

        Ok(O1jsGroth16 { proof, vk })
    }
}
