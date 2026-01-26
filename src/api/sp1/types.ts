import type { Groth16Bn254Proof, PlonkBn254Proof, SP1Proof, SP1ProofWithPublicValues, SP1PublicValues } from "pairing-utils/pkg/pairing_utils.js";
import { sp1PlonkInputSchema } from "../validation/sp1/schema.js";

// Types

// Re-exporting with the same naming to avoid a break in the api
export type Sp1Proof = SP1Proof;
export type Sp1PublicValues = SP1PublicValues;
export type Sp1Input = SP1ProofWithPublicValues;

// Runtime validation

// export const sp1ArgKeys = ['hexPi', 'programVK', 'encodedProof'] as const; // Removed as this is unsafe until the TEE modification have been tested
export const sp1ObjKeys = Object.keys(sp1PlonkInputSchema) as (keyof Sp1Input)[];

// Guards
export function isSp1PlonkProof(proof: SP1Proof): proof is { Plonk: PlonkBn254Proof } {
  return 'Plonk' in proof;
}

export function isSp1Groth16Proof(proof: SP1Proof): proof is { Groth16: Groth16Bn254Proof } {
  return 'Groth16' in proof;
}

export function isTeeSp1Proof(obj: Sp1Input): boolean {
  return obj.tee_proof !== null && obj.tee_proof !== undefined;
}