//! Generic point types for curve operations.
//!
//! These types represent points on elliptic curves in various coordinate systems.
//! They serialize to/from JSON with decimal string representations of field elements.

use ark_bn254::{Fq, Fq2, G1Affine, G2Affine};
use serde::{Deserialize, Serialize};
use serde_tuple::{Deserialize_tuple, Serialize_tuple};
use std::str::FromStr;

#[cfg(feature = "wasm")]
use tsify::Tsify;

/// Safely checks if a G1 point is on the BN254 curve without panicking.
///
/// BN254 G1 curve equation: y^2 = x^3 + 3
///
/// This is panic-free unlike `is_on_curve()` which can panic in WASM.
fn is_on_g1_curve_safe(x: &Fq, y: &Fq) -> bool {
    use ark_ff::MontFp;
    let y_squared = *y * *y;
    let x_cubed = *x * *x * *x;
    let b = MontFp!("3"); // b = 3 for BN254 G1
    let rhs = x_cubed + b;
    y_squared == rhs
}

/// Safely checks if a G2 point is on the BN254 curve without panicking.
///
/// BN254 G2 curve equation: y^2 = x^3 + b
/// where b = 3/(9+u) for BN254
///
/// This is panic-free unlike `is_on_curve()` which can panic in WASM.
fn is_on_g2_curve_safe(x: &Fq2, y: &Fq2) -> bool {
    use ark_ff::MontFp;
    let y_squared = *y * *y;
    let x_cubed = *x * *x * *x;
    // b = 3/(9+u) for BN254 G2
    let b = Fq2::new(
        MontFp!("19485874751759354771024239261021720505790618469301721065564631296452457478373"),
        MontFp!("266929791119991161246907387137283842545076965332900288569378510910307636690"),
    );
    let rhs = x_cubed + b;
    y_squared == rhs
}

/// A 2D affine point with x and y coordinates.
///
/// Each coordinate is a decimal string representing a large integer (BigInt in JS).
/// For example, 254-bit integers when using the BN254 curve.
///
/// Used for G1 curve points in affine form (no z coordinate).
#[derive(Serialize, Deserialize, Debug, Clone)]
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi, from_wasm_abi))]
pub struct AffinePoint2d {
    pub x: String,
    pub y: String,
}

impl TryFrom<&AffinePoint2d> for G1Affine {
    type Error = String;

    /// Converts from `AffinePoint2d` to arkworks `G1Affine`.
    ///
    /// - `x` → `Fq` (x coordinate)
    /// - `y` → `Fq` (y coordinate)
    ///
    /// # Errors
    ///
    /// Returns an error if x or y cannot be parsed as valid `Fq` field elements.
    fn try_from(point: &AffinePoint2d) -> Result<Self, Self::Error> {
        let x = Fq::from_str(&point.x)
            .map_err(|_| format!("AffinePoint2d -> G1Affine: x: not a valid Fq '{}'", point.x))?;
        let y = Fq::from_str(&point.y)
            .map_err(|_| format!("AffinePoint2d -> G1Affine: y: not a valid Fq '{}'", point.y))?;

        // Safely validate using panic-free curve equation check
        if !is_on_g1_curve_safe(&x, &y) {
            return Err(format!("AffinePoint2d -> G1Affine: point ({}, {}) is not on the curve", point.x, point.y));
        }

        Ok(G1Affine::new(x, y))
    }
}

impl From<&G1Affine> for AffinePoint2d {
    /// Converts from arkworks `G1Affine` to `AffinePoint2d`.
    ///
    /// - `Fq` (x coordinate) → `x`
    /// - `Fq` (y coordinate) → `y`
    fn from(point: &G1Affine) -> Self {
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
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi, from_wasm_abi))]
pub struct ComplexAffinePoint2d {
    pub x_c0: String,
    pub x_c1: String,
    pub y_c0: String,
    pub y_c1: String,
}


impl TryFrom<&ComplexAffinePoint2d> for G2Affine {
    type Error = String;

    /// Converts from `ComplexAffinePoint2d` to arkworks `G2Affine`.
    ///
    /// - `(x_c0, x_c1)` → `Fq2` (x coordinate)
    /// - `(y_c0, y_c1)` → `Fq2` (y coordinate)
    ///
    /// # Errors
    ///
    /// Returns an error if any component cannot be parsed as a valid `Fq` field element.
    fn try_from(point: &ComplexAffinePoint2d) -> Result<Self, Self::Error> {
        let x_c0 = Fq::from_str(&point.x_c0)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: x_c0: not a valid Fq '{}'", point.x_c0))?;
        let x_c1 = Fq::from_str(&point.x_c1)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: x_c1: not a valid Fq '{}'", point.x_c1))?;
        let y_c0 = Fq::from_str(&point.y_c0)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: y_c0: not a valid Fq '{}'", point.y_c0))?;
        let y_c1 = Fq::from_str(&point.y_c1)
            .map_err(|_| format!("ComplexAffinePoint2d -> G2Affine: y_c1: not a valid Fq '{}'", point.y_c1))?;

        let x = Fq2::new(x_c0, x_c1);
        let y = Fq2::new(y_c0, y_c1);

        // Safely validate using panic-free curve equation check
        if !is_on_g2_curve_safe(&x, &y) {
            return Err("ComplexAffinePoint2d -> G2Affine: point is not on the curve".to_string());
        }

        Ok(G2Affine::new(x, y))
    }
}

