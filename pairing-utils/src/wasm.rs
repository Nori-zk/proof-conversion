use crate::{kzg::{assert_o1js_mlo, compute_aux_witness}, serialize::{serialize_fq12, Field12}};
use ark_bn254::{Bn254, Fq, Fq12, Fq2, Fq6, G1Affine, G2Affine};
use ark_ec::pairing::Pairing;
use serde::{Deserialize, Serialize};
use serde_tuple::{Deserialize_tuple, Serialize_tuple};
use serde_wasm_bindgen::{from_value, to_value};
use std::str::FromStr;
use wasm_bindgen::{prelude::*, JsError};

/// JS representation of the arkworks `Fq12` type.
///
/// A 12-element field value used as the output of pairing computations.
/// Converts to/from arkworks `Fq12`.
///
/// Structure: Two groups `g` and `h`, each containing 3 complex number pairs.
/// - `g` = [(g00, g01), (g10, g11), (g20, g21)]
/// - `h` = [(h00, h01), (h10, h11), (h20, h21)]
///
/// Naming convention: `{group}{pair}{component}`
/// - group: `g` or `h`
/// - pair: `0`, `1`, or `2` (which pair within the group)
/// - component: `0` (real) or `1` (imaginary)
///
/// Used for pairing outputs like `alpha_beta` and `w27` in verification keys.
/// Each component is a decimal string representing a large integer (BigInt in JS).
#[derive(Serialize, Deserialize, Debug)]
pub struct Fq12JSValue {
    pub g00: String,
    pub g01: String,
    pub g10: String,
    pub g11: String,
    pub g20: String,
    pub g21: String,
    pub h00: String,
    pub h01: String,
    pub h10: String,
    pub h11: String,
    pub h20: String,
    pub h21: String,
}

impl Fq12JSValue {
    /// Parses from a JavaScript value into `Fq12JSValue`.
    ///
    /// # Errors
    ///
    /// Returns an error if the JsValue doesn't match the expected structure.
    pub fn from_js(js: JsValue) -> Result<Self, String> {
        from_value(js).map_err(|e| format!("Fq12JSValue <- JsValue: {}", e))
    }

    /// Converts to arkworks `Fq12` type.
    ///
    /// # Field Tower Structure
    ///
    /// The 12 values form a "tower" of field extensions:
    /// - **Fq**: A single 254-bit integer (the base field)
    /// - **Fq2**: Two Fq values (real + imaginary)
    /// - **Fq6**: Three Fq2 values
    /// - **Fq12**: Two Fq6 values (`g` and `h` in our serialization)
    ///
    /// So: Fq12 = 2 × Fq6 = 2 × 3 × Fq2 = 12 base field elements.
    ///
    /// # Errors
    ///
    /// Returns an error if any string cannot be parsed as a valid field element.
    pub fn to_fq12(&self) -> Result<Fq12, String> {
        let parse_fq = |s: &str| -> Result<Fq, String> {
            Fq::from_str(s).map_err(|_| format!("not a valid Fq '{}'", s))
        };

        let g00 = parse_fq(&self.g00).map_err(|e| format!("Fq12JSValue -> Fq12: g00: {}", e))?;
        let g01 = parse_fq(&self.g01).map_err(|e| format!("Fq12JSValue -> Fq12: g01: {}", e))?;
        let g0 = Fq2::new(g00, g01);

        let g10 = parse_fq(&self.g10).map_err(|e| format!("Fq12JSValue -> Fq12: g10: {}", e))?;
        let g11 = parse_fq(&self.g11).map_err(|e| format!("Fq12JSValue -> Fq12: g11: {}", e))?;
        let g1 = Fq2::new(g10, g11);

        let g20 = parse_fq(&self.g20).map_err(|e| format!("Fq12JSValue -> Fq12: g20: {}", e))?;
        let g21 = parse_fq(&self.g21).map_err(|e| format!("Fq12JSValue -> Fq12: g21: {}", e))?;
        let g2 = Fq2::new(g20, g21);

        let g = Fq6::new(g0, g1, g2);

        let h00 = parse_fq(&self.h00).map_err(|e| format!("Fq12JSValue -> Fq12: h00: {}", e))?;
        let h01 = parse_fq(&self.h01).map_err(|e| format!("Fq12JSValue -> Fq12: h01: {}", e))?;
        let h0 = Fq2::new(h00, h01);

        let h10 = parse_fq(&self.h10).map_err(|e| format!("Fq12JSValue -> Fq12: h10: {}", e))?;
        let h11 = parse_fq(&self.h11).map_err(|e| format!("Fq12JSValue -> Fq12: h11: {}", e))?;
        let h1 = Fq2::new(h10, h11);

        let h20 = parse_fq(&self.h20).map_err(|e| format!("Fq12JSValue -> Fq12: h20: {}", e))?;
        let h21 = parse_fq(&self.h21).map_err(|e| format!("Fq12JSValue -> Fq12: h21: {}", e))?;
        let h2 = Fq2::new(h20, h21);

        let h = Fq6::new(h0, h1, h2);

        Ok(Fq12::new(g, h))
    }
}

