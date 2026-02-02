//! Arkworks format types and verification.
//!
//! This module provides intermediate types for working with arkworks Groth16 proofs
//! and verification keys. These types serve as a bridge between input formats (SP1, gnark)
//! and output formats (o1js), and provide verification capabilities at the arkworks level.

use ark_bn254::{Bn254, Fr};
use ark_ff::PrimeField;
use ark_groth16;
use ark_snark::SNARK;
use num_bigint::BigUint;
use num_traits::Num;

use crate::gnark::{load_ark_proof_from_bytes, load_ark_groth16_verifying_key_from_bytes, GROTH16_VK_5_0_0_BYTES};
use crate::sp1::SP1ProofWithPublicValues;

/// Groth16 proof and verification key in arkworks format.
///
/// Intermediate representation used for verification before converting to o1js format.
/// This struct holds the arkworks proof, verification key, and public inputs together,
/// allowing for verification at the arkworks level before conversion to o1js.
///
/// # Workflow
///
/// 1. Load from input format (e.g., SP1) via `TryFrom`
/// 2. Verify using `verify()` method
/// 3. Convert to output format (e.g., O1js) via `TryFrom`
#[derive(Debug, Clone)]
pub struct ArkworksGroth16 {
    pub proof: ark_groth16::Proof<Bn254>,
    pub vk: ark_groth16::VerifyingKey<Bn254>,
    pub public_inputs: Vec<String>,
}

impl ArkworksGroth16 {
    /// Verifies the proof using arkworks Groth16 verification.
    ///
    /// This prepares the verification key and verifies the proof against the public inputs
    /// using the arkworks Groth16 verifier. This follows the same workflow as the
    /// `convert_from_sp1_groth16` binary.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Public input parsing fails
    /// - Proof verification fails
    /// - The verification process encounters an error
    ///
    /// # Example
    ///
    /// ```ignore
    /// let ark_groth16: ArkworksGroth16 = sp1_proof.try_into()?;
    /// ark_groth16.verify()?;
    /// let o1js_groth16: O1jsGroth16 = (&ark_groth16).try_into()?;
    /// ```
    pub fn verify(&self) -> Result<(), String> {
        // Parse public inputs to field elements
        let ark_public_inputs: Vec<Fr> = self
            .public_inputs
            .iter()
            .enumerate()
            .map(|(i, input_str)| {
                let input_bigint = BigUint::from_str_radix(input_str, 10)
                    .map_err(|e| format!("ArkworksGroth16::verify: failed to parse public input {} as decimal: {}", i, e))?;
                let input_bytes = input_bigint.to_bytes_be();

                // Pad to 32 bytes
                let mut padded_input = vec![0u8; 32usize.saturating_sub(input_bytes.len())];
                padded_input.extend_from_slice(&input_bytes);
                let padded_array: [u8; 32] = padded_input
                    .try_into()
                    .map_err(|_| format!("ArkworksGroth16::verify: failed to convert public input {} to 32-byte array", i))?;

                Ok(Fr::from_be_bytes_mod_order(&padded_array))
            })
            .collect::<Result<Vec<_>, String>>()?;

        // Prepare verification key
        let ark_pvk = ark_groth16::prepare_verifying_key(&self.vk);

        // Verify proof
        let verified = ark_groth16::Groth16::<Bn254>::verify_with_processed_vk(
            &ark_pvk,
            &ark_public_inputs,
            &self.proof,
        )
        .map_err(|e| format!("ArkworksGroth16::verify: verification error: {}", e))?;

        if !verified {
            return Err("ArkworksGroth16::verify: proof verification failed".to_string());
        }

        Ok(())
    }
}

impl TryFrom<&SP1ProofWithPublicValues> for ArkworksGroth16 {
    type Error = String;

    /// Converts from `SP1ProofWithPublicValues` to arkworks format.
    ///
    /// This extracts the gnark-formatted proof from SP1, decompresses it to arkworks format,
    /// and loads the embedded SP1 v5.0.0 verification key.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The proof is not the Groth16 variant
    /// - The proof is empty (mock proof)
    /// - gnark decompression fails
    fn try_from(sp1: &SP1ProofWithPublicValues) -> Result<Self, Self::Error> {
        // Extract Groth16 proof variant using TryFrom from sp1.rs
        let groth16_proof: crate::sp1::Groth16Bn254Proof = sp1.proof.clone().try_into()
            .map_err(|e| format!("ArkworksGroth16 <- SP1ProofWithPublicValues: {}", e))?;

        // Get proof bytes (this hex-decodes encoded_proof and prepends vkey hash)
        let proof_bytes = sp1.bytes();
        if proof_bytes.is_empty() {
            return Err("ArkworksGroth16 <- SP1ProofWithPublicValues: empty proof (mock proof not supported)".to_string());
        }

        // Skip the first 4 bytes (vkey hash prefix) and load arkworks proof
        let proof = load_ark_proof_from_bytes(&proof_bytes[4..])
            .map_err(|e| format!("ArkworksGroth16 <- SP1ProofWithPublicValues: failed to load arkworks proof: {}", e))?;

        // Load the embedded SP1 v5.0.0 VK
        let vk = load_ark_groth16_verifying_key_from_bytes(GROTH16_VK_5_0_0_BYTES)
            .map_err(|e| format!("ArkworksGroth16 <- SP1ProofWithPublicValues: failed to load SP1 v5.0.0 VK: {}", e))?;

        let public_inputs: Vec<String> = groth16_proof.public_inputs.to_vec();

        Ok(ArkworksGroth16 {
            proof,
            vk,
            public_inputs,
        })
    }
}
