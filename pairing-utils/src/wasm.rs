use crate::{kzg::{assert_o1js_mlo, compute_aux_witness}, serialize::{serialize_fq12, Field12}};
use ark_bn254::{Bn254, Fq, Fq12, Fq2, Fq6, G1Affine, G2Affine};
use ark_ec::pairing::Pairing;
use serde::{Deserialize, Serialize};
use serde_tuple::{Deserialize_tuple, Serialize_tuple};
use serde_wasm_bindgen::{from_value, to_value};
use std::{collections::HashMap, str::FromStr};
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
        let parse_fq = |s: &str, name: &str| -> Result<Fq, String> {
            Fq::from_str(s).map_err(|_| format!("Fq12JSValue -> Fq12: {} is not a valid Fq '{}'", name, s))
        };

        let g00 = parse_fq(&self.g00, "g00")?;
        let g01 = parse_fq(&self.g01, "g01")?;
        let g0 = Fq2::new(g00, g01);

        let g10 = parse_fq(&self.g10, "g10")?;
        let g11 = parse_fq(&self.g11, "g11")?;
        let g1 = Fq2::new(g10, g11);

        let g20 = parse_fq(&self.g20, "g20")?;
        let g21 = parse_fq(&self.g21, "g21")?;
        let g2 = Fq2::new(g20, g21);

        let g = Fq6::new(g0, g1, g2);

        let h00 = parse_fq(&self.h00, "h00")?;
        let h01 = parse_fq(&self.h01, "h01")?;
        let h0 = Fq2::new(h00, h01);

        let h10 = parse_fq(&self.h10, "h10")?;
        let h11 = parse_fq(&self.h11, "h11")?;
        let h1 = Fq2::new(h10, h11);

        let h20 = parse_fq(&self.h20, "h20")?;
        let h21 = parse_fq(&self.h21, "h21")?;
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
            .map_err(|_| format!("AffinePoint2d -> G1Affine: x is not a valid Fq '{}'", self.x))?;
        let y = Fq::from_str(&self.y)
            .map_err(|_| format!("AffinePoint2d -> G1Affine: y is not a valid Fq '{}'", self.y))?;
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
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: x_c0 is not a valid Fq '{}'", self.x_c0))?;
        let x_c1 = Fq::from_str(&self.x_c1)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: x_c1 is not a valid Fq '{}'", self.x_c1))?;
        let y_c0 = Fq::from_str(&self.y_c0)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: y_c0 is not a valid Fq '{}'", self.y_c0))?;
        let y_c1 = Fq::from_str(&self.y_c1)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: y_c1 is not a valid Fq '{}'", self.y_c1))?;

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
            .map_err(|_| format!("ProjectivePoint -> G1Affine: x is not a valid Fq '{}'", self.x))?;
        let y = Fq::from_str(&self.y)
            .map_err(|_| format!("ProjectivePoint -> G1Affine: y is not a valid Fq '{}'", self.y))?;
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
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: x.0 is not a valid Fq '{}'", self.x.0))?;
        let x_c1 = Fq::from_str(&self.x.1)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: x.1 is not a valid Fq '{}'", self.x.1))?;
        let y_c0 = Fq::from_str(&self.y.0)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: y.0 is not a valid Fq '{}'", self.y.0))?;
        let y_c1 = Fq::from_str(&self.y.1)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: y.1 is not a valid Fq '{}'", self.y.1))?;

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
            .map_err(|e| format!("PairingInput -> (G1Affine, G2Affine): {}", e))?;
        let g2 = self.beta.to_g2_affine()
            .map_err(|e| format!("PairingInput -> (G1Affine, G2Affine): {}", e))?;
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
struct SnarkjsVK {
    #[serde(rename = "nPublic")]
    n_public: usize,
    vk_alpha_1: ProjectivePoint,
    vk_beta_2: ComplexProjectivePoint,
    vk_gamma_2: ComplexProjectivePoint,
    vk_delta_2: ComplexProjectivePoint,
    #[serde(rename = "IC")]
    ic: Vec<ProjectivePoint>,
}

/// Groth16 proof in o1js format.
///
/// Contains the three proof curve points plus public inputs:
/// - `negA`: Negated A point (negation applied for verification equation)
/// - `B`: B point (simple coordinates, though mathematically it's a complex point)
/// - `C`: C point
/// - `public_inputs`: The public inputs (pi1, pi2, etc.) as a flat map
#[derive(Serialize, Debug)]
struct O1jsProof {
    #[serde(rename = "negA")]
    neg_a: AffinePoint2d,
    #[serde(rename = "B")]
    b: AffinePoint2d,
    #[serde(rename = "C")]
    c: AffinePoint2d,
    #[serde(flatten)]
    public_inputs: HashMap<String, String>,
}

/// Groth16 verification key in o1js format.
///
/// Contains the verification key parameters needed for proof verification:
///
/// - `delta`, `gamma`: Curve points from the trusted setup (complex coordinates)
/// - `alpha_beta`: Precomputed pairing e(alpha, beta) as a 12-element field value
/// - `w27`: A 27th root of unity used for pairing optimizations
/// - `ic0` through `ic6`: Input commitment points for public input verification.
///   `ic0` is always present (the constant term). `ic1`-`ic6` are optional based on
///   how many public inputs the circuit has (max 6 supported).
///
/// The Groth16 verification equation uses: `PI = ic0 + Σ(public_input[i] * ic[i+1])`
#[derive(Serialize, Debug)]
struct O1jsVK {
    delta: ComplexAffinePoint2d,
    gamma: ComplexAffinePoint2d,
    alpha_beta: Field12,
    w27: Field12,
    ic0: AffinePoint2d,
    #[serde(skip_serializing_if = "Option::is_none")]
    ic1: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ic2: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ic3: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ic4: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ic5: Option<AffinePoint2d>,
    #[serde(skip_serializing_if = "Option::is_none")]
    ic6: Option<AffinePoint2d>,
}