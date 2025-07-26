import { G2Affine } from '../ec/g2.js';
import { G2Line, computeLineCoeffs } from '../lines/index.js';
import { Fp12Type } from '../towers/fp12';
import { Fp12, Fp2, FpC } from '../towers/index.js';
import fs from 'fs';
import { bn254 } from '../ec/g1.js';
import { ForeignCurve } from 'o1js';
import { CONFIG } from './config.js';

// Base VK structure (common fields)
type SerializedVkBase = {
  delta: {
    x_c0: string;
    x_c1: string;
    y_c0: string;
    y_c1: string;
  };
  gamma: {
    x_c0: string;
    x_c1: string;
    y_c0: string;
    y_c1: string;
  };
  alpha_beta: Fp12Type;
  w27: Fp12Type;
};

// Generate IC point type based on input count
type ICPointType = { x: string; y: string };

// Flexible SerializedVk type supporting all possible IC points
type SerializedVk = SerializedVkBase & {
  ic0: ICPointType; // Always present (base case)
  ic1?: ICPointType;
  ic2?: ICPointType;
  ic3?: ICPointType;
  ic4?: ICPointType;
  ic5?: ICPointType;
  ic6?: ICPointType;
};

class GrothVk {
  delta_lines: Array<G2Line>;
  gamma_lines: Array<G2Line>;
  alpha_beta: Fp12;
  w27: Fp12;
  w27_square: Fp12;

  // IC points stored as array for flexibility, with named accessors
  private icPoints: ForeignCurve[];

  // Named accessors for compatibility with existing code
  get ic0() { return this.icPoints[0]; }
  get ic1() { return this.icPoints[1]; }
  get ic2() { return this.icPoints[2]; }
  get ic3() { return this.icPoints[3]; }
  get ic4() { return this.icPoints[4]; }
  get ic5() { return this.icPoints[5]; }
  get ic6() { return this.icPoints[6]; }

  constructor(
    alpha_beta: Fp12,
    w27: Fp12,
    delta: G2Affine,
    gamma: G2Affine,
    icPoints: ForeignCurve[]
  ) {
    this.delta_lines = computeLineCoeffs(delta);
    this.gamma_lines = computeLineCoeffs(gamma);
    this.alpha_beta = alpha_beta;
    this.w27 = w27;
    this.w27_square = w27.mul(w27);
    this.icPoints = icPoints;

    // Validate we have the expected number of IC points
    const expectedCount = CONFIG.publicInputCount + 1; // +1 for ic0
    if (this.icPoints.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} IC points for ${CONFIG.publicInputCount} public inputs, got ${this.icPoints.length}`);
    }
  }

  static parse(path: string): GrothVk {
    const data = fs.readFileSync(path, 'utf-8');
    const obj: SerializedVk = JSON.parse(data);

    // Validate expected IC points are present  
    for (const field of CONFIG.icFields) {
      if (!(field in obj)) {
        throw new Error(`Missing required IC point: ${field}`);
      }
    }

    const dx = new Fp2({
      c0: FpC.from(obj.delta.x_c0),
      c1: FpC.from(obj.delta.x_c1),
    });
    const dy = new Fp2({
      c0: FpC.from(obj.delta.y_c0),
      c1: FpC.from(obj.delta.y_c1),
    });
    const delta = new G2Affine({ x: dx, y: dy });

    const gx = new Fp2({
      c0: FpC.from(obj.gamma.x_c0),
      c1: FpC.from(obj.gamma.x_c1),
    });
    const gy = new Fp2({
      c0: FpC.from(obj.gamma.y_c0),
      c1: FpC.from(obj.gamma.y_c1),
    });
    const gamma = new G2Affine({ x: gx, y: gy });

    const alpha_beta = Fp12.loadFromJSON(obj.alpha_beta);
    const w27 = Fp12.loadFromJSON(obj.w27);

    // Parse IC points dynamically based on configuration
    const icPoints = CONFIG.icFields.map(field => {
      const icData = (obj as any)[field];
      if (!icData) {
        throw new Error(`Missing IC point data for field: ${field}`);
      }
      return new bn254({
        x: FpC.from(icData.x),
        y: FpC.from(icData.y)
      });
    });

    return new GrothVk(
      alpha_beta,
      w27,
      delta,
      gamma,
      icPoints
    );
  }
}

export { GrothVk };
