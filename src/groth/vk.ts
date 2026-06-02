import { G2Affine } from '../ec/g2.js';
import { G2Line, computeLineCoeffs } from '../lines/index.js';
import { Fp12, Fp2, FpC } from '../towers/index.js';
import fs from 'fs';
import { bn254 } from '../ec/g1.js';
import { ForeignCurve } from 'o1js';
import { O1jsVK } from '@nori-zk/proof-conversion-utils';
import { assertExactStructure, isAffinePoint2d, isComplexAffinePoint2d, isField12, isOptionalAffinePoint2d } from '../api/validation/index.js';

const isGrothVk = {
  alpha_beta: isField12,
  delta: isComplexAffinePoint2d,
  gamma: isComplexAffinePoint2d,
  w27: isField12,
  ic0: isAffinePoint2d,
  ic1: isOptionalAffinePoint2d,
  ic2: isOptionalAffinePoint2d,
  ic3: isOptionalAffinePoint2d,
  ic4: isOptionalAffinePoint2d,
  ic5: isOptionalAffinePoint2d,
  ic6: isOptionalAffinePoint2d,
};

// Flexible SerializedVk type supporting all possible IC points
type SerializedVk = Omit<O1jsVK, 'alpha' | 'beta'>;
type IcIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type IcKey = `ic${IcIndex}`;

class GrothVk {
  delta_lines: Array<G2Line>;
  gamma_lines: Array<G2Line>;
  alpha_beta: Fp12;
  w27: Fp12;
  w27_square: Fp12;

  // IC points stored as array for full flexibility
  private icPoints: ForeignCurve[];

  // Named accessors for backward compatibility
  get ic0() { return this.icPoints[0]; }
  get ic1() { return this.icPoints[1]; }
  get ic2() { return this.icPoints[2]; }
  get ic3() { return this.icPoints[3]; }
  get ic4() { return this.icPoints[4]; }
  get ic5() { return this.icPoints[5]; }
  get ic6() { return this.icPoints[6]; }

  getIcPoint(index: number): ForeignCurve | undefined {
    return this.icPoints[index];
  }

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

    // Must have at least ic0, the constant
    if (this.icPoints.length === 0) {
      throw new Error('VK must contain at least ic0 point');
    }
  }

  static parse(path: string): GrothVk {
    const data = fs.readFileSync(path, 'utf-8');
    const obj: SerializedVk = JSON.parse(data);

    // Runtime validation of GrothVk schema and icN contiguity.
    assertExactStructure(obj, isGrothVk, 'grothVk');

    const icIndices = Object.keys(obj)
      .filter(key => /^ic\d+$/.test(key))
      .map(key => Number(key.slice(2)));

    const icCount = Math.max(...icIndices);

    for (let i = 0; i <= icCount; i++) {
      if (!obj[`ic${i}` as IcKey])
        throw new Error(`'ic${i}' is missing when we expected up to 'ic${icCount}'. icN must be contiguous from ic0 to ic${icCount}`);
    }

    const availableIcFields = Array.from({ length: icCount + 1 }, (_, i) => `ic${i}`);

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

    // Parse all available IC points
    const icPoints = availableIcFields.map(field => {
      const icData = obj[field as IcKey];
      if (!icData || !icData.x || !icData.y) {
        throw new Error(`Invalid IC point data for field: ${field}`);
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
