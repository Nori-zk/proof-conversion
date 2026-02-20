//! SP1 proof types for JSON deserialization.
//!
//! These types mirror the sp1-sdk types to allow deserializing SP1 proofs
//! from JSON without requiring the sp1-sdk dependency.

use serde::{Deserialize, Serialize};

#[cfg(feature = "wasm")]
use tsify::Tsify;

/// Groth16 proof in SP1/gnark format.
///
/// Mirrors `sp1_prover::Groth16Bn254Proof`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi))]
pub struct Groth16Bn254Proof {
    pub public_inputs: [String; 5],
    pub encoded_proof: String,
    pub raw_proof: String,
    pub groth16_vkey_hash: [u8; 32],
}

/// Plonk proof in SP1/gnark format.
///
/// Mirrors `sp1_prover::PlonkBn254Proof`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi))]
pub struct PlonkBn254Proof {
    pub public_inputs: [String; 5],
    pub encoded_proof: String,
    pub raw_proof: String,
    pub plonk_vkey_hash: [u8; 32],
}

/// SP1 proof enum containing different proof types.
///
/// Mirrors `sp1_stark::SP1Proof`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi))]
#[serde(rename_all = "PascalCase")]
pub enum SP1Proof {
    Groth16(Groth16Bn254Proof),
    Plonk(PlonkBn254Proof),
}


/// SP1 public values.
///
/// Mirrors `sp1_primitives::io::SP1PublicValues`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi))]
pub struct SP1PublicValues {
    pub buffer: SP1Buffer,
}

/// Buffer containing public values data.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi))]
pub struct SP1Buffer {
    pub data: Vec<u8>,
}

impl SP1PublicValues {
    /// Converts public values to a byte vector.
    pub fn to_vec(&self) -> Vec<u8> {
        self.buffer.data.clone()
    }
}

/// SP1 proof with public values.
///
/// Mirrors `sp1_sdk::proof::SP1ProofWithPublicValues`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi))]
pub struct SP1ProofWithPublicValues {
    pub proof: SP1Proof,
    pub public_values: SP1PublicValues,
    pub sp1_version: String,
    pub tee_proof: Option<Vec<u8>>,
}

