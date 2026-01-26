import { isAffinePoint2d, isComplexAffinePoint2d, isField12, isString } from "../guards.js";

// Helper validators for complex nested structures matching pairing_utils types

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

const risc0Groth16RawVkSchema = {
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

// Schema for args form (just the proof)
export const risc0Groth16ArgsInputSchema = risc0Groth16ProofSchema;

// Schema for obj form (risc0_proof + raw_vk)
export const risc0Groth16ObjInputSchema = {
  risc0_proof: risc0Groth16ProofSchema,
  raw_vk: risc0Groth16RawVkSchema,
};
