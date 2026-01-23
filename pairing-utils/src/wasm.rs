//! WebAssembly bindings for pairing-utils.
//!
//! This module provides wasm-bindgen exported functions for use from JavaScript.

use ark_bn254::Bn254;
use ark_ec::pairing::Pairing;
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::{prelude::*, JsError};

use crate::gnark::{load_ark_proof_from_bytes, load_ark_groth16_verifying_key_from_bytes, GROTH16_VK_5_0_0_BYTES};
use crate::kzg::{assert_o1js_mlo, compute_aux_witness};
use crate::serialize::{serialize_fq12, AuxWitness, Field12};
use crate::o1js::{O1jsGroth16, O1jsProof, O1jsVK};
use crate::snarkjs::{SnarkjsProof, SnarkjsVK};
use crate::sp1::SP1ProofWithPublicValues;
use crate::types::{AffinePoint2d, ComplexAffinePoint2d};

/// Input for computing a pairing operation.
///
/// A pairing combines a G1 point and a G2 point to produce a 12-element field value.
/// In Groth16/PLONK verification keys, this is used to precompute e(alpha, beta).
///
/// - `alpha`: G1 curve point (simple 2D coordinates)
/// - `beta`: G2 curve point (complex 2D coordinates, each coordinate is a pair)
///
/// See [`compute_pairing_js`] for the computation.
#[derive(Serialize, Deserialize, Debug)]
pub struct PairingInput {
    pub alpha: AffinePoint2d,
    pub beta: ComplexAffinePoint2d,
}

impl PairingInput {
    /// Parses from a JavaScript value into a `PairingInput`.
    ///
    /// # Errors
    ///
    /// Returns an error if the JsValue doesn't match the expected structure.
    pub fn from_js(js: JsValue) -> Result<Self, String> {
        from_value(js).map_err(|e| format!("PairingInput <- JsValue: {}", e))
    }

    /// Converts to arkworks pairing input points (`G1Affine`, `G2Affine`).
    ///
    /// - `alpha` → `G1Affine`
    /// - `beta` → `G2Affine`
    ///
    /// # Errors
    ///
    /// Returns an error if any coordinate cannot be parsed as a valid field element.
    pub fn to_pairing_points(&self) -> Result<(ark_bn254::G1Affine, ark_bn254::G2Affine), String> {
        let g1 = self.alpha.to_g1_affine()
            .map_err(|e| format!("PairingInput -> (G1Affine, G2Affine): alpha: {}", e))?;
        let g2 = self.beta.to_g2_affine()
            .map_err(|e| format!("PairingInput -> (G1Affine, G2Affine): beta: {}", e))?;
        Ok((g1, g2))
    }
}

/// Computes the auxiliary witness from a Miller loop output.
///
/// # What This Does
///
/// Takes a 12-element field value (the result of a Miller loop pairing computation)
/// and computes the auxiliary witness needed for efficient verification.
///
/// The Miller loop is the first step of pairing-based verification. Its output
/// needs further processing (final exponentiation), which is expensive. The
/// auxiliary witness provides precomputed hints that make this step efficient.
///
/// # Input
///
/// A JS object matching [`Field12`] structure (12 string fields: g00-g21, h00-h21).
///
/// # Output
///
/// A JS object matching [`AuxWitness`] structure containing:
/// - `c`: A 12-element field value
/// - `shift_power`: "0", "1", or "2"
///
/// # Panics
///
/// Panics if the input is not a valid Miller loop output (fails internal assertion).
#[wasm_bindgen]
pub fn compute_and_serialize_aux_witness_js(input: JsValue) -> Result<JsValue, JsError> {
    let f12 = Field12::from_js(input)
        .map_err(|e| JsError::new(&format!("compute_and_serialize_aux_witness_js: {}", e)))?;

    let mlo = f12.to_fq12()
        .map_err(|e| JsError::new(&format!("compute_and_serialize_aux_witness_js: {}", e)))?;

    // Validate Miller loop output
    assert_o1js_mlo(mlo);

    // Compute
    let (shift_pow, c) = compute_aux_witness(mlo);

    // Return
    let c_serialized = serialize_fq12(c);
    let aux_witness = AuxWitness {
        c: c_serialized,
        shift_power: shift_pow.to_string(),
    };

    to_value(&aux_witness).map_err(|e| JsError::new(&format!("compute_and_serialize_aux_witness_js: failed to serialize result: {}", e)))
}

