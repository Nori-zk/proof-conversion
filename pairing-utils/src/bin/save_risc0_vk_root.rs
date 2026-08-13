use std::fs;

use ark_ff::PrimeField;
use pairing_utils::risc0_control_id::{
    allowed_control_root_bytes, bn254_control_id_bytes, split_digest,
};

// Canonical version: risc0 v3.0.6 (see the module doc comment on
// pairing_utils::risc0_control_id for what that means, why the pinned
// risc0-circuit-recursion crate version - 4.0.5, see Cargo.toml - numbers
// differently, and how these values are cross-validated two independent
// ways: against Solidity source, and against a real self-verified proof in
// example-generators/risc0/).
fn main() {
    let (control_root_0, control_root_1) = split_digest(&allowed_control_root_bytes());
    let bn254_control_id = bn254_control_id_bytes();

    let control_root_0_dec = ark_bn254::Fr::from_be_bytes_mod_order(&control_root_0)
        .into_bigint()
        .to_string();
    let control_root_1_dec = ark_bn254::Fr::from_be_bytes_mod_order(&control_root_1)
        .into_bigint()
        .to_string();
    let bn254_control_id_dec = ark_bn254::Fr::from_be_bytes_mod_order(&bn254_control_id)
        .into_bigint()
        .to_string();

    let json = format!(
        "{{\n  \"risc0_control_root_0\": \"{}\",\n  \"risc0_control_root_1\": \"{}\",\n  \"risc0_bn254_control_id\": \"{}\"\n}}\n",
        control_root_0_dec, control_root_1_dec, bn254_control_id_dec
    );
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../src/risc0_control_id_v3.0.6.json"
    );
    fs::write(path, &json).expect("failed to write JSON");
    println!("Written to {}", path);
    println!("risc0_control_root_0 (pi1)    = {}", control_root_0_dec);
    println!("risc0_control_root_1 (pi2)    = {}", control_root_1_dec);
    println!("risc0_bn254_control_id (pi5)  = {}", bn254_control_id_dec);
}
