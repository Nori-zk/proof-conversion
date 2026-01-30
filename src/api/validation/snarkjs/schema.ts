import {
  SnarkjsProof as SnarkjsGroth16Proof,
  SnarkjsVK as SnarkjsGroth16VK,
} from '@nori-zk/proof-conversion-utils';
import {
  isArrayOfLength,
  isArrayOfBoundedLength,
} from '../../validation/guards/arrays.js';

import {
  isString,
  isBoundedNumberUnion,
} from '../../validation/guards/primitives.js';

import {
  isComplexProjectivePoint,
  isProjectivePoint,
} from '../../validation/guards/crypto.js';

// Types ===================================================================================

export { SnarkjsGroth16Proof, SnarkjsGroth16VK };

export interface SnarkjsGroth16Input {
  proof: SnarkjsGroth16Proof;
  vk: SnarkjsGroth16VK;
  publicInputs: string[];
}

// Runtime validation ======================================================================

export const snarkjsGroth16ProofSchema = {
  protocol: 'groth16' as const,
  curve: 'bn128' as const,
  pi_a: isProjectivePoint,
  pi_b: isComplexProjectivePoint,
  pi_c: isProjectivePoint,
};

const isConstrainedIC = isArrayOfBoundedLength(isProjectivePoint, {
  minLength: 0,
  maxLength: 7,
});

const isSnarkjsAlphaBeta = isArrayOfLength(isComplexProjectivePoint, 2);

export const snarkjsGroth16VKSchema = {
  protocol: 'groth16' as const,
  curve: 'bn128' as const,
  nPublic: isBoundedNumberUnion({ min: 0, max: 6 }),
  vk_alpha_1: isProjectivePoint,
  vk_beta_2: isComplexProjectivePoint,
  vk_gamma_2: isComplexProjectivePoint,
  vk_delta_2: isComplexProjectivePoint,
  vk_alphabeta_12: isSnarkjsAlphaBeta,
  IC: isConstrainedIC,
};

export const snarkjsGroth16PublicInputsSchema = isArrayOfBoundedLength(isString, {maxLength: 6});

// Schema for obj form (proof + vk + publicInputs)
export const snarkjsGroth16InputSchema = {
  proof: snarkjsGroth16ProofSchema,
  vk: snarkjsGroth16VKSchema,
  publicInputs: snarkjsGroth16PublicInputsSchema,
};

// Keys for the ApiMethod helper - must match the keys in the schema - must be explicit tuples with 'as const' for proper type inference
export const snarkjsGroth16ArgsKeys = ['proof', 'vk', 'publicInputs'] as const;
export const snarkjsGroth16ObjKeys = ['proof', 'vk', 'publicInputs'] as const;