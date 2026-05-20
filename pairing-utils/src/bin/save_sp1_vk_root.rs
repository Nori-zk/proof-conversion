use std::fs;

use ark_ff::PrimeField;
use sp1_verifier::VK_ROOT_BYTES;

fn main() {
    let value = ark_bn254::Fr::from_be_bytes_mod_order(&*VK_ROOT_BYTES);
    let decimal = value.into_bigint().to_string();

    let json = format!("{{\n  \"sp1_vk_root\": \"{}\"\n}}\n", decimal);
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/sp1_vk_root_v6.1.0.json");
    fs::write(path, &json).expect("failed to write JSON");
    println!("Written to {}", path);
    println!("sp1_vk_root = {}", decimal);
}
