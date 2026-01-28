# @nori-zk/proof-conversion-utils

WebAssembly utilities for converting zero-knowledge proofs between different formats, with a focus on targeting Mina Protocol's o1js framework.

## Installation

```bash
npm install @nori-zk/proof-conversion-utils
```

## Overview

This package provides utilities to assist witness creation and alpha-beta pairing. As well as converting Groth16 zero-knowledge proofs from various sources (SnarkJS, SP1) into the format required by o1js for verification in Mina Protocol zkApps.

## TypeScript API

### Types

#### `AffinePoint2d`
A 2D affine point with x and y coordinates.

Each coordinate is a decimal string representing a large integer (BigInt in JS).
For example, 254-bit integers when using the BN254 curve.

Used for G1 curve points in affine form (no z coordinate).

```typescript
interface AffinePoint2d {
  x: string;  // String representation of x coordinate
  y: string;  // String representation of y coordinate
}
```

#### `ComplexAffinePoint2d`
A 2D affine point with complex coordinates (each coordinate has real and imaginary parts).

x = (x_c0, x_c1) and y = (y_c0, y_c1), where c0 is real and c1 is imaginary.
Each component is a decimal string representing a large integer (BigInt in JS).
For example, 254-bit integers when using the BN254 curve.

Used for G2 curve points in affine form (no z coordinate).

```typescript
interface ComplexAffinePoint2d {
  x_c0: string;  // Real part of x coordinate
  x_c1: string;  // Imaginary part of x coordinate
  y_c0: string;  // Real part of y coordinate
  y_c1: string;  // Imaginary part of y coordinate
}
```

#### `ProjectivePoint`
Represents a projective point with x, y, z coordinates.

Each coordinate is a decimal string representing a large integer (BigInt in JS).
For example, 254-bit integers when using the BN254 curve.

Used for G1 curve points in projective form as output by snarkjs.

```typescript
export type ProjectivePoint = [string, string, string];
```

#### `ComplexProjectivePoint`
A projective point with complex coordinates.

Each coordinate has real (c0) and imaginary (c1) parts.
Each component is a decimal string representing a large integer (BigInt in JS).

Used for G2 curve points in projective form as output by snarkjs.

```typescript
export type ComplexProjectivePoint = [[string, string], [string, string], [string, string]];
```

#### `Field12`
A 12-element field value (Fq12) serialized as decimal strings.
Used for pairing outputs like `alpha_beta` and `w27` in verification keys.

##### Structure

Fq12 is built from a \'tower\' of field extensions:
- **Fq**: A single 254-bit integer (the base field)
- **Fq2**: Two Fq values (real + imaginary)
- **Fq6**: Three Fq2 values
- **Fq12**: Two Fq6 values (`g` and `h` in our serialization)

So: Fq12 = 2 × Fq6 = 2 × 3 × Fq2 = 12 base field elements.

##### Naming Convention
`{group}{pair}{component}`:
- group: `g` or `h`
- pair: `0`, `1`, or `2` (which pair within the group)
- component: `0` (real) or `1` (imaginary)

```typescript
interface Field12 {
  g00: string;
  g01: string;
  g10: string;
  g11: string;
  g20: string;
  g21: string;
  h00: string;
  h01: string;
  h10: string;
  h11: string;
  h20: string;
  h21: string;
}
```

#### `PairingInput`
Input for computing a pairing operation.

A pairing combines a G1 point and a G2 point to produce a 12-element field value.
In Groth16/PLONK verification keys, this is used to precompute e(alpha, beta).

- `alpha`: G1 curve point (simple 2D coordinates)
- `beta`: G2 curve point (complex 2D coordinates, each coordinate is a pair)

```typescript
interface PairingInput {
  alpha: AffinePoint2d;
  beta: ComplexAffinePoint2d;
}
```

#### `AuxWitness`
Auxiliary witness for pairing verification.

Contains precomputed hints for efficient final exponentiation:
- `c`: A 12-element field value
- `shift_power`: A small integer (0, 1, or 2) for the shift factor

```typescript
interface AuxWitness {
  c: Field12;
  shift_power: string;  // '0', '1', or '2'
}
```

#### `O1jsProof`
Groth16 proof in o1js format.

Contains the three proof curve points plus public inputs:
- `negA`: Negated A point (G1)
- `B`: B point (G2 - complex coordinates)
- `C`: C point (G1)
- `pi1` through `pi6`: Public inputs (max 6 supported)

```typescript
interface O1jsProof {
  negA: AffinePoint2d;  // Negated A point (G1)
  B: ComplexAffinePoint2d;  // B point (G2)
  C: AffinePoint2d;  // C point (G1)
  pi1?: string;  // Public input 1 (optional)
  pi2?: string;  // Public input 2 (optional)
  pi3?: string;  // Public input 3 (optional)
  pi4?: string;  // Public input 4 (optional)
  pi5?: string;  // Public input 5 (optional)
  pi6?: string;  // Public input 6 (optional)
}
```

