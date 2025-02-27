# Proof-Conversion

## Description

This repository enables verification of **PLONK** and **Groth16** proofs generated by **SP1** and **RISC Zero zkVMs** inside **o1js** circuits, making them compatible with zkApps built on the **Mina Protocol**. The codebase employs a **parallel and recursive architecture** to efficiently verify non-native proofs in o1js.

While the infrastructure in this project is optimized for **SP1 proofs**, it is designed to be more general. Specifically, **any gnark-based PLONK proofs** can be verified using the existing code.

Additionally, the repository provides infrastructure for **Groth16 verification**, enabling the consumption of Groth16-based proofs produced by other frameworks such as **circom, arkworks, gnark, Risc Zero**, and many others.

### Run PLONK Conversion Script

To run the PLONK conversion script, execute:

```sh
MAX_THREADS=32 ./convert_plonk.sh
```

Replace `32` with the number of threads available on your machine.

### Optional Kernel Tuning

```
sudo sysctl -w vm.zone_reclaim_mode=0
sudo sysctl -w vm.overcommit_memory=1
sudo sysctl -w vm.swappiness=10
sudo cpupower frequency-set -g performance
```

## Running on server specific requirments

#### Install `parallel`

```sh
sudo apt install parallel
```

Depending on the CPU model, specificaly NUMA nodes setup, you may need to adjust values in
`scrips/plonk_tree.sh`

## Overview of o1js-blobstream by Geometry Research

Refer to the **[Gitbook documentation](https://o1js-blobstream.gitbook.io/o1js-blobstream)** for details on **o1js-blobstream**.

## License

This project is licensed under either:

- **[Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)** ([`LICENSE-APACHE`](LICENSE-APACHE))
- **[MIT License](https://opensource.org/licenses/MIT)** ([`LICENSE-MIT`](LICENSE-MIT))

at your option.

The **[SPDX](https://spdx.dev)** license identifier for this project is:  
`MIT OR Apache-2.0`.
