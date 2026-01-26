//! WebAssembly bindings for pairing-utils.
//!
//! This module provides wasm-bindgen exported functions for use from JavaScript.

use ark_bn254::Bn254;
use ark_ec::pairing::Pairing;
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::{from_value, to_value};
use wasm_bindgen::{prelude::*, JsError};

use crate::kzg::{assert_o1js_mlo, compute_aux_witness};
use crate::o1js::O1jsGroth16;
use crate::serialize::{serialize_fq12, AuxWitness, Field12};
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

/// Converts a snarkjs/circom Groth16 proof and verification key to o1js format.
///
/// This function takes Groth16 proofs generated by snarkjs (the JavaScript implementation
/// of Groth16 commonly used with circom circuits) and converts them to o1js format for
/// verification in Mina Protocol zkApps.
///
/// # Conversion Details
///
/// ## Proof Conversion
/// - The A point (`pi_a`) is **negated** for o1js compatibility. The o1js verification
///   equation uses `-A` rather than `A` in the pairing check.
/// - Points are converted from projective coordinates (with z component) to affine form.
/// - The B point is a G2 point with complex coordinates (x_c0, x_c1, y_c0, y_c1).
/// - The C point is a G1 point with simple coordinates (x, y).
///
/// ## Verification Key Conversion
/// - All curve points are converted from projective to affine form.
/// - The `alpha_beta` pairing e(α, β) is computed using arkworks `multi_miller_loop`.
///   This is a constant for each VK and is precomputed to save verification time.
/// - A hardcoded `w27` (27th root of unity) is added for pairing optimizations.
///   See https://eprint.iacr.org/2024/640 for the optimization technique.
/// - IC (input commitment) points are mapped to ic0-ic6 fields.
///
/// ## Validation
/// - The `nPublic` field in the VK must match the number of public inputs provided.
/// - The IC array length must equal nPublic + 1 (ic0 is the constant term).
///
/// # Input Format
///
/// - `proof`: snarkjs proof JSON object with:
///   - `pi_a`: `[x, y, z]` - A point in G1 projective coordinates
///   - `pi_b`: `[[x_c0, x_c1], [y_c0, y_c1], [z_c0, z_c1]]` - B point in G2 projective
///   - `pi_c`: `[x, y, z]` - C point in G1 projective coordinates
///
/// - `public_inputs`: Array of public input strings as decimal numbers, e.g., `["123", "456"]`.
///   Maximum 6 public inputs are supported.
///
/// - `vk`: snarkjs verification key JSON object with:
///   - `nPublic`: Number of public inputs
///   - `vk_alpha_1`: Alpha point (G1 projective)
///   - `vk_beta_2`: Beta point (G2 projective)
///   - `vk_gamma_2`: Gamma point (G2 projective)
///   - `vk_delta_2`: Delta point (G2 projective)
///   - `IC`: Array of IC points (G1 projective), length = nPublic + 1
///
/// # Output Format
///
/// Returns an [`O1jsGroth16`] object containing:
///
/// - `proof`: o1js-formatted proof with:
///   - `negA`: Negated A point `{x, y}` as decimal strings
///   - `B`: B point `{x_c0, x_c1, y_c0, y_c1}` as decimal strings
///   - `C`: C point `{x, y}` as decimal strings
///   - `pi1` through `pi6`: Public inputs (only present if provided)
///
/// - `vk`: o1js-formatted verification key with:
///   - `alpha`, `beta`, `gamma`, `delta`: Curve points
///   - `alpha_beta`: Precomputed pairing as 12-element Fq12 field
///   - `w27`: 27th root of unity as 12-element Fq12 field
///   - `ic0` through `ic6`: Input commitment points (only present if in VK)
///
/// # Errors
///
/// Returns an error if:
/// - Input JSON parsing fails (invalid structure or types)
/// - VK validation fails (`nPublic` doesn't match public inputs count, wrong IC length)
/// - Point coordinate parsing fails (invalid field element strings)
/// - More than 6 public inputs are provided
#[wasm_bindgen]
pub fn convert_snarkjs_groth16_to_o1js_js(
    proof: JsValue,
    public_inputs: JsValue,
    vk: JsValue,
) -> Result<JsValue, JsError> {
    // Parse snarkjs proof from JavaScript object
    let snarkjs_proof = SnarkjsProof::from_js(proof)
        .map_err(|e| JsError::new(&format!("convert_snarkjs_groth16_to_o1js_js: {}", e)))?;

    // Parse public inputs array
    let public_inputs_vec: Vec<String> = from_value(public_inputs)
        .map_err(|e| JsError::new(&format!("convert_snarkjs_groth16_to_o1js_js: public_inputs: {}", e)))?;

    // Parse snarkjs verification key from JavaScript object
    let snarkjs_vk = SnarkjsVK::from_js(vk)
        .map_err(|e| JsError::new(&format!("convert_snarkjs_groth16_to_o1js_js: {}", e)))?;

    // Validate VK nPublic matches provided public inputs count
    snarkjs_vk.validate(public_inputs_vec.len())
        .map_err(|e| JsError::new(&format!("convert_snarkjs_groth16_to_o1js_js: {}", e)))?;

    // Convert proof to o1js format (negates A point, converts to affine) and VK to o1js format 
    // (computes alpha_beta pairing, adds w27)
    let result = O1jsGroth16::from_snarkjs_groth16(&snarkjs_vk, &snarkjs_proof, &public_inputs_vec)
        .map_err(|e| JsError::new(&format!("convert_snarkjs_groth16_to_o1js_js: {}", e)))?;

    to_value(&result).map_err(|e| JsError::new(&format!("convert_snarkjs_groth16_to_o1js_js: failed to serialize result: {}", e)))
}

