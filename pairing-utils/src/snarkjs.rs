//! Snarkjs/circom format types.
//!
//! This module provides types for reading proofs and verification keys from snarkjs.

use serde::Deserialize;

#[cfg(feature = "wasm")]
use tsify::Tsify;

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
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi))]
pub struct SnarkjsProof {
    pub pi_a: ProjectivePoint,
    pub pi_b: ComplexProjectivePoint,
    pub pi_c: ProjectivePoint,
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
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(from_wasm_abi))]
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::o1js::O1jsGroth16;

    #[derive(serde::Deserialize)]
    struct SnarkjsExample {
        proof: SnarkjsProof,
        vk: SnarkjsVK,
        #[serde(rename = "publicInputs")]
        public_inputs: Vec<String>,
    }

    fn load_example() -> SnarkjsExample {
        let snarkjs_json = std::fs::read_to_string("../example-proofs/snarkjs_groth16_obj.json")
            .expect("Failed to read SnarkJS example proof");
        serde_json::from_str(&snarkjs_json)
            .expect("Failed to parse SnarkJS proof")
    }

    #[test]
    fn test_snarkjs_to_o1js_groth16() {
        let snarkjs_obj = load_example();

        // Convert SnarkJS → O1jsGroth16 (includes VK validation)
        let o1js: O1jsGroth16 = (&snarkjs_obj.vk, &snarkjs_obj.proof, &snarkjs_obj.public_inputs[..])
            .try_into()
            .expect("Failed to convert SnarkJS to O1jsGroth16");

        // Verify public inputs are present
        assert_eq!(o1js.proof.pi1.as_ref(), Some(&snarkjs_obj.public_inputs[0]));

        // Verify proof structure
        assert!(!o1js.proof.neg_a.x.is_empty(), "negA.x should not be empty");
        assert!(!o1js.proof.neg_a.y.is_empty(), "negA.y should not be empty");

        // Verify VK structure
        assert!(!o1js.vk.alpha.x.is_empty(), "alpha.x should not be empty");
        assert!(!o1js.vk.alpha_beta.g00.is_empty(), "alpha_beta should be computed");
    }

    #[test]
    fn test_snarkjs_vk_validation_failure() {
        let snarkjs_obj = load_example();

        // Try to convert with wrong number of public inputs
        let wrong_inputs = vec!["1".to_string(), "2".to_string(), "3".to_string()];

        let result: Result<O1jsGroth16, _> =
            (&snarkjs_obj.vk, &snarkjs_obj.proof, &wrong_inputs[..]).try_into();

        // Should fail validation
        assert!(result.is_err(), "Should fail with mismatched public input count");

        // Verify error message has proper context
        let err_msg = result.unwrap_err();
        assert!(
            err_msg.contains("O1jsGroth16 -> SnarkjsVK/SnarkjsProof"),
            "Error should include conversion context"
        );
    }

    #[test]
    fn test_snarkjs_to_o1js_proof_direct() {
        let snarkjs_obj = load_example();

        // Test direct conversion: SnarkjsProof → O1jsProof (no VK)
        use crate::o1js::O1jsProof;
        let o1js_proof: O1jsProof = (&snarkjs_obj.proof, &snarkjs_obj.public_inputs[..])
            .try_into()
            .expect("Failed to convert SnarkjsProof to O1jsProof");

        // Verify proof structure
        assert!(!o1js_proof.neg_a.x.is_empty(), "negA.x should not be empty");
        assert!(!o1js_proof.b.x_c0.is_empty(), "B.x_c0 should not be empty");
        assert!(!o1js_proof.c.x.is_empty(), "C.x should not be empty");
        assert_eq!(
            o1js_proof.pi1.as_ref(),
            Some(&snarkjs_obj.public_inputs[0]),
            "Public input should match"
        );
    }

    #[test]
    fn test_snarkjs_to_o1js_vk_direct() {
        let snarkjs_obj = load_example();

        // Test direct conversion: SnarkjsVK → O1jsVK
        use crate::o1js::O1jsVK;
        let o1js_vk: O1jsVK = (&snarkjs_obj.vk)
            .try_into()
            .expect("Failed to convert SnarkjsVK to O1jsVK");

        // Verify VK structure
        assert!(!o1js_vk.alpha.x.is_empty(), "alpha.x should not be empty");
        assert!(!o1js_vk.beta.x_c0.is_empty(), "beta.x_c0 should not be empty");
        assert!(!o1js_vk.gamma.x_c0.is_empty(), "gamma.x_c0 should not be empty");
        assert!(!o1js_vk.delta.x_c0.is_empty(), "delta.x_c0 should not be empty");
        assert!(!o1js_vk.alpha_beta.g00.is_empty(), "alpha_beta should be computed");
    }

    #[test]
    fn test_snarkjs_public_input_count_mismatch() {
        let snarkjs_obj = load_example();

        // Try with 7 public inputs (doesn't match VK's n_public)
        let too_many_inputs: Vec<String> = (0..7).map(|i| i.to_string()).collect();

        let result: Result<O1jsGroth16, _> =
            (&snarkjs_obj.vk, &snarkjs_obj.proof, &too_many_inputs[..]).try_into();

        // Should fail validation due to mismatch
        assert!(
            result.is_err(),
            "Should fail when public input count doesn't match VK"
        );
        assert!(
            result.unwrap_err().contains("doesn't match"),
            "Error should mention mismatch"
        );
    }

    #[test]
    fn test_snarkjs_to_o1js_serialization() {
        let snarkjs_obj = load_example();

        let o1js: O1jsGroth16 = (&snarkjs_obj.vk, &snarkjs_obj.proof, &snarkjs_obj.public_inputs[..])
            .try_into()
            .expect("Failed to convert SnarkJS to O1jsGroth16");

        // Verify we can serialize to JSON
        let json = serde_json::to_string(&o1js)
            .expect("Failed to serialize O1jsGroth16 to JSON");

        // Verify JSON contains expected fields
        assert!(json.contains("\"proof\""), "JSON should contain proof field");
        assert!(json.contains("\"vk\""), "JSON should contain vk field");
        assert!(json.contains("\"negA\""), "JSON should contain negA field");
        assert!(json.contains("\"alpha_beta\""), "JSON should contain alpha_beta field");
    }
}

