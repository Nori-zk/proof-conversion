import type { O1jsProof, O1jsVK } from 'pairing-utils/pkg/pairing_utils.js';
import { risc0ObjInputSchema } from '../validation/risc0/schema.js';

// Types

export type Risc0ToGroth16Input = {
  risc0_proof: Risc0Proof;
  raw_vk: Risc0RawVk;
};

export type Risc0Vk = Omit<Required<O1jsVK>, 'ic6'>; // Must include all O1jsVK keys but must exclude ic6
export type Risc0Proof = Omit<Required<O1jsProof>, 'pi6'>; // Must include all O1jsProof keys but must exclude pi6
export type Risc0RawVk = Omit<Required<O1jsVK>, 'ic6' | 'alpha_beta'>; // Must include all O1jsVK keys but must exclude ic6 AND alpha_beta

// Runtime validation - derived from schema

export const risc0ArgsKeys = Object.keys(risc0ObjInputSchema) as (keyof Risc0ToGroth16Input)[];
export const risc0ObjKeys = Object.keys(risc0ObjInputSchema) as (keyof Risc0ToGroth16Input)[];
