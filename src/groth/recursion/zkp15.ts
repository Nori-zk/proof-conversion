import { Field, Poseidon, Provable, ZkProgram } from 'o1js';
import { Accumulator } from './data.js';
import { Fp12, FrC } from '../../towers/index.js';
import { ArrayListHasher } from '../../array_list_hasher.js';
import { VK } from '../vk_from_env.js';
import { G1Affine } from '../../ec/index.js';
import { bn254 } from '../../ec/g1.js';
import { CONFIG } from '../config.js';

const zkp15 = ZkProgram({
  name: 'zkp15',
  publicInput: Field,
  publicOutput: Field,
  methods: {
    compute: {
      privateInputs: [G1Affine, G1Affine, Provable.Array(FrC.provable, CONFIG.publicInputCount)],
      async method(input: Field, PI: G1Affine, acc: G1Affine, pis: Array<FrC>) {
        // Note: pis.length is validated at compile time by Provable.Array constraint

        const pi_hash = Poseidon.hashPacked(G1Affine, PI);
        const pis_hash = Poseidon.hashPacked(
          Provable.Array(FrC.provable, CONFIG.publicInputCount),
          pis
        );
        const acc_hash = Poseidon.hashPacked(G1Affine, acc);
        input.assertEquals(
          Poseidon.hashPacked(Provable.Array(Field, 3), [
            pi_hash,
            pis_hash,
            acc_hash,
          ])
        );

        let accBn = new bn254({ x: acc.x, y: acc.y });
        switch (CONFIG.publicInputCount) {
          case 0:
          case 1:
          case 2:
          case 3:
            // zkp15 handles no inputs - validate acc equals PI directly
            accBn.x.assertCanonical().assertEquals(PI.x);
            accBn.y.assertCanonical().assertEquals(PI.y);
            break;
          case 4:
            // zkp15 handles [2,3]: ic3*pis[2] + ic4*pis[3] (2+2 distribution)
            accBn = accBn.add(VK.ic3.scale(pis[2]));
            accBn = accBn.add(VK.ic4.scale(pis[3]));
            accBn.x.assertCanonical().assertEquals(PI.x);
            accBn.y.assertCanonical().assertEquals(PI.y);
            break;
          case 5:
            // zkp15 handles [3,4]: ic4*pis[3] + ic5*pis[4] (3+2 distribution)
            accBn = accBn.add(VK.ic4.scale(pis[3]));
            accBn = accBn.add(VK.ic5.scale(pis[4]));
            accBn.x.assertCanonical().assertEquals(PI.x);
            accBn.y.assertCanonical().assertEquals(PI.y);
            break;
          case 6:
            // zkp15 handles [3,4,5]: ic4*pis[3] + ic5*pis[4] + ic6*pis[5] (3+3 distribution)
            accBn = accBn.add(VK.ic4.scale(pis[3]));
            accBn = accBn.add(VK.ic5.scale(pis[4]));
            accBn = accBn.add(VK.ic6.scale(pis[5]));
            accBn.x.assertCanonical().assertEquals(PI.x);
            accBn.y.assertCanonical().assertEquals(PI.y);
            break;
          default:
            throw new Error(`Unsupported input count: ${CONFIG.publicInputCount}`);
        }

        return { publicOutput: pis_hash };
      },
    },
  },
});

const ZKP15Proof = ZkProgram.Proof(zkp15);
export { ZKP15Proof, zkp15 };