#### `O1jsVK`
Groth16 verification key in o1js format.

Contains the verification key parameters needed for proof verification:
- `alpha`: Alpha point from trusted setup (G1)
- `beta`, `gamma`, `delta`: Curve points from the trusted setup (G2)
- `alpha_beta`: Precomputed pairing e(alpha, beta) as a 12-element field value
- `w27`: A 27th root of unity used for pairing optimizations
- `ic0` through `ic6`: Input commitment points for public input verification.
  `ic0` is always present (the constant term). `ic1`-`ic6` are optional based on how many public inputs the circuit has (max 6 supported).

The Groth16 verification equation uses: `PI = ic0 + Σ(public_input[i] * ic[i+1])`

```typescript
interface O1jsVK {
  alpha: AffinePoint2d;
  beta: ComplexAffinePoint2d;
  gamma: ComplexAffinePoint2d;
  delta: ComplexAffinePoint2d;
  alpha_beta: Field12;  // Precomputed pairing e(α, β)
  w27: Field12;  // 27th root of unity for pairing optimizations
  ic0: AffinePoint2d;  // Constant term (always present)
  ic1?: AffinePoint2d;  // Optional IC points based on circuit
  ic2?: AffinePoint2d;
  ic3?: AffinePoint2d;
  ic4?: AffinePoint2d;
  ic5?: AffinePoint2d;
  ic6?: AffinePoint2d;
}
```

#### `O1jsGroth16`
Groth16 proof and verification key in o1js format.

Contains both the converted proof and verification key ready for verification in Mina using o1js.


```typescript
interface O1jsGroth16 {
  proof: O1jsProof;
  vk: O1jsVK;
}
```

#### `SnarkjsProof`
Groth16 proof in snarkjs/circom format.

This is the input format produced by snarkjs when generating proofs.
Points are in projective coordinates (with z component).

- `pi_a`: A point (G1 projective)
- `pi_b`: B point (G2 projective)
- `pi_c`: C point (G1 projective)

```typescript
interface SnarkjsProof {
  pi_a: [string, string, string];  // A point in G1 projective
  pi_b: [[string, string], [string, string], [string, string]];  // B point in G2 projective
  pi_c: [string, string, string];  // C point in G1 projective
}
```

#### `SnarkjsVK`
Groth16 verification key in snarkjs/circom format.

This is the input format produced by snarkjs when compiling circom circuits.
Points are in projective coordinates (with z component).

- `nPublic`: Number of public inputs in the circuit
- `vk_alpha_1`: Alpha point (G1 projective)
- `vk_beta_2`, `vk_gamma_2`, `vk_delta_2`: Setup points (G2 projective)
- `IC`: Input commitment points, one per public input plus a constant term


```typescript
interface SnarkjsVK {
  nPublic: number;
  vk_alpha_1: [string, string, string];
  vk_beta_2: [[string, string], [string, string], [string, string]];
  vk_gamma_2: [[string, string], [string, string], [string, string]];
  vk_delta_2: [[string, string], [string, string], [string, string]];
  vk_alphabeta_12: [[string, string], [string, string], [string, string]];
  IC: Array<[string, string, string]>;
}
```

#### `Groth16Bn254Proof`
Groth16 proof in SP1/gnark format.
Mirrors `sp1_prover::Groth16Bn254Proof`.

```typescript
export interface Groth16Bn254Proof {
    public_inputs: [string, string];
    encoded_proof: string;
    raw_proof: string;
    groth16_vkey_hash: number[];
}
```

#### `PlonkBn254Proof`
Plonk proof in SP1/gnark format.
Mirrors `sp1_prover::PlonkBn254Proof`.

```typescript
export interface PlonkBn254Proof {
    public_inputs: [string, string];
    encoded_proof: string;
    raw_proof: string;
    plonk_vkey_hash: number[];
}
```

#### `SP1Proof`
SP1 proof enum containing different proof types.
Mirrors `sp1_stark::SP1Proof`.

```typescript
export type SP1Proof = { Groth16: Groth16Bn254Proof } | { Plonk: PlonkBn254Proof };
```

#### `SP1PublicValues`
SP1 public values.
Mirrors `sp1_primitives::io::SP1PublicValues`.

