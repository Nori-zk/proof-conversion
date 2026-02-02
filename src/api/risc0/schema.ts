import type { O1jsVK, O1jsProof } from 'pairing-utils/pkg/pairing_utils.js';
import {
  isString,
  isAffinePoint2d,
  isComplexAffinePoint2d,
  isField12,
} from '../validation/guards/index.js';

// Types ======================================================================================

// Original vk risc0 gives us - Must include all O1jsVK keys but must exclude ic6 AND alpha_beta - aka we must have 5 PIs starting from index 1 (pi1->pi5) - pi0 is the groth16 verification key itself
export type Risc0Groth16Vk = Omit<Required<O1jsVK>, 'ic6' | 'alpha_beta'>;
// Must include all O1jsVK keys but must exclude ic6 - aka we must have 6 ICs starting from index 0 (ic0->ic5)
export type Risc0Groth16PairedVk = Omit<Required<O1jsVK>, 'ic6'>;
// Must include all O1jsProof keys but must exclude pi6 - aka we must have 5 PIs starting from index 1 (pi1->pi5) - pi0 is the groth16 verification key itself
export type Risc0Groth16Proof = Omit<Required<O1jsProof>, 'pi6'>;

export type Risc0Groth16Input = {
  risc0_proof: Risc0Groth16Proof;
  raw_vk: Risc0Groth16Vk;
};

// Runtime validation =========================================================================

const risc0Groth16ProofSchema = {
  negA: isAffinePoint2d,
  B: isComplexAffinePoint2d,
  C: isAffinePoint2d,
  pi1: isString,
  pi2: isString,
  pi3: isString,
  pi4: isString,
  pi5: isString,
};

const risc0Groth16VkSchema = {
  alpha: isAffinePoint2d,
  beta: isComplexAffinePoint2d,
  gamma: isComplexAffinePoint2d,
  delta: isComplexAffinePoint2d,
  w27: isField12,
  ic0: isAffinePoint2d,
  ic1: isAffinePoint2d,
  ic2: isAffinePoint2d,
  ic3: isAffinePoint2d,
  ic4: isAffinePoint2d,
  ic5: isAffinePoint2d,
};

// Schema for obj form (risc0_proof + raw_vk)
export const risc0Groth16ObjInputSchema = {
  risc0_proof: risc0Groth16ProofSchema,
  raw_vk: risc0Groth16VkSchema,
};

// Keys for the ApiMethod helper - must match the keys in the schema - must be explicit tuples with 'as const' for proper type inference
export const risc0Groth16ArgKeys = ['risc0_proof', 'raw_vk'] as const;
