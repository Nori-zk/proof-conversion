import { G1Affine, G2Affine } from '../ec/index.js';
import fs from 'fs';
import { ATE_LOOP_COUNT, Fp2, FpC, FrC } from '../towers/index.js';
import { Provable, Struct } from 'o1js';
import { G2Line, computeLineCoeffs } from '../lines/index.js';
import { computePI } from './compute_pi.js';
import { GrothVk } from './vk.js';
import type { O1jsProof } from '@nori-zk/proof-conversion-utils';
import { assertExactStructure, isAffinePoint2d, isComplexAffinePoint2d, isOptionalString } from '../api/validation/index.js';

export interface ProofData {
  negA: G1Affine;
  B: G2Affine;
  C: G1Affine;
  PI: G1Affine;
  b_lines: G2Line[];
  pis: FrC[];
}

type ProofClass = ReturnType<typeof Struct<{
  negA: typeof G1Affine;
  B: typeof G2Affine;
  C: typeof G1Affine;
  PI: typeof G1Affine;
  b_lines: ReturnType<typeof Provable.Array>;
  pis: ReturnType<typeof Provable.Array>;
}>> & {
  parse(vk: GrothVk, path: string): ProofData;
};

type PiIndex = 1 | 2 | 3 | 4 | 5 | 6;
type PiKey = `pi${PiIndex}`;

const getNumOfLines = () => {
  let cnt = 0;

  for (let i = 1; i < ATE_LOOP_COUNT.length; i++) {
    cnt += 1;
    if (ATE_LOOP_COUNT[i] !== 0) cnt += 1;
  }

  // add two more for frobenius
  return cnt + 2;
};

// Cache for dynamically created Proof classes
const proofClassCache = new Map<number, ProofClass>();

function createProofClass(inputCount: number) {
  if (inputCount < 0 || inputCount > 6) {
    throw new Error(`Unsupported input count: ${inputCount}. Supported range: 0-6`);
  }

  const cached = proofClassCache.get(inputCount);
  if (cached !== undefined) {
    return cached;
  }

  const ProofClass = class extends Struct({
    negA: G1Affine,
    B: G2Affine,
    C: G1Affine,
    PI: G1Affine,
    b_lines: Provable.Array(G2Line, getNumOfLines()),
    pis: Provable.Array(FrC.provable, inputCount),
  }) {
    static parse(vk: GrothVk, path: string) {
      const json: O1jsProof = JSON.parse(fs.readFileSync(path, 'utf-8'));

      // Get public inputs (pi1, pi2, etc).
      const publicInputs: FrC[] = [];
      for (let i = 1; i <= inputCount; i++) {
        const key = `pi${i}` as PiKey;
        const val = json[key];
        if (val) {
          publicInputs.push(FrC.from(val));
        }
      }

      const negA = new G1Affine({
        x: FpC.from(json.negA.x),
        y: FpC.from(json.negA.y),
      });

      const C = new G1Affine({
        x: FpC.from(json.C.x),
        y: FpC.from(json.C.y),
      });

      const B = new G2Affine({
        x: new Fp2({
          c0: FpC.from(json.B.x_c0),
          c1: FpC.from(json.B.x_c1),
        }),
        y: new Fp2({
          c0: FpC.from(json.B.y_c0),
          c1: FpC.from(json.B.y_c1),
        }),
      });

      // FIXME CHECK THIS VS RUST
      const piBn = computePI(vk, publicInputs);
      const PI = new G1Affine({
        x: FpC.from(piBn.x).assertCanonical(),
        y: FpC.from(piBn.y).assertCanonical(),
      });

      return new ProofClass({
        negA,
        B,
        C,
        PI,
        b_lines: computeLineCoeffs(B),
        pis: publicInputs,
      });
    }
  };

  proofClassCache.set(inputCount, ProofClass);
  return ProofClass;
}

const isO1jsProof = {
  negA: isAffinePoint2d,
  B: isComplexAffinePoint2d,
  C: isAffinePoint2d,
  pi1: isOptionalString,
  pi2: isOptionalString,
  pi3: isOptionalString,
  pi4: isOptionalString,
  pi5: isOptionalString,
  pi6: isOptionalString,
}

export function detectInputCountFromProof(path: string): number {
  const json: O1jsProof = JSON.parse(fs.readFileSync(path, 'utf-8'));
  
  // Runtime validation of O1jsProof schema, piN contiguous - if present.

  assertExactStructure(json, isO1jsProof, 'o1jsProof');

  const piIndices = Object.keys(json)
    .filter((key) => /^pi\d+$/.test(key))
    .map((key) => Number(key.slice(2)));
  
  const count = Math.max(...[0,...piIndices]);

  for (let i = 1; i <= count; i++) {
    if (!json[`pi${i}` as PiKey]) 
      throw new Error(`'pi${i}' is missing when we expected up to 'pi${count}'. piN must be contiguous from pi1 to pi${count}`);
  }

  return count;
}

export function parseProof(vk: GrothVk, path: string) {
  const inputCount = detectInputCountFromProof(path);
  const ProofClass = createProofClass(inputCount);
  return ProofClass.parse(vk, path);
}

// Legacy Proof for backward compatibility (fixed 5 inputs)
const Proof = createProofClass(5);

export { Proof };
