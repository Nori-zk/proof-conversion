use std::fs;
use sp1_verifier::GROTH16_VK_BYTES;

fn main() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/sp1_v6_groth16_vk.bin");
    fs::write(path, *GROTH16_VK_BYTES).expect("Failed to write sp1_v6_groth16_vk.bin");
}