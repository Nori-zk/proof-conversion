import { Struct } from 'o1js';
import { FpA } from '../towers/fp.js';
import { G2Affine } from './g2.js';
import { bn254 } from './g1.js';

class G1Affine extends Struct({ x: FpA.provable, y: FpA.provable }) {
  assertOnCurve() {
    new bn254({ x: this.x, y: this.y }).assertOnCurve();
  }
}

export { G1Affine, G2Affine };
