# o1js-pairing

See the [Gitbook](https://o1js-blobstream.gitbook.io/o1js-blobstream) for documentation.

## License

This project is licensed under either of

- [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0) ([`LICENSE-APACHE`](LICENSE-APACHE))
- [MIT license](https://opensource.org/licenses/MIT) ([`LICENSE-MIT`](LICENSE-MIT))

at your option.

The [SPDX](https://spdx.dev) license identifier for this project is `MIT OR Apache-2.0`.

## Run PLONK conversion script

`chmod +x ./convert_proofs.sh`

`MAX_THREADS=32 ./convert_proofs.sh`
replace `32` with number of threads on your machine

## Verify converted SP1 ETH proof in zkApp

`npm run eth`
