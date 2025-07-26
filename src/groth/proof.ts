import { G1Affine, G2Affine } from '../ec/index.js';
import fs from 'fs';
import { ATE_LOOP_COUNT, Fp2, FpC, FrC } from '../towers/index.js';
import { Provable, Struct } from 'o1js';
import { G2Line, computeLineCoeffs } from '../lines/index.js';
import { computePI } from './compute_pi.js';
import { GrothVk } from './vk.js';
import { CONFIG } from './config.js';

const getNumOfLines = () => {
  let cnt = 0;

  for (let i = 1; i < ATE_LOOP_COUNT.length; i++) {
    cnt += 1;
    if (ATE_LOOP_COUNT[i] !== 0) cnt += 1;
  }

  // add two more for frobenius
  return cnt + 2;
};

// Dynamic `SerializedProof` type based on `CONFIG.publicInputCount`
type SerializedProofBase = {
  negA: {
    x: string;
    y: string;
  };
  B: {
    x_c0: string;
    x_c1: string;
    y_c0: string;
    y_c1: string;
  };
  C: {
    x: string;
    y: string;
  };
};

// Flexible `SerializedProof` type supporting all possible public input fields
type SerializedProof = SerializedProofBase & {
  pi1?: string;
  pi2?: string;
  pi3?: string;
  pi4?: string;
  pi5?: string;
  pi6?: string;
};

class Proof extends Struct({
  negA: G1Affine,
  B: G2Affine,
  C: G1Affine,
  PI: G1Affine,
  b_lines: Provable.Array(G2Line, getNumOfLines()),
  pis: Provable.Array(FrC.provable, CONFIG.publicInputCount),
}) {
  static parse(vk: GrothVk, path: string): Proof {
    const data = fs.readFileSync(path, 'utf-8');
    const obj: SerializedProof = JSON.parse(data);

    // Validate expected public inputs are present
    for (const field of CONFIG.proofFields) {
      if (!(field in obj)) {
        throw new Error(`Missing required public input: ${field}`);
      }
    }

    const negA = new G1Affine({
      x: FpC.from(obj.negA.x),
      y: FpC.from(obj.negA.y),
    });
    const C = new G1Affine({ x: FpC.from(obj.C.x), y: FpC.from(obj.C.y) });

    // Parse public inputs dynamically based on configuration
    const pis = CONFIG.proofFields.map(field => {
      const value = (obj as any)[field];
      if (value === undefined) {
        throw new Error(`Missing public input field: ${field}`);
      }
      return FrC.from(value);
    });
    let piBn = computePI(vk, pis);
    const PI = new G1Affine({
      x: FpC.from(piBn.x).assertCanonical(),
      y: FpC.from(piBn.y).assertCanonical(),
    });

    const bx = new Fp2({ c0: FpC.from(obj.B.x_c0), c1: FpC.from(obj.B.x_c1) });
    const by = new Fp2({ c0: FpC.from(obj.B.y_c0), c1: FpC.from(obj.B.y_c1) });
    const B = new G2Affine({ x: bx, y: by });

    const b_lines = computeLineCoeffs(B);

    return new Proof({ negA, B, C, PI, b_lines, pis });
  }
}

export { Proof };