/// Computes a pairing for a verification key.
///
/// # What This Does
///
/// Takes two curve points (alpha and beta from the trusted setup) and computes
/// their pairing using the Miller loop algorithm. The result is a 12-element
/// field value that gets stored in the verification key.
///
/// This pairing e(alpha, beta) is constant for a given verification key, so it's
/// precomputed once and reused for all proof verifications.
///
/// # Input
///
/// A JS object matching [`PairingInput`] structure:
/// - `alpha`: An [`AffinePoint2d`] with `x` and `y` fields
/// - `beta`: A [`ComplexAffinePoint2d`] with `x_c0`, `x_c1`, `y_c0`, `y_c1` fields
///
/// # Output
///
/// A JS object matching [`Field12`] structure (12 string fields: g00-g21, h00-h21).
///
/// # Errors
///
/// Returns a JS error if input parsing or coordinate conversion fails.
#[wasm_bindgen]
pub fn compute_pairing_js(input: JsValue) -> Result<JsValue, JsError> {
    let data = PairingInput::from_js(input)
        .map_err(|e| JsError::new(&format!("compute_pairing_js: {}", e)))?;

    let (alpha, beta) = data.to_pairing_points()
        .map_err(|e| JsError::new(&format!("compute_pairing_js: {}", e)))?;

    // Perform the multi-miller loop
    let alpha_beta = Bn254::multi_miller_loop(&[alpha], &[beta]).0;

    // Serialize the Fq12 result
    let serialized = serialize_fq12(alpha_beta);

    to_value(&serialized).map_err(|e| JsError::new(&format!("compute_pairing_js: failed to serialize result: {}", e)))
}

/// Converts a snarkjs Groth16 proof and verification key to o1js format.
///
/// # What This Does
///
/// This is a holistic conversion function that takes snarkjs-formatted inputs
/// and produces o1js-formatted outputs ready for verification in Mina.
///
/// The conversion includes:
/// - **Proof conversion**: Negates pi_a (required for o1js verification equation),
///   converts B and C points to affine form
/// - **VK conversion**: Converts all curve points, computes the alpha-beta pairing
///   e(α, β), and adds the hardcoded w27 root of unity
/// - **Validation**: Ensures nPublic matches public inputs count, IC count is correct
///
/// # Input
///
/// - `proof`: snarkjs proof object with `pi_a`, `pi_b`, `pi_c` in projective form
/// - `public_inputs`: Array of public input strings (e.g., `["123", "456"]`)
/// - `vk`: snarkjs verification key with `nPublic`, `vk_alpha_1`, `vk_beta_2`, etc.
///
/// # Output
///
/// A [`O1jsGroth16`] object containing:
/// - `proof`: o1js proof with `negA`, `B`, `C`, `pi1`-`pi6`
/// - `vk`: o1js VK with `alpha`, `beta`, `gamma`, `delta`, `alpha_beta`, `w27`, `ic0`-`ic6`
///
/// # Errors
///
/// Returns an error if:
/// - Input parsing fails
/// - VK validation fails (nPublic mismatch, wrong IC count)
/// - Point coordinate parsing fails
/// - More than 6 public inputs provided
#[wasm_bindgen]
pub fn convert_snarkjs_to_o1js_js(
    proof: JsValue,
    public_inputs: JsValue,
    vk: JsValue,
) -> Result<JsValue, JsError> {
    // Parse inputs
    let snarkjs_proof = SnarkjsProof::from_js(proof)
        .map_err(|e| JsError::new(&format!("convert_snarkjs_to_o1js_js: {}", e)))?;

    let public_inputs_vec: Vec<String> = from_value(public_inputs)
        .map_err(|e| JsError::new(&format!("convert_snarkjs_to_o1js_js: public_inputs: {}", e)))?;

    let snarkjs_vk = SnarkjsVK::from_js(vk)
        .map_err(|e| JsError::new(&format!("convert_snarkjs_to_o1js_js: {}", e)))?;

    // Validate VK against public inputs
    snarkjs_vk.validate(public_inputs_vec.len())
        .map_err(|e| JsError::new(&format!("convert_snarkjs_to_o1js_js: {}", e)))?;

    // Convert proof
    let o1js_proof = O1jsProof::from_snarkjs(&snarkjs_proof, &public_inputs_vec)
        .map_err(|e| JsError::new(&format!("convert_snarkjs_to_o1js_js: {}", e)))?;

    // Convert VK
    let o1js_vk = O1jsVK::from_snarkjs(&snarkjs_vk)
        .map_err(|e| JsError::new(&format!("convert_snarkjs_to_o1js_js: {}", e)))?;

    // Return both
    let result = O1jsGroth16 {
        proof: o1js_proof,
        vk: o1js_vk,
    };

    to_value(&result).map_err(|e| JsError::new(&format!("convert_snarkjs_to_o1js_js: failed to serialize result: {}", e)))
}

