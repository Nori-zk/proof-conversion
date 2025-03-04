# Notes on wasm converter

rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown
cargo install wasm-pack

wasm-pack build --target web