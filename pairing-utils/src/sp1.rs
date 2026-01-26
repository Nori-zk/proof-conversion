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
    pub public_inputs: [String; 2],
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
    pub public_inputs: [String; 2],
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

impl SP1Proof {
    /// Returns the Groth16 proof if this is a Groth16 variant.
    pub fn try_as_groth_16(&self) -> Option<&Groth16Bn254Proof> {
        match self {
            SP1Proof::Groth16(proof) => Some(proof),
            _ => None,
        }
    }

    /// Returns the Plonk proof if this is a Plonk variant.
    pub fn try_as_plonk(&self) -> Option<&PlonkBn254Proof> {
        match self {
            SP1Proof::Plonk(proof) => Some(proof),
            _ => None,
        }
    }
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
    /// Taken from https://github.com/succinctlabs/sp1/blob/main/crates/sdk/src/proof.rs#L124
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
