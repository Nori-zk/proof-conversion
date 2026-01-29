import type {
  SP1Proof,
  SP1PublicValues,
  SP1ProofWithPublicValues,
  O1jsVK,
  O1jsProof,
  Groth16Bn254Proof,
  PlonkBn254Proof,
} from '@nori-zk/proof-conversion-utils';
import {
  isNumberArray,
  isStringArrayOfLength,
  isUint8Array,
} from '../../validation/guards/arrays.js';
import { isString } from '../../validation/guards/primitives.js';

// Types ===================================================================================

// Re-exporting with the same naming to avoid a break in the api (FIXME we should just accept the change and move forward compare SP1 to Sp1)
export type Sp1Proof = SP1Proof;
export type Sp1PublicValues = SP1PublicValues;
export type Sp1Input = SP1ProofWithPublicValues;

// Must include the first ic (ic0), all the rest are optional up to ic6 (maximum of 7 in total)
export type Sp1Groth16Vk = O1jsVK;
// Must include pi1 as the first public input (pi1), all the rest are optional up to pi6  (maximum of 6 in total)
export type Sp1Groth16Proof = O1jsProof;

export type Sp1PlonkInputTransformed = {
  hexPi: string;
  programVK: string;
  encodedProof: string;
};

// TODO Plonk

export type SP1ProofWithPublicValuesGroth16NoTee = Omit<
  SP1ProofWithPublicValues,
  'proof' | 'tee_proof'
> & {
  proof: { Groth16: Groth16Bn254Proof };
  tee_proof: null;
};

export type SP1ProofWithPublicValuesPlonkNoTee = Omit<
  SP1ProofWithPublicValues,
  'proof' | 'tee_proof'
> & {
  proof: { Plonk: PlonkBn254Proof };
  tee_proof: null;
};

// Runtime validation ======================================================================

const plonkProofSchema = {
  public_inputs: isStringArrayOfLength(2), // [String; 2]
  encoded_proof: isString,
  raw_proof: isString,
  plonk_vkey_hash: isUint8Array(32), // [u8; 32]
};

const groth16ProofSchema = {
  public_inputs: isStringArrayOfLength(2), // [String; 2]
  encoded_proof: isString,
  raw_proof: isString,
  groth16_vkey_hash: isUint8Array(32), // [u8; 32]
};

export const sp1PlonkInputSchema = {
  proof: { Plonk: plonkProofSchema },
  public_values: { buffer: { data: isNumberArray } },
  sp1_version: isString,
  tee_proof: null, // Explicitly must be null
};

export const sp1Groth16InputSchema = {
  proof: { Groth16: groth16ProofSchema },
  public_values: { buffer: { data: isNumberArray } },
  sp1_version: isString,
  tee_proof: null, // Explicitly must be null
};

// Keys for the ApiMethod helper
export const sp1PlonkObjKeys = Object.keys(
  sp1PlonkInputSchema
) as (keyof Sp1Input)[];
export const sp1Groth16ObjKeys = Object.keys(
  sp1Groth16InputSchema
) as (keyof Sp1Input)[];