impl SP1ProofWithPublicValues {
    /// Returns the proof bytes for onchain verification.
    ///
    /// For Groth16 proofs, returns `[vkey_hash[..4], proof_bytes].concat()`.
    /// For Plonk proofs, returns `[vkey_hash[..4], proof_bytes].concat()`.
    ///
    /// # Panics
    ///
    /// Panics if the proof is not Groth16 or Plonk, or if hex decoding fails.
    /// Taken from https://github.com/succinctlabs/sp1/blob/v6.0.1/crates/sdk/src/proof.rs
    pub fn bytes(&self) -> Vec<u8> {
        match &self.proof {
            SP1Proof::Groth16(groth16_proof) => {
                // If the proof is empty, then this is a mock proof.
                if groth16_proof.encoded_proof.is_empty() {
                    return Vec::new();
                }

                let proof_bytes =
                    hex::decode(&groth16_proof.encoded_proof).expect("Invalid Groth16 proof");

                if let Some(tee_proof) = &self.tee_proof {
                    return [
                        tee_proof.clone(),
                        groth16_proof.groth16_vkey_hash[..4].to_vec(),
                        proof_bytes,
                    ]
                    .concat();
                }

                [groth16_proof.groth16_vkey_hash[..4].to_vec(), proof_bytes].concat()
            }
            SP1Proof::Plonk(plonk_proof) => {
                // If the proof is empty, then this is a mock proof.
                if plonk_proof.encoded_proof.is_empty() {
                    return Vec::new();
                }

                let proof_bytes =
                    hex::decode(&plonk_proof.encoded_proof).expect("Invalid Plonk proof");

                if let Some(tee_proof) = &self.tee_proof {
                    return [
                        tee_proof.clone(),
                        plonk_proof.plonk_vkey_hash[..4].to_vec(),
                        proof_bytes,
                    ]
                    .concat();
                }

                [plonk_proof.plonk_vkey_hash[..4].to_vec(), proof_bytes].concat()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::o1js::{O1jsGroth16, O1jsProof};

    fn load_example() -> SP1ProofWithPublicValues {
        let sp1_json = std::fs::read_to_string("../example-proofs/sp1_groth16_obj_v6.json")
            .expect("Failed to read SP1 example proof");
        serde_json::from_str(&sp1_json)
            .expect("Failed to parse SP1 proof")
    }

    #[test]
    fn test_sp1_to_o1js_groth16() {
        let sp1_proof = load_example();

        let o1js: O1jsGroth16 = (&sp1_proof)
            .try_into()
            .expect("Failed to convert SP1 to O1jsGroth16");

        // Verify public inputs are present
        assert!(o1js.proof.pi1.is_some(), "pi1 should be present");
        assert!(o1js.proof.pi2.is_some(), "pi2 should be present");

        // Verify proof structure
        assert!(!o1js.proof.neg_a.x.is_empty(), "negA.x should not be empty");
        assert!(!o1js.proof.neg_a.y.is_empty(), "negA.y should not be empty");
    }

    #[test]
    fn test_sp1_to_arkworks_to_o1js() {
        use crate::arkworks::ArkworksGroth16;

        let sp1_proof = load_example();

        // SP1 → arkworks
        let ark: ArkworksGroth16 = (&sp1_proof)
            .try_into()
            .expect("Failed to convert SP1 to ArkworksGroth16");

        // arkworks → O1js (includes verification)
        let o1js: O1jsGroth16 = (&ark)
            .try_into()
            .expect("Failed to convert ArkworksGroth16 to O1jsGroth16");

        // Verify conversion succeeded
        assert!(o1js.proof.pi1.is_some(), "Public inputs should be present");
    }

    #[test]
    fn test_sp1_with_invalid_proof_fails() {
        use crate::arkworks::ArkworksGroth16;

        let mut sp1_proof = load_example();

        // Corrupt the public inputs
        if let SP1Proof::Groth16(ref mut groth16) = sp1_proof.proof {
            groth16.public_inputs[0] = "123".to_string();
        }

        // SP1 → arkworks should succeed
        let ark: ArkworksGroth16 = (&sp1_proof)
            .try_into()
            .expect("Conversion to arkworks should succeed");

        // arkworks → O1js should fail due to verification
        let result: Result<O1jsGroth16, _> = (&ark).try_into();
        assert!(result.is_err(), "Should fail verification with corrupted inputs");
    }

    #[test]
    fn test_sp1_to_o1js_proof_direct() {
        let sp1_proof = load_example();

        // Test direct conversion to O1jsProof (not O1jsGroth16)
        let o1js_proof: O1jsProof = (&sp1_proof)
            .try_into()
            .expect("Failed to convert SP1 to O1jsProof");

        // Verify proof structure
        assert!(!o1js_proof.neg_a.x.is_empty(), "negA.x should not be empty");
        assert!(o1js_proof.pi1.is_some(), "pi1 should be present");
        assert!(o1js_proof.pi2.is_some(), "pi2 should be present");
    }

    #[test]
    fn test_sp1_to_o1js_serialization() {
        let sp1_proof = load_example();

        let o1js: O1jsGroth16 = (&sp1_proof)
            .try_into()
            .expect("Failed to convert SP1 to O1jsGroth16");

        // Verify we can serialize to JSON
        let json = serde_json::to_string(&o1js)
            .expect("Failed to serialize O1jsGroth16 to JSON");

        // Verify JSON contains expected fields
        assert!(json.contains("\"proof\""), "JSON should contain proof field");
        assert!(json.contains("\"vk\""), "JSON should contain vk field");
        assert!(json.contains("\"negA\""), "JSON should contain negA field");
        assert!(json.contains("\"alpha_beta\""), "JSON should contain alpha_beta field");
    }

    #[test]
    fn test_sp1_plonk_proof_fails_groth16_conversion() {
        let mut sp1_proof = load_example();

        // Replace with a Plonk proof variant
        if let SP1Proof::Groth16(groth16) = sp1_proof.proof {
            sp1_proof.proof = SP1Proof::Plonk(PlonkBn254Proof {
                public_inputs: groth16.public_inputs,
                encoded_proof: groth16.encoded_proof,
                raw_proof: groth16.raw_proof,
                plonk_vkey_hash: [0u8; 32],
            });
        }

        // Conversion to O1jsProof should fail for Plonk variant
        let result: Result<O1jsProof, _> = (&sp1_proof).try_into();
        assert!(result.is_err(), "Should fail for non-Groth16 variant");

        // Conversion to O1jsGroth16 should also fail
        let result: Result<O1jsGroth16, _> = (&sp1_proof).try_into();
        assert!(result.is_err(), "Should fail for non-Groth16 variant");
    }

    #[test]
    fn test_sp1_empty_proof_fails() {
        let mut sp1_proof = load_example();

        // Make the proof empty (mock proof)
        if let SP1Proof::Groth16(ref mut groth16) = sp1_proof.proof {
            groth16.encoded_proof = String::new();
        }

        // Conversion should fail for empty proofs
        use crate::arkworks::ArkworksGroth16;
        let result: Result<ArkworksGroth16, _> = (&sp1_proof).try_into();
        assert!(result.is_err(), "Should fail for empty/mock proof");
        assert!(
            result.unwrap_err().contains("empty proof"),
            "Error should mention empty proof"
        );
    }
}