```typescript
export interface SP1PublicValues {
    buffer: SP1Buffer;
}

#### `SP1ProofWithPublicValues`
SP1 proof with public values.
Mirrors `sp1_sdk::proof::SP1ProofWithPublicValues`.

```typescript
export interface SP1ProofWithPublicValues {
    proof: SP1Proof;
    public_values: SP1PublicValues;
    sp1_version: string;
    tee_proof: number[] | null;
}
```

### Functions

#### `compute_pairing(input: PairingInput): Field12`

Computes a pairing for a verification key.

Takes two curve points (alpha and beta from the trusted setup) and computes their pairing using the Miller loop algorithm. The result is a 12-element field value that gets stored in the verification key.

```typescript
const result = compute_pairing({
  alpha: { x: '...', y: '...' },
  beta: { x_c0: '...', x_c1: '...', y_c0: '...', y_c1: '...' }
});
```

#### `compute_aux_witness(input: Field12): AuxWitness`

Computes the auxiliary witness from a Miller loop output.

Takes a 12-element field value (the result of a Miller loop pairing computation) and computes the auxiliary witness needed for efficient verification.

```typescript
const auxWitness = compute_aux_witness({
  g00: '...', g01: '...', g10: '...', g11: '...', g20: '...', g21: '...',
  h00: '...', h01: '...', h10: '...', h11: '...', h20: '...', h21: '...'
});
```

#### `convert_snarkjs_groth16_to_o1js(proof: SnarkjsProof, public_inputs: string[], vk: SnarkjsVK): O1jsGroth16`

Converts a SnarkJS/Circom Groth16 proof and verification key to o1js format.

This function takes Groth16 proofs generated by snarkjs (the JavaScript implementation of Groth16 commonly used with circom circuits) and converts them to o1js format for verification in Mina Protocol zkApps.

**Key Conversions:**
- The A point (`pi_a`) is negated for o1js compatibility
- Points are converted from projective coordinates to affine form
- The `alpha_beta` pairing e(α, β) is precomputed
- Supports up to 6 public inputs

```typescript
import { convert_snarkjs_groth16_to_o1js } from '@nori-zk/proof-conversion-utils';

const o1jsFormat = convert_snarkjs_groth16_to_o1js(
  snarkjsProof,
  ['123', '456'],  // Public inputs as strings
  snarkjsVK
);
```

#### `convert_sp1_groth16_to_o1js(sp1_proof: SP1ProofWithPublicValues): O1jsGroth16`

Converts an SP1 Groth16 proof to o1js format.

This function takes Groth16 proofs generated by SP1 (Succinct's zkVM) and converts them to o1js format for verification in Mina Protocol zkApps. SP1 uses gnark's Groth16 implementation internally.

**Key Features:**
- Automatically decompresses gnark-formatted proof bytes
- Uses the embedded SP1 v5.0.0 verification key (all SP1 Groth16 proofs use the same VK)
- Negates the A point for o1js compatibility
- SP1 Groth16 proofs always have exactly 2 public inputs (vkey_hash and public_values_hash)

```typescript
import { convert_sp1_groth16_to_o1js } from '@nori-zk/proof-conversion-utils';

const o1jsFormat = convert_sp1_groth16_to_o1js(sp1Proof);
```

## Usage Examples

### Converting SnarkJS Proof

```typescript
import { convert_snarkjs_groth16_to_o1js } from '@nori-zk/proof-conversion-utils';
import snarkjsProof from './proof.json';
import snarkjsVK from './verification_key.json';

const publicInputs = ['12345', '67890'];

const { proof, vk } = convert_snarkjs_groth16_to_o1js(
  snarkjsProof,
  publicInputs,
  snarkjsVK
);

// Use proof and vk with o1js for verification in Mina
```

### Converting SP1 Proof

```typescript
import { convert_sp1_groth16_to_o1js } from '@nori-zk/proof-conversion-utils';
import sp1Proof from './sp1_proof.json';

const { proof, vk } = convert_sp1_groth16_to_o1js(sp1Proof);

// Use proof and vk with o1js for verification in Mina
```

### Computing Pairing

```typescript
import { compute_pairing } from '@nori-zk/proof-conversion-utils';

const alphaBeta = compute_pairing({
  alpha: {
    x: '12369698276624038106972479882730964985390333465481074863680349672529458504727',
    y: '15615049479232918185966644204891621024197935236528708875381357850359187990605'
  },
  beta: {
    x_c0: '1903903027629957495668852277947233956036752695749808956450499753161040073874',
    x_c1: '19516214232409959981032970092985844340835031525223058295881548971699867691648',
    y_c0: '19307974034844496356197776793106808222110218706117190747312969862440532637662',
    y_c1: '13697410665674063166131807846290149764118701671708810697019074013384033689104'
  }
});
```

## Supported Formats

- **SnarkJS**: Groth16 proofs from snarkjs/circom circuits
- **SP1**: Groth16 proofs from SP1 v5.0.0 zkVM
- **o1js**: Target format for Mina Protocol zkApps

## Technical Details

- Built with Rust and compiled to WebAssembly for high performance
- Uses the arkworks cryptography library for BN254 curve operations
- All field elements are represented as strings for JavaScript compatibility
- Supports BN254 elliptic curve pairing

## License

Apache-2.0
