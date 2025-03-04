# Notes on wasm converter

rustup target add wasm32-unknown-unknown
cargo install wasm-pack
wasm-pack build --features wasm

# Run normally (aka a rust binary)

cargo run --bin alphabeta
cargo run --bin aux_witness

# Old 

cargo build --target wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown