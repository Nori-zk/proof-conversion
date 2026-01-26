import type { O1jsProof, O1jsVK } from 'pairing-utils/pkg/pairing_utils.js';
import { risc0ObjInputSchema } from '../validation/risc0/schema.js';

// Types ======================================================================================

export type Risc0Groth16Input = {
  risc0_proof: Risc0Groth16Proof;
  raw_vk: Risc0Groth16RawVk;
};

// Must include all O1jsVK keys but must exclude ic6 AND alpha_beta - aka we must have 5 PIs starting from index 1 (pi1->pi5) - pi0 is the groth16 verification key itself
export type Risc0Groth16RawVk = Omit<Required<O1jsVK>, 'ic6' | 'alpha_beta'>;
// Must include all O1jsVK keys but must exclude ic6 - aka we must have 6 ICs starting from index 0 (ic0->ic5)
export type Risc0Groth16Vk = Omit<Required<O1jsVK>, 'ic6'>;
// Must include all O1jsProof keys but must exclude pi6 - aka we must have 5 PIs starting from index 1 (pi1->pi5) - pi0 is the groth16 verification key itself
export type Risc0Groth16Proof = Omit<Required<O1jsProof>, 'pi6'>; 

// Runtime validation =========================================================================

export const risc0Groth16ArgsKeys = Object.keys(risc0ObjInputSchema) as (keyof Risc0Groth16Input)[];
export const risc0Groth16ObjKeys = Object.keys(risc0ObjInputSchema) as (keyof Risc0Groth16Input)[];