/// Auxiliary witness for pairing verification.
///
/// When verifying zero-knowledge proofs, we compute "pairings" - a mathematical
/// operation that combines curve points and produces a 12-element field value.
/// This pairing result needs a "final exponentiation" step to complete verification.
///
/// The auxiliary witness provides precomputed hints that make this step efficient:
///
/// - `c`: A 12-element field value. When raised to a specific power and combined
///   with the pairing result, it produces the expected output.
///
/// - `shift_power`: A small integer (0, 1, or 2) indicating which "shift factor" to use.
///   The shift factor is a power of w27, which is a special constant (a 27th root of unity)
///   that adjusts the computation to find a valid solution.
///
/// Together, `c` and `shift_power` allow verification to succeed without expensive
/// computation at verification time.
///
/// Computed from a Miller loop output via [`compute_and_serialize_aux_witness_js`].
#[derive(Serialize, Deserialize, Debug)]
pub struct AuxWitnessJSValue {
    c: Field12,
    shift_power: String,
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
/// A JS object matching [`Fq12JSValue`] structure (12 string fields: g00-g21, h00-h21).
///
/// # Output
///
/// A JS object matching [`AuxWitnessJSValue`] structure containing:
/// - `c`: A 12-element field value
/// - `shift_power`: "0", "1", or "2"
///
/// # Panics
///
/// Panics if the input is not a valid Miller loop output (fails internal assertion).
#[wasm_bindgen]
pub fn compute_and_serialize_aux_witness_js(input: JsValue) -> Result<JsValue, JsError> {
    let f12 = Fq12JSValue::from_js(input)
        .map_err(|e| JsError::new(&format!("compute_and_serialize_aux_witness_js: {}", e)))?;

    let mlo = f12.to_fq12()
        .map_err(|e| JsError::new(&format!("compute_and_serialize_aux_witness_js: {}", e)))?;

    // Validate Miller loop output
    assert_o1js_mlo(mlo);

    // Compute
    let (shift_pow, c) = compute_aux_witness(mlo);

    // Return
    let c_serialized = serialize_fq12(c);
    let aux_witness = AuxWitnessJSValue {
        c: c_serialized,
        shift_power: shift_pow.to_string(),
    };

    to_value(&aux_witness).map_err(|e| JsError::new(&format!("compute_and_serialize_aux_witness_js: failed to serialize result: {}", e)))
}

/// A 2D affine point with x and y coordinates.
///
/// Each coordinate is a decimal string representing a large integer (BigInt in JS).
/// For example, 254-bit integers when using the BN254 curve.
///
/// Used for G1 curve points in affine form (no z coordinate).
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AffinePoint2d {
    pub x: String,
    pub y: String,
}

impl AffinePoint2d {
    /// Converts to arkworks `G1Affine` type.
    ///
    /// - `x` → `Fq` (x coordinate)
    /// - `y` → `Fq` (y coordinate)
    ///
    /// # Errors
    ///
    /// Returns an error if x or y cannot be parsed as valid `Fq` field elements.
    pub fn to_g1_affine(&self) -> Result<G1Affine, String> {
        let x = Fq::from_str(&self.x)
            .map_err(|_| format!("AffinePoint2d -> G1Affine: x: not a valid Fq '{}'", self.x))?;
        let y = Fq::from_str(&self.y)
            .map_err(|_| format!("AffinePoint2d -> G1Affine: y: not a valid Fq '{}'", self.y))?;
        Ok(G1Affine::new(x, y))
    }

