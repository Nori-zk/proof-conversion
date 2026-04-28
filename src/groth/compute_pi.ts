import { GrothVk } from './vk.js';
import { bn254 } from '../ec/g1.js';
import { FrC } from '../towers/fr.js';
import { ForeignCurve } from 'o1js';

// Groth16 public input computation: PI = IC[0] + Σ(pis[i] * IC[i+1])
// pis array contains only the actual public inputs (no leading "1" constant)
// IC[0] is the constant term, IC[1] multiplies pis[0], IC[2] multiplies pis[1], etc.
//
// When pis[i] is zero, pis[i] * IC[i+1] = point at infinity (EC additive identity),
// which contributes nothing to the accumulator — mirroring SP1's own prepare_inputs:
// if *i != Fr::zero() { acc + (*b * *i) } else { acc }
export function computePI(VK: GrothVk, pis: Array<FrC>): ForeignCurve {
  // Start with IC[0] constant term
  let acc = new bn254({ x: VK.ic0.x, y: VK.ic0.y });

  // Add Σ(pis[i] * IC[i+1]) for i = 0 to pis.length-1
  for (let i = 0; i < pis.length; i++) {
    const icPoint = VK.getIcPoint(i + 1); // IC[1], IC[2], IC[3], etc.
    if (!icPoint) {
      throw new Error(`VK missing IC point ic${i + 1} for public input ${i}`);
    }
    // Skip zero scalars: pis[i] * IC[i+1] = point at infinity = no-op for accumulator.
    // o1js ForeignCurve.scale() asserts non-zero, so we must guard before calling it.
    if (pis[i].toBigInt() !== 0n) {
      acc = acc.add(icPoint.scale(pis[i]));
    }
  }

  return acc;
}
