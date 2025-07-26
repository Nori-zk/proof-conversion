import { GrothVk } from './vk.js';
import { bn254 } from '../ec/g1.js';
import { FrC } from '../towers/fr.js';
import { ForeignCurve } from 'o1js';
import { CONFIG } from './config.js';

// pis are sent without beginning 1
export function computePI(VK: GrothVk, pis: Array<FrC>): ForeignCurve {
  if (pis.length !== CONFIG.publicInputCount) {
    throw new Error(`Expected exactly ${CONFIG.publicInputCount} public inputs, got ${pis.length}`);
  }
  
  let acc = new bn254({ x: VK.ic0.x, y: VK.ic0.y });
  switch (CONFIG.publicInputCount) {
    case 0:
      // Only ic0, no additional inputs
      break;
    case 1:
      acc = acc.add(VK.ic1.scale(pis[0]));
      break;
    case 2:
      acc = acc.add(VK.ic1.scale(pis[0]));
      acc = acc.add(VK.ic2.scale(pis[1]));
      break;
    case 3:
      acc = acc.add(VK.ic1.scale(pis[0]));
      acc = acc.add(VK.ic2.scale(pis[1]));
      acc = acc.add(VK.ic3.scale(pis[2]));
      break;
    case 4:
      acc = acc.add(VK.ic1.scale(pis[0]));
      acc = acc.add(VK.ic2.scale(pis[1]));
      acc = acc.add(VK.ic3.scale(pis[2]));
      acc = acc.add(VK.ic4.scale(pis[3]));
      break;
    case 5:
      acc = acc.add(VK.ic1.scale(pis[0]));
      acc = acc.add(VK.ic2.scale(pis[1]));
      acc = acc.add(VK.ic3.scale(pis[2]));
      acc = acc.add(VK.ic4.scale(pis[3]));
      acc = acc.add(VK.ic5.scale(pis[4]));
      break;
    case 6:
      acc = acc.add(VK.ic1.scale(pis[0]));
      acc = acc.add(VK.ic2.scale(pis[1]));
      acc = acc.add(VK.ic3.scale(pis[2]));
      acc = acc.add(VK.ic4.scale(pis[3]));
      acc = acc.add(VK.ic5.scale(pis[4]));
      acc = acc.add(VK.ic6.scale(pis[5]));
      break;
    default:
      throw new Error(`Unsupported input count: ${CONFIG.publicInputCount}`);
  }

  return acc;
}
