import { Field, Poseidon, Provable, ZkProgram } from 'o1js';
import { Accumulator } from './data.js';
import { Fp12, FrC } from '../../towers/index.js';
import { ArrayListHasher } from '../../array_list_hasher.js';
import { VK } from '../vk_from_env.js';
import { G1Affine } from '../../ec/index.js';
import { bn254 } from '../../ec/g1.js';
import { CONFIG } from '../config.js';

const zkp14 = ZkProgram({
  name: 'zkp14',
  publicInput: Field,
  publicOutput: Field,
  methods: {
    compute: {
      privateInputs: [Provable.Array(FrC.provable, CONFIG.publicInputCount)],
      async method(input: Field, pis: Array<FrC>) {
        const pis_hash = Poseidon.hashPacked(
          Provable.Array(FrC.provable, CONFIG.publicInputCount),
          pis
        );

        let acc = new bn254({ x: VK.ic0.x, y: VK.ic0.y });
        switch (CONFIG.publicInputCount) {
          case 0:
            // Only ic0, no additional inputs
            break;
          case 1:
            // zkp14 handles [0]: ic1*pis[0]
            acc = acc.add(VK.ic1.scale(pis[0]));
            break;
          case 2:
            // zkp14 handles [0,1]: ic1*pis[0] + ic2*pis[1]
            acc = acc.add(VK.ic1.scale(pis[0]));
            acc = acc.add(VK.ic2.scale(pis[1]));
            break;
          case 3:
            // zkp14 handles [0,1,2]: ic1*pis[0] + ic2*pis[1] + ic3*pis[2]
            acc = acc.add(VK.ic1.scale(pis[0]));
            acc = acc.add(VK.ic2.scale(pis[1]));
            acc = acc.add(VK.ic3.scale(pis[2]));
            break;
          case 4:
            // zkp14 handles [0,1]: ic1*pis[0] + ic2*pis[1] (2+2 distribution)
            acc = acc.add(VK.ic1.scale(pis[0]));
            acc = acc.add(VK.ic2.scale(pis[1]));
            break;
          case 5:
            // zkp14 handles [0,1,2]: ic1*pis[0] + ic2*pis[1] + ic3*pis[2] (3+2 distribution)
            acc = acc.add(VK.ic1.scale(pis[0]));
            acc = acc.add(VK.ic2.scale(pis[1]));
            acc = acc.add(VK.ic3.scale(pis[2]));
            break;
          case 6:
            // zkp14 handles [0,1,2]: ic1*pis[0] + ic2*pis[1] + ic3*pis[2] (3+3 distribution)
            acc = acc.add(VK.ic1.scale(pis[0]));
            acc = acc.add(VK.ic2.scale(pis[1]));
            acc = acc.add(VK.ic3.scale(pis[2]));
            break;
          default:
            throw new Error(`Unsupported input count: ${CONFIG.publicInputCount}`);
        }

        // assert that sum ic_i * pis[i] = PI

        const acc_aff = new G1Affine({
          x: acc.x.assertCanonical(),
          y: acc.y.assertCanonical(),
        });
        const acc_hash = Poseidon.hashPacked(G1Affine, acc_aff);

        return {
          publicOutput: Poseidon.hashPacked(Provable.Array(Field, 3), [
            input,
            pis_hash,
            acc_hash,
          ]),
        };
      },
    },
  },
});

const ZKP14Proof = ZkProgram.Proof(zkp14);
export { ZKP14Proof, zkp14 };
