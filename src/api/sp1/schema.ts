import type {
  O1jsVK,
  O1jsProof,
  Groth16Bn254Proof,
  PlonkBn254Proof,
  SP1ProofWithPublicValues,
} from '@nori-zk/proof-conversion-utils';
import {
  isNumberArray,
  isStringArrayOfLength,
  isUint8Array,
  isString,
} from '../validation/guards/index.js';

// Types ===================================================================================

// Must include the first ic (ic0), all the rest are optional up to ic6 (maximum of 7 in total)
export type Sp1Groth16Vk = O1jsVK;
// Must include pi1 as the first public input (pi1), all the rest are optional up to pi6  (maximum of 6 in total)
export type Sp1Groth16Proof = O1jsProof;

// Transformed Plonk computational plan input
export type Sp1PlonkInputTransformed = {
  hexPi: string;
  programVK: string;
  encodedProof: string;
};

// SP1ProofWithPublicValue Groth16 type
export type SP1ProofWithPublicValuesGroth16NoTee = Omit<
  SP1ProofWithPublicValues,
  'proof' | 'tee_proof'
> & {
  proof: { Groth16: Groth16Bn254Proof };
  tee_proof: null;
};

// SP1ProofWithPublicValue Plonk type
export type SP1ProofWithPublicValuesPlonkNoTee = Omit<
  SP1ProofWithPublicValues,
  'proof' | 'tee_proof'
> & {
  proof: { Plonk: PlonkBn254Proof };
  tee_proof: null;
};

// Runtime validation ======================================================================

const plonkProofSchema = {
  public_inputs: isStringArrayOfLength(5), // [String; 5]
  encoded_proof: isString,
  raw_proof: isString,
  plonk_vkey_hash: isUint8Array(32), // [u8; 32]
};

const groth16ProofSchema = {
  public_inputs: isStringArrayOfLength(5), // [String; 5]
  encoded_proof: isString,
  raw_proof: isString,
  groth16_vkey_hash: isUint8Array(32), // [u8; 32]
};

export const sp1PlonkInputSchema = {
  proof: { Plonk: plonkProofSchema },
  public_values: { buffer: { data: isNumberArray } },
  sp1_version: isString,
  tee_proof: null, // Explicitly must be null - no TEE support for now
};

export const sp1Groth16InputSchema = {
  proof: { Groth16: groth16ProofSchema },
  public_values: { buffer: { data: isNumberArray } },
  sp1_version: isString,
  tee_proof: null, // Explicitly must be null - no TEE support for now
};