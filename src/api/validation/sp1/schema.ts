import { isNumberArray, isString, isStringArray, isUint8Array } from "../guards.js";

const plonkProofSchema = {
  public_inputs: isStringArray(2),      // [String; 2]
  encoded_proof: isString,
  raw_proof: isString,
  plonk_vkey_hash: isUint8Array(32)     // [u8; 32]
};

const groth16ProofSchema = {
  public_inputs: isStringArray(2),      // [String; 2]
  encoded_proof: isString,
  raw_proof: isString,
  groth16_vkey_hash: isUint8Array(32)    // [u8; 32]
};

export const sp1PlonkInputSchema = {
  proof: { Plonk: plonkProofSchema },
  public_values: { buffer: { data: isNumberArray } },
  sp1_version: isString,
  tee_proof: null // Explicitly must be null
};

export const sp1Groth16InputSchema = {
  proof: { Groth16: groth16ProofSchema },
  public_values: { buffer: { data: isNumberArray } },
  sp1_version: isString,
  tee_proof: null // Explicitly must be null
};