impl From<&G2Affine> for ComplexAffinePoint2d {
    /// Converts from arkworks `G2Affine` to `ComplexAffinePoint2d`.
    ///
    /// - `Fq2` (x coordinate) → `(x_c0, x_c1)`
    /// - `Fq2` (y coordinate) → `(y_c0, y_c1)`
    fn from(point: &G2Affine) -> Self {
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
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi, from_wasm_abi, type = "[string, string, string]"))]
#[derive(Serialize_tuple, Deserialize_tuple, Debug, Clone)]
pub struct ProjectivePoint {
    pub x: String,
    pub y: String,
    pub z: String,
}


impl TryFrom<&ProjectivePoint> for G1Affine {
    type Error = String;

    /// Converts from `ProjectivePoint` to arkworks `G1Affine`.
    ///
    /// - `x` → `Fq` (x coordinate)
    /// - `y` → `Fq` (y coordinate)
    /// - `z` is discarded (snarkjs typically outputs z=1)
    ///
    /// # Errors
    ///
    /// Returns an error if x or y cannot be parsed as valid `Fq` field elements.
    fn try_from(point: &ProjectivePoint) -> Result<Self, Self::Error> {
        let x = Fq::from_str(&point.x)
            .map_err(|_| format!("ProjectivePoint -> G1Affine: x: not a valid Fq '{}'", point.x))?;
        let y = Fq::from_str(&point.y)
            .map_err(|_| format!("ProjectivePoint -> G1Affine: y: not a valid Fq '{}'", point.y))?;

        // Safely validate using panic-free curve equation check
        if !is_on_g1_curve_safe(&x, &y) {
            return Err(format!("ProjectivePoint -> G1Affine: point ({}, {}) is not on the curve", point.x, point.y));
        }

        Ok(G1Affine::new(x, y))
    }
}

impl From<&ProjectivePoint> for AffinePoint2d {
    /// Converts from `ProjectivePoint` to `AffinePoint2d` (extracts x and y, discards z).
    ///
    /// This is a string-level conversion, no arkworks parsing involved.
    fn from(point: &ProjectivePoint) -> Self {
        Self {
            x: point.x.clone(),
            y: point.y.clone(),
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
#[cfg_attr(feature = "wasm", derive(Tsify))]
#[cfg_attr(feature = "wasm", tsify(into_wasm_abi, from_wasm_abi, type = "[[string, string], [string, string], [string, string]]"))]
#[derive(Serialize_tuple, Deserialize_tuple, Debug, Clone)]
pub struct ComplexProjectivePoint {
    pub x: (String, String),
    pub y: (String, String),
    pub z: (String, String),
}


impl TryFrom<&ComplexProjectivePoint> for G2Affine {
    type Error = String;

    /// Converts from `ComplexProjectivePoint` to arkworks `G2Affine`.
    ///
    /// - `(x.0, x.1)` → `Fq2` (x coordinate)
    /// - `(y.0, y.1)` → `Fq2` (y coordinate)
    /// - `z` is discarded (snarkjs typically outputs z=1)
    ///
    /// # Errors
    ///
    /// Returns an error if any component cannot be parsed as a valid `Fq` field element.
    fn try_from(point: &ComplexProjectivePoint) -> Result<Self, Self::Error> {
        let x_c0 = Fq::from_str(&point.x.0)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: x.0: not a valid Fq '{}'", point.x.0))?;
        let x_c1 = Fq::from_str(&point.x.1)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: x.1: not a valid Fq '{}'", point.x.1))?;
        let y_c0 = Fq::from_str(&point.y.0)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: y.0: not a valid Fq '{}'", point.y.0))?;
        let y_c1 = Fq::from_str(&point.y.1)
            .map_err(|_| format!("ComplexProjectivePoint -> G2Affine: y.1: not a valid Fq '{}'", point.y.1))?;

        let x = Fq2::new(x_c0, x_c1);
        let y = Fq2::new(y_c0, y_c1);

        // Safely validate using panic-free curve equation check
        if !is_on_g2_curve_safe(&x, &y) {
            return Err("ComplexProjectivePoint -> G2Affine: point is not on the curve".to_string());
        }

        Ok(G2Affine::new(x, y))
    }
}

impl From<&ComplexProjectivePoint> for ComplexAffinePoint2d {
    /// Converts from `ComplexProjectivePoint` to `ComplexAffinePoint2d` (extracts x and y, discards z).
    ///
    /// This is a string-level conversion, no arkworks parsing involved.
    fn from(point: &ComplexProjectivePoint) -> Self {
        Self {
            x_c0: point.x.0.clone(),
            x_c1: point.x.1.clone(),
            y_c0: point.y.0.clone(),
            y_c1: point.y.1.clone(),
        }
    }
}
