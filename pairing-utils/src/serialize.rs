use ark_bn254::{Fq, Fq12, Fq2, Fq6};
use ark_std::Zero;
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::from_value;
use std::str::FromStr;
use wasm_bindgen::prelude::*;

/// A 12-element field value (Fq12) serialized as decimal strings.
///
/// Used for pairing outputs like `alpha_beta` and `w27` in verification keys.
///
/// # Structure
///
/// Fq12 is built from a "tower" of field extensions:
/// - **Fq**: A single 254-bit integer (the base field)
/// - **Fq2**: Two Fq values (real + imaginary)
/// - **Fq6**: Three Fq2 values
/// - **Fq12**: Two Fq6 values (`g` and `h` in our serialization)
///
/// So: Fq12 = 2 × Fq6 = 2 × 3 × Fq2 = 12 base field elements.
///
/// # Naming Convention
///
/// `{group}{pair}{component}`:
/// - group: `g` or `h`
/// - pair: `0`, `1`, or `2` (which pair within the group)
/// - component: `0` (real) or `1` (imaginary)
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Field12 {
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

impl Field12 {
    /// Parses from a JavaScript value.
    ///
    /// # Errors
    ///
    /// Returns an error if the JsValue doesn't match the expected structure.
    pub fn from_js(js: JsValue) -> Result<Self, String> {
        from_value(js).map_err(|e| format!("Field12 <- JsValue: {}", e))
    }

    /// Converts to arkworks `Fq12` type.
    ///
    /// # Errors
    ///
    /// Returns an error if any string cannot be parsed as a valid field element.
    pub fn to_fq12(&self) -> Result<Fq12, String> {
        let parse_fq = |s: &str| -> Result<Fq, String> {
            Fq::from_str(s).map_err(|_| format!("not a valid Fq '{}'", s))
        };

        let g00 = parse_fq(&self.g00).map_err(|e| format!("Field12 -> Fq12: g00: {}", e))?;
        let g01 = parse_fq(&self.g01).map_err(|e| format!("Field12 -> Fq12: g01: {}", e))?;
        let g0 = Fq2::new(g00, g01);

        let g10 = parse_fq(&self.g10).map_err(|e| format!("Field12 -> Fq12: g10: {}", e))?;
        let g11 = parse_fq(&self.g11).map_err(|e| format!("Field12 -> Fq12: g11: {}", e))?;
        let g1 = Fq2::new(g10, g11);

        let g20 = parse_fq(&self.g20).map_err(|e| format!("Field12 -> Fq12: g20: {}", e))?;
        let g21 = parse_fq(&self.g21).map_err(|e| format!("Field12 -> Fq12: g21: {}", e))?;
        let g2 = Fq2::new(g20, g21);

        let g = Fq6::new(g0, g1, g2);

        let h00 = parse_fq(&self.h00).map_err(|e| format!("Field12 -> Fq12: h00: {}", e))?;
        let h01 = parse_fq(&self.h01).map_err(|e| format!("Field12 -> Fq12: h01: {}", e))?;
        let h0 = Fq2::new(h00, h01);

        let h10 = parse_fq(&self.h10).map_err(|e| format!("Field12 -> Fq12: h10: {}", e))?;
        let h11 = parse_fq(&self.h11).map_err(|e| format!("Field12 -> Fq12: h11: {}", e))?;
        let h1 = Fq2::new(h10, h11);

        let h20 = parse_fq(&self.h20).map_err(|e| format!("Field12 -> Fq12: h20: {}", e))?;
        let h21 = parse_fq(&self.h21).map_err(|e| format!("Field12 -> Fq12: h21: {}", e))?;
        let h2 = Fq2::new(h20, h21);

        let h = Fq6::new(h0, h1, h2);

        Ok(Fq12::new(g, h))
    }
}

/// Auxiliary witness for pairing verification.
///
/// Contains precomputed hints for efficient final exponentiation:
/// - `c`: A 12-element field value
/// - `shift_power`: A small integer (0, 1, or 2) for the shift factor
#[derive(Serialize, Deserialize, Debug)]
pub struct AuxWitness {
    pub c: Field12,
    pub shift_power: String,
}

pub fn serialize_aux_witness(c: Fq12, shift_pow: u8, path: &str) {
    let c_serialized = serialize_fq12(c);
    let aux_witness = AuxWitness {
        c: c_serialized,
        shift_power: shift_pow.to_string(),
    };

    let json = serde_json::to_string(&aux_witness).unwrap();
    std::fs::write(path, &json).unwrap();
}

pub fn serialize_fq12(f: Fq12) -> Field12 {
    let to_string = |x: Fq| -> String {
        if x == Fq::zero() {
            "0".to_string()
        } else {
            x.to_string()
        }
    };

    Field12 {
        g00: to_string(f.c0.c0.c0),
        g01: to_string(f.c0.c0.c1),

        g10: to_string(f.c0.c1.c0),
        g11: to_string(f.c0.c1.c1),

        g20: to_string(f.c0.c2.c0),
        g21: to_string(f.c0.c2.c1),

        h00: to_string(f.c1.c0.c0),
        h01: to_string(f.c1.c0.c1),

        h10: to_string(f.c1.c1.c0),
        h11: to_string(f.c1.c1.c1),

        h20: to_string(f.c1.c2.c0),
        h21: to_string(f.c1.c2.c1),
    }
}

pub fn deserialize_fq12(path: &str) -> Fq12 {
    let json = std::fs::read_to_string(path).unwrap();
    let f12: Field12 = serde_json::from_str(&json).unwrap();
    f12.to_fq12().expect("deserialize_fq12: invalid field element in file")
}
