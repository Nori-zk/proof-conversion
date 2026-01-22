import { Field, Poseidon, Provable, ZkProgram } from 'o1js';
import { FrC } from '../../towers/index.js';
import { VK } from '../vk_from_env.js';
import { G1Affine } from '../../ec/index.js';
import { bn254 } from '../../ec/g1.js';
import { getDistribution } from '../config.js';

// Factory function to create zkp14 with correct public input array size
export function createZkp14(inputCount: number) {
  const distribution = getDistribution(inputCount);
  const zkp14InputCount = distribution.zkp14.length;

  const zkp14 = ZkProgram({
    name: `zkp14_${inputCount}inputs`,
    publicInput: Field,
    publicOutput: Field,
    methods: {
      compute: {
        privateInputs: [Provable.Array(FrC.provable, zkp14InputCount), Provable.Array(FrC.provable, inputCount)],
        async method(input: Field, zkp14_pis: Array<FrC>, full_pis: Array<FrC>) {
          const pis_hash = Poseidon.hashPacked(
            Provable.Array(FrC.provable, inputCount),
            full_pis
          );

          let acc = new bn254({ x: VK.ic0.x, y: VK.ic0.y });

          // Handle inputs based on distribution strategy
          for (let i = 0; i < zkp14InputCount; i++) {
            const icIndex = distribution.zkp14[i] + 1; // ic1, ic2, etc.
            const icPoint = VK.getIcPoint(icIndex);
            if (!icPoint) {
              throw new Error(`Missing IC point ic${icIndex} for zkp14 input ${i}`);
            }
            acc = acc.add(icPoint.scale(zkp14_pis[i]));
          }

          const acc_aff = new G1Affine({
            x: acc.x.assertCanonical(),
            y: acc.y.assertCanonical(),
          });
          const acc_hash = Poseidon.hashPacked(G1Affine, acc_aff);

          const publicOutput = Poseidon.hashPacked(Provable.Array(Field, 3), [
            input,
            pis_hash,
            acc_hash,
          ]);


          return { publicOutput };
        },
      },
    },
  });

  return { zkp14, ZKP14Proof: ZkProgram.Proof(zkp14) };
}

// Default export for backwards compatibility (can be removed later)
const { zkp14, ZKP14Proof } = createZkp14(5); // Default to 5 inputs for Risc0
export { ZKP14Proof, zkp14 };
