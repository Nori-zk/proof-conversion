//! Generic point types for curve operations.
//!
//! These types represent points on elliptic curves in various coordinate systems.
//! They serialize to/from JSON with decimal string representations of field elements.

use ark_bn254::{Fq, Fq2, G1Affine, G2Affine};
use serde::{Deserialize, Serialize};
use serde_tuple::{Deserialize_tuple, Serialize_tuple};
use std::str::FromStr;

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
