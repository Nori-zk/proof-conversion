import { GrothVk } from './vk.js';
import { bn254 } from '../ec/g1.js';
import { FrC } from '../towers/fr.js';
import { ForeignCurve } from 'o1js';

// Groth16 public input computation: PI = IC[0] + Σ(pis[i] * IC[i+1])
// pis array contains only the actual public inputs (no leading "1" constant)
// IC[0] is the constant term, IC[1] multiplies pis[0], IC[2] multiplies pis[1], etc.
export function computePI(VK: GrothVk, pis: Array<FrC>): ForeignCurve {
  const actualInputCount = pis.length;
  
  // Start with IC[0] constant term
  let acc = new bn254({ x: VK.ic0.x, y: VK.ic0.y });
  
  // Add Σ(pis[i] * IC[i+1]) for i = 0 to actualInputCount-1
  for (let i = 0; i < actualInputCount; i++) {
    const icPoint = VK.getIcPoint(i + 1); // IC[1], IC[2], IC[3], etc.
    if (!icPoint) {
      throw new Error(`VK missing IC point ic${i + 1} for public input ${i}`);
    }
    acc = acc.add(icPoint.scale(pis[i])); // pis[i] * IC[i+1]
  }

  return acc;
}