/// Converts an SP1 Groth16 proof to o1js format.
///
/// This function takes Groth16 proofs generated by SP1 (Succinct's zkVM) and converts
/// them to o1js format for verification in Mina Protocol zkApps. SP1 uses gnark's
/// Groth16 implementation internally, which produces proofs in a compressed format
/// that must be decompressed before conversion.
///
/// # Conversion Details
///
/// ## Proof Extraction & Decompression
/// - The `encoded_proof` field contains hex-encoded gnark proof bytes.
/// - The first 4 bytes of the proof are a vkey hash prefix (skipped during parsing).
/// - gnark uses a compressed point format that differs from arkworks. This function
///   decompresses G1 and G2 points using endianness conversion and flag translation.
/// - The decompression follows the gnark → arkworks conversion from sp1-sui.
///
/// ## Proof Conversion
/// - The A point is **negated** for o1js compatibility. The o1js verification
///   equation uses `-A` rather than `A` in the pairing check.
/// - SP1 Groth16 proofs have exactly 2 public inputs (vkey_hash and public_values_hash).
///
/// ## Verification Key
/// - All SP1 v5.0.0 Groth16 proofs use the **same verification key**. This VK is
///   embedded in the library (`GROTH16_VK_5_0_0_BYTES`) and loaded automatically.
/// - The VK is decompressed from gnark format to arkworks format.
/// - The `alpha_beta` pairing e(α, β) is computed and included in the output.
/// - The hardcoded `w27` (27th root of unity) is added for pairing optimizations.
///
/// # Input Format
///
/// - `sp1_proof`: SP1ProofWithPublicValues JSON shim object representation
/// - FIXME write an example here!
///
/// # Output Format
///
/// Returns an [`O1jsGroth16`] object containing:
///
/// - `proof`: o1js-formatted proof with:
///   - `negA`: Negated A point `{x, y}` as decimal strings
///   - `B`: B point `{x_c0, x_c1, y_c0, y_c1}` as decimal strings
///   - `C`: C point `{x, y}` as decimal strings
///   - `pi1`: First public input (vkey_hash)
///   - `pi2`: Second public input (public_values_hash)
///
/// - `vk`: o1js-formatted SP1 v5.0.0 verification key with:
///   - `alpha`, `beta`, `gamma`, `delta`: Curve points
///   - `alpha_beta`: Precomputed pairing as 12-element Fq12 field
///   - `w27`: 27th root of unity as 12-element Fq12 field
///   - `ic0`, `ic1`, `ic2`: Input commitment points (SP1 VK has 3 IC points)
///
/// # Errors
///
/// Returns an error if:
/// - Input JSON parsing fails (invalid structure or types)
/// - Proof is not the `Groth16` variant (e.g., it's a PLONK proof)
/// - Proof is empty (mock proof - not supported)
/// - Hex decoding of `encoded_proof` fails
/// - gnark point decompression fails (invalid curve points)
#[wasm_bindgen]
pub fn convert_sp1_groth16_to_o1js_js(sp1_proof: JsValue) -> Result<JsValue, JsError> {
    // Parse SP1 proof from JavaScript JSON object
    let sp1 = SP1ProofWithPublicValues::from_js(sp1_proof)
        .map_err(|e| JsError::new(&format!("convert_sp1_groth16_to_o1js_js: {}", e)))?;

    // Convert to o1js format (extracts proof bytes, decompresses gnark format, negates A)
    let result = O1jsGroth16::from_sp1_groth16(&sp1)
        .map_err(|e| JsError::new(&format!("convert_sp1_groth16_to_o1js_js: {}", e)))?;

    to_value(&result).map_err(|e| JsError::new(&format!("convert_sp1_groth16_to_o1js_js: failed to serialize result: {}", e)))
}
