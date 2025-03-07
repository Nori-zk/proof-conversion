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

# v2 API

Version 2 is migrating away from having a mix of languages (TS, Bash, and Rust) to having a homogeneous TS-first approach utilizing WebAssembly to incorporate the Rust components and striving to deprecate Bash.

## Typescript API

### Installation

```
npm install @nori-zk/proof-conversion --save
```

### Usage:

```
import { ComputationalPlanExecutor, performSp1ToPlonk, Sp1, LogPrinter } from '@nori-zk/proof-conversion';
import { readFileSync } from 'fs';

async function main() {
    new LogPrinter("[NoriProofConverter]", ['log', 'info', 'warn', 'error', 'debug', 'fatal', 'verbose']);
    const maxProcesses = 10;
    const executor = new ComputationalPlanExecutor(maxProcesses);
    const sp1ProofStr = readFileSync('./example-proofs/v4.json', 'utf8');
    const sp1Proof = JSON.parse(sp1ProofStr) as Sp1;
    const result = await performSp1ToPlonk(executor, sp1Proof);
    console.log('Finished conversion', result);
}

main().catch(console.error);
```

## Cli

### Installation

#### Local installation (when you have cloned the repository):

Run `npm run relink` to install proof-conversion bash command.

#### Remote installation:

`npm install @nori-zk/proof-conversion -g` (note may require sudo depending on your configuration)

### Usage

```
nori-proof-converter <command> <input-json-file-path>
```

Currently supported commands:
 
- sp1ToPlonk

You can change the number of child processes it spawns by setting the MAX_PROCESSES environment variable before running the cli:

```
export MAX_PROCESSES = 10
```

Examples:

1. `proof-conversion sp1ToPlonk example-proofs/v4.json `

### Updating the cli

#### Local reinstallation

Run `npm run relink`

#### Remote reinstallation 

`npm unlink -g nori-proof-converter && npm uninstall -g nori-proof-converter && npm install -g @nori-zk/proof-conversion`

### Cli Troublingshooting

- If getting a permission denied check npm's awareness of linked modules `npm ls -g --depth=0 --link=true` remove symlinks manually if nessesary and run `npm run relink`

# License

This project is licensed under either:

- **[Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)** ([`LICENSE-APACHE`](LICENSE-APACHE))
- **[MIT License](https://opensource.org/licenses/MIT)** ([`LICENSE-MIT`](LICENSE-MIT))

at your option.

The **[SPDX](https://spdx.dev)** license identifier for this project is:  
`MIT OR Apache-2.0`.