/// Converts an SP1 Groth16 proof to o1js format.
///
/// # What This Does
///
/// This is a holistic conversion function that takes an SP1 proof (in JSON format)
/// and produces o1js-formatted outputs ready for verification in Mina.
///
/// The conversion includes:
/// - **Proof extraction**: Extracts gnark-formatted proof bytes from the SP1 proof
/// - **Proof decompression**: Decompresses gnark format to arkworks format
/// - **Proof conversion**: Negates A point, converts to o1js format
/// - **VK conversion**: Uses embedded SP1 v5.0.0 verification key
///
/// # Input
///
/// - `sp1_proof`: SP1ProofWithPublicValues JSON object containing:
///   - `proof`: SP1Proof with `Groth16` variant containing `encoded_proof`, `public_inputs`
///   - `public_values`: SP1PublicValues
///   - `sp1_version`: Version string
///
/// # Output
///
/// A [`O1jsGroth16`] object containing:
/// - `proof`: o1js proof with `negA`, `B`, `C`, `pi1`, `pi2`
/// - `vk`: o1js VK with `alpha`, `beta`, `gamma`, `delta`, `alpha_beta`, `w27`, `ic0`-`ic2`
///
/// # Errors
///
/// Returns an error if:
/// - Input parsing fails
/// - Proof is not Groth16 variant
/// - Hex decoding of encoded_proof fails
/// - gnark decompression fails
#[wasm_bindgen]
pub fn convert_sp1_to_o1js_js(sp1_proof: JsValue) -> Result<JsValue, JsError> {
    // Parse SP1 proof from JSON
    let sp1 = SP1ProofWithPublicValues::from_js(sp1_proof)
        .map_err(|e| JsError::new(&format!("convert_sp1_to_o1js_js: {}", e)))?;

    // Get the Groth16 proof
    let groth16_proof = sp1.proof.try_as_groth_16()
        .ok_or_else(|| JsError::new("convert_sp1_to_o1js_js: proof is not Groth16 variant"))?;

    // Get proof bytes (this hex-decodes encoded_proof and prepends vkey hash)
    let proof_bytes = sp1.bytes();
    if proof_bytes.is_empty() {
        return Err(JsError::new("convert_sp1_to_o1js_js: empty proof (mock proof not supported)"));
    }

    // Skip the first 4 bytes (vkey hash prefix) and load arkworks proof
    let ark_proof = load_ark_proof_from_bytes(&proof_bytes[4..])
        .map_err(|e| JsError::new(&format!("convert_sp1_to_o1js_js: failed to load proof: {}", e)))?;

    // Load the embedded SP1 v5.0.0 verification key
    let ark_vk = load_ark_groth16_verifying_key_from_bytes(GROTH16_VK_5_0_0_BYTES)
        .map_err(|e| JsError::new(&format!("convert_sp1_to_o1js_js: failed to load VK: {}", e)))?;

    // Convert proof to o1js format
    let public_inputs: Vec<String> = groth16_proof.public_inputs.to_vec();
    let o1js_proof = O1jsProof::from_groth16(&ark_proof, &public_inputs)
        .map_err(|e| JsError::new(&format!("convert_sp1_to_o1js_js: {}", e)))?;

    // Convert VK to o1js format
    let o1js_vk = O1jsVK::from_groth16(&ark_vk)
        .map_err(|e| JsError::new(&format!("convert_sp1_to_o1js_js: {}", e)))?;

    // Return both
    let result = O1jsGroth16 {
        proof: o1js_proof,
        vk: o1js_vk,
    };

    to_value(&result).map_err(|e| JsError::new(&format!("convert_sp1_to_o1js_js: failed to serialize result: {}", e)))
}
