# Pairing utils

# Run normally (aka a rust binary)

cargo run --bin alphabeta
cargo run --bin aux_witness
cargo run --bin convert_from_snarkjs
cargo run --bin convert_from_sp1_groth16

# Build for wasm

`./build.sh` or `./build2.sh` (try if `build.sh` does not work)

# Updating vks after an SP1 upgrade

1. cargo run --bin save_plonk_vk_json
2. cargo run --bin save_sp1_groth16_bin.rs
3. Update readme and comments with new sp1 version name
4. ./build.sh

# Release npm package

After building for wasm `cd pkg && npm publish`

# Troubleshooting

1. Conflicting binaryen
   - `sudo apt remove binaryen`