    /// Creates from arkworks `G1Affine` type.
    ///
    /// - `Fq` (x coordinate) → `x`
    /// - `Fq` (y coordinate) → `y`
    pub fn from_g1_affine(point: &G1Affine) -> Self {
        use ark_ff::PrimeField;
        Self {
            x: point.x.into_bigint().to_string(),
            y: point.y.into_bigint().to_string(),
        }
    }
}

/// A 2D affine point with complex coordinates (each coordinate has real and imaginary parts).
///
/// x = (x_c0, x_c1) and y = (y_c0, y_c1), where c0 is real and c1 is imaginary.
/// Each component is a decimal string representing a large integer (BigInt in JS).
/// For example, 254-bit integers when using the BN254 curve.
///
/// Used for G2 curve points in affine form (no z coordinate).
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ComplexAffinePoint2d {
    pub x_c0: String,
    pub x_c1: String,
    pub y_c0: String,
    pub y_c1: String,
}

impl ComplexAffinePoint2d {
    /// Converts to arkworks `G2Affine` type.
    ///
    /// - `(x_c0, x_c1)` → `Fq2` (x coordinate)
    /// - `(y_c0, y_c1)` → `Fq2` (y coordinate)
    ///
    /// # Errors
    ///
    /// Returns an error if any component cannot be parsed as a valid `Fq` field element.
    pub fn to_g2_affine(&self) -> Result<G2Affine, String> {
        let x_c0 = Fq::from_str(&self.x_c0)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: x_c0: not a valid Fq '{}'", self.x_c0))?;
        let x_c1 = Fq::from_str(&self.x_c1)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: x_c1: not a valid Fq '{}'", self.x_c1))?;
        let y_c0 = Fq::from_str(&self.y_c0)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: y_c0: not a valid Fq '{}'", self.y_c0))?;
        let y_c1 = Fq::from_str(&self.y_c1)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: y_c1: not a valid Fq '{}'", self.y_c1))?;

        let x = Fq2::new(x_c0, x_c1);
        let y = Fq2::new(y_c0, y_c1);

        Ok(G2Affine::new(x, y))
    }

    /// Creates from arkworks `G2Affine` type.
    ///
    /// - `Fq2` (x coordinate) → `(x_c0, x_c1)`
    /// - `Fq2` (y coordinate) → `(y_c0, y_c1)`
    pub fn from_g2_affine(point: &G2Affine) -> Self {
        use ark_ff::PrimeField;
        Self {
            x_c0: point.x.c0.into_bigint().to_string(),
            x_c1: point.x.c1.into_bigint().to_string(),
            y_c0: point.y.c0.into_bigint().to_string(),
            y_c1: point.y.c1.into_bigint().to_string(),
        }
    }
}

/// A projective point with x, y, z coordinates.
///
/// Each coordinate is a decimal string representing a large integer (BigInt in JS).
/// For example, 254-bit integers when using the BN254 curve.
///
/// Used for G1 curve points in projective form as output by snarkjs.
/// Deserializes from array format: `["x", "y", "z"]`.
#[derive(Serialize_tuple, Deserialize_tuple, Debug, Clone)]
pub struct ProjectivePoint {
    pub x: String,
    pub y: String,
    pub z: String,
}

impl ProjectivePoint {
    /// Converts to arkworks `G1Affine` type.
    ///
    /// - `x` → `Fq` (x coordinate)
    /// - `y` → `Fq` (y coordinate)
    /// - `z` is discarded (snarkjs typically outputs z=1)
    ///
    /// # Errors
    ///
    /// Returns an error if x or y cannot be parsed as valid `Fq` field elements.
    pub fn to_g1_affine(&self) -> Result<G1Affine, String> {
        let x = Fq::from_str(&self.x)
            .map_err(|_| format!("ProjectivePoint -> G1Affine: x: not a valid Fq '{}'", self.x))?;
        let y = Fq::from_str(&self.y)
            .map_err(|_| format!("ProjectivePoint -> G1Affine: y: not a valid Fq '{}'", self.y))?;
        Ok(G1Affine::new(x, y))
    }

