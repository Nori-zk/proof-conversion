//! Snarkjs/circom format types.
//!
//! This module provides types for reading proofs and verification keys from snarkjs.

use serde::Deserialize;
use serde_wasm_bindgen::from_value;
use wasm_bindgen::prelude::*;

use crate::types::{ComplexProjectivePoint, ProjectivePoint};

/// Groth16 proof in snarkjs/circom format.
///
/// This is the input format produced by snarkjs when generating proofs.
/// Points are in projective coordinates (with z component).
///
/// - `pi_a`: A point (G1 projective)
/// - `pi_b`: B point (G2 projective)
/// - `pi_c`: C point (G1 projective)
#[derive(Deserialize, Debug)]
pub struct SnarkjsProof {
    pub pi_a: ProjectivePoint,
    pub pi_b: ComplexProjectivePoint,
    pub pi_c: ProjectivePoint,
}

impl SnarkjsProof {
    /// Parses from a JavaScript value into `SnarkjsProof`.
    ///
    /// # Errors
    ///
    /// Returns an error if the JsValue doesn't match the expected structure.
    pub fn from_js(js: JsValue) -> Result<Self, String> {
        from_value(js).map_err(|e| format!("SnarkjsProof <- JsValue: {}", e))
    }
}

/// Groth16 verification key in snarkjs/circom format.
///
/// This is the input format produced by snarkjs when compiling circom circuits.
/// Points are in projective coordinates (with z component).
///
/// - `n_public`: Number of public inputs in the circuit
/// - `vk_alpha_1`: Alpha point (G1 projective)
/// - `vk_beta_2`, `vk_gamma_2`, `vk_delta_2`: Setup points (G2 projective)
/// - `ic`: Input commitment points, one per public input plus a constant term
#[derive(Deserialize, Debug)]
pub struct SnarkjsVK {
    #[serde(rename = "nPublic")]
    pub n_public: usize,
    pub vk_alpha_1: ProjectivePoint,
    pub vk_beta_2: ComplexProjectivePoint,
    pub vk_gamma_2: ComplexProjectivePoint,
    pub vk_delta_2: ComplexProjectivePoint,
    #[serde(rename = "IC")]
    pub ic: Vec<ProjectivePoint>,
}

impl SnarkjsVK {
    /// Parses from a JavaScript value into `SnarkjsVK`.
    ///
    /// # Errors
    ///
    /// Returns an error if the JsValue doesn't match the expected structure.
    pub fn from_js(js: JsValue) -> Result<Self, String> {
        from_value(js).map_err(|e| format!("SnarkjsVK <- JsValue: {}", e))
    }

    /// Validates the verification key against the given number of public inputs.
    ///
    /// # Validation Rules
    ///
    /// - `n_public` must match `public_input_count`
    /// - `ic.len()` must equal `public_input_count + 1` (IC includes constant term ic0)
    /// - `n_public` must not exceed 6 (max supported)
    ///
    /// # Errors
    ///
    /// Returns an error describing which validation rule failed.
    pub fn validate(&self, public_input_count: usize) -> Result<(), String> {
        if self.n_public != public_input_count {
            return Err(format!(
                "SnarkjsVK validation: nPublic ({}) doesn't match public input count ({})",
                self.n_public, public_input_count
            ));
        }

        let expected_ic_count = public_input_count + 1;
        if self.ic.len() != expected_ic_count {
            return Err(format!(
                "SnarkjsVK validation: IC count ({}) should be {} (public inputs + 1)",
                self.ic.len(), expected_ic_count
            ));
        }

        if self.n_public > 6 {
            return Err(format!(
                "SnarkjsVK validation: nPublic ({}) exceeds max supported (6)",
                self.n_public
            ));
        }

        Ok(())
    }
}

