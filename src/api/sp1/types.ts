import type { Groth16Bn254Proof, O1jsProof, O1jsVK, PlonkBn254Proof, SP1Proof, SP1ProofWithPublicValues, SP1PublicValues } from "pairing-utils/pkg/pairing_utils.js";
import { sp1Groth16InputSchema, sp1PlonkInputSchema } from "../validation/sp1/schema.js";

// Types ===================================================================================

// Re-exporting with the same naming to avoid a break in the api
export type Sp1Proof = SP1Proof;
export type Sp1PublicValues = SP1PublicValues;
export type Sp1Input = SP1ProofWithPublicValues;

// Must include the first ic (ic0), all the rest are optional up to ic6 (maximum of 7 in total)
export type Sp1Groth16Vk = O1jsVK;
// Must include pi1 as the first public input (pi1), all the rest are optional up to pi6  (maximum of 6 in total)
export type Sp1Groth16Proof = O1jsProof;
// export type Sp1Groth16RawVk = Omit<Required<O1jsVK>,'alpha_beta'>; compute_pairing is done internally by pairing_utils for these groth16 methods

// Runtime validation ======================================================================

// export const sp1ArgKeys = ['hexPi', 'programVK', 'encodedProof'] as const; // Removed as this is unsafe until the TEE modification have been tested
export const sp1PlonkObjKeys = Object.keys(sp1PlonkInputSchema) as (keyof Sp1Input)[];
export const sp1Groth16ObjKeys = Object.keys(sp1Groth16InputSchema) as (keyof Sp1Input)[];

// Sp1 specific Guards ======================================================================
export function isSp1PlonkProof(proof: SP1Proof): proof is { Plonk: PlonkBn254Proof } {
  return 'Plonk' in proof;
}

export function isSp1Groth16Proof(proof: SP1Proof): proof is { Groth16: Groth16Bn254Proof } {
  return 'Groth16' in proof;
}

export function isTeeSp1Proof(obj: Sp1Input): boolean {
  return obj.tee_proof !== null && obj.tee_proof !== undefined;
}