    /// Converts to `AffinePoint2d` (extracts x and y, discards z).
    ///
    /// This is a string-level conversion, no arkworks parsing involved.
    pub fn to_affine_2d(&self) -> AffinePoint2d {
        AffinePoint2d {
            x: self.x.clone(),
            y: self.y.clone(),
        }
    }
}

/// A projective point with complex coordinates.
///
/// Each coordinate has real (c0) and imaginary (c1) parts.
/// Each component is a decimal string representing a large integer (BigInt in JS).
///
/// Used for G2 curve points in projective form as output by snarkjs.
/// Deserializes from nested array format: `[[x_c0, x_c1], [y_c0, y_c1], [z_c0, z_c1]]`.
#[derive(Serialize_tuple, Deserialize_tuple, Debug, Clone)]
pub struct ComplexProjectivePoint {
    pub x: (String, String),
    pub y: (String, String),
    pub z: (String, String),
}

impl ComplexProjectivePoint {
    /// Converts to arkworks `G2Affine` type.
    ///
    /// - `(x.0, x.1)` → `Fq2` (x coordinate)
    /// - `(y.0, y.1)` → `Fq2` (y coordinate)
    /// - `z` is discarded (snarkjs typically outputs z=1)
    ///
    /// # Errors
    ///
    /// Returns an error if any component cannot be parsed as a valid `Fq` field element.
    pub fn to_g2_affine(&self) -> Result<G2Affine, String> {
        let x_c0 = Fq::from_str(&self.x.0)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: x.0: not a valid Fq '{}'", self.x.0))?;
        let x_c1 = Fq::from_str(&self.x.1)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: x.1: not a valid Fq '{}'", self.x.1))?;
        let y_c0 = Fq::from_str(&self.y.0)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: y.0: not a valid Fq '{}'", self.y.0))?;
        let y_c1 = Fq::from_str(&self.y.1)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: y.1: not a valid Fq '{}'", self.y.1))?;

        let x = Fq2::new(x_c0, x_c1);
        let y = Fq2::new(y_c0, y_c1);

        Ok(G2Affine::new(x, y))
    }

    /// Converts to `ComplexAffinePoint2d` (extracts x and y, discards z).
    ///
    /// This is a string-level conversion, no arkworks parsing involved.
    pub fn to_affine_2d(&self) -> ComplexAffinePoint2d {
        ComplexAffinePoint2d {
            x_c0: self.x.0.clone(),
            x_c1: self.x.1.clone(),
            y_c0: self.y.0.clone(),
            y_c1: self.y.1.clone(),
        }
    }
}

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
    pub fn to_pairing_points(&self) -> Result<(G1Affine, G2Affine), String> {
        let g1 = self.alpha.to_g1_affine()
            .map_err(|e| format!("PairingInput -> (G1Affine, G2Affine): alpha: {}", e))?;
        let g2 = self.beta.to_g2_affine()
            .map_err(|e| format!("PairingInput -> (G1Affine, G2Affine): beta: {}", e))?;
        Ok((g1, g2))
    }
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
/// A JS object matching [`Fq12JSValue`] structure (12 string fields: g00-g21, h00-h21).
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

    let result = Fq12JSValue {
        g00: serialized.g00,
        g01: serialized.g01,
        g10: serialized.g10,
        g11: serialized.g11,
        g20: serialized.g20,
        g21: serialized.g21,
        h00: serialized.h00,
        h01: serialized.h01,
        h10: serialized.h10,
        h11: serialized.h11,
        h20: serialized.h20,
        h21: serialized.h21,
    };

    to_value(&result).map_err(|e| JsError::new(&format!("compute_pairing_js: failed to serialize result: {}", e)))
}

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
    /// Converts from `SnarkjsProof` format with the given public inputs.
    ///
    /// - `pi_a` is negated to produce `negA` (arkworks `G1Affine` negation)
    /// - `pi_b` → `B` (converted to `ComplexAffinePoint2d`)
    /// - `pi_c` → `C` (converted to `AffinePoint2d`)
    ///
    /// # Arguments
    ///
    /// - `proof`: The snarkjs-formatted proof
    /// - `public_inputs`: The public inputs (max 6 supported)
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - More than 6 public inputs are provided
    /// - Any point coordinate cannot be parsed as a valid `Fq` field element
    pub fn from_snarkjs(proof: &SnarkjsProof, public_inputs: &[String]) -> Result<Self, String> {
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
    /// Converts from `SnarkjsVK` format.
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
    pub fn from_snarkjs(vk: &SnarkjsVK) -> Result<Self, String> {
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
}