import { G1Affine, G2Affine } from '../ec/index.js';
import fs from 'fs';
import { ATE_LOOP_COUNT, Fp2, FpC, FrC } from '../towers/index.js';
import { Provable, Struct } from 'o1js';
import { G2Line, computeLineCoeffs } from '../lines/index.js';
import { computePI } from './compute_pi.js';
import { GrothVk } from './vk.js';

export interface ProofData {
  negA: G1Affine;
  B: G2Affine;
  C: G1Affine;
  PI: G1Affine;
  b_lines: G2Line[];
  pis: FrC[];
}

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
const proofClassCache = new Map<number, any>();

function createProofClass(inputCount: number) {
  if (inputCount < 0 || inputCount > 6) {
    throw new Error(`Unsupported input count: ${inputCount}. Supported range: 0-6`);
  }

  if (proofClassCache.has(inputCount)) {
    return proofClassCache.get(inputCount);
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
      const json = JSON.parse(fs.readFileSync(path, 'utf-8'));

      // Get public inputs (pi1, pi2, etc)
      const publicInputs: FrC[] = [];
      for (let i = 1; i <= inputCount; i++) {
        const key = `pi${i}`;
        if (json[key]) {
          publicInputs.push(FrC.from(json[key]));
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

      const PI = new G1Affine({
        x: FpC.from(computePI(vk, publicInputs).x).assertCanonical(),
        y: FpC.from(computePI(vk, publicInputs).y).assertCanonical(),
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

export function detectInputCountFromProof(path: string): number {
  const json = JSON.parse(fs.readFileSync(path, 'utf-8'));
  let count = 0;
  for (let i = 1; i <= 6; i++) {
    if (json[`pi${i}`]) count++;
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
