import { Field, Poseidon, Provable, ZkProgram } from 'o1js';
import { FrC } from '../../towers/index.js';
import { VK } from '../vk_from_env.js';
import { G1Affine } from '../../ec/index.js';
import { bn254 } from '../../ec/g1.js';
import { getDistribution } from '../config.js';

// Factory function to create zkp15 with correct public input array size
export function createZkp15(inputCount: number) {
  const distribution = getDistribution(inputCount);
  const zkp15InputCount = distribution.zkp15.length;

  const zkp15 = ZkProgram({
    name: `zkp15_${inputCount}inputs`,
    publicInput: Field,
    publicOutput: Field,
    methods: {
      compute: {
        privateInputs: [G1Affine, G1Affine, Provable.Array(FrC.provable, zkp15InputCount), Provable.Array(FrC.provable, inputCount)],
        async method(input: Field, PI: G1Affine, acc: G1Affine, zkp15_pis: Array<FrC>, full_pis: Array<FrC>) {
          const pi_hash = Poseidon.hashPacked(G1Affine, PI);
          const pis_hash = Poseidon.hashPacked(
            Provable.Array(FrC.provable, inputCount),
            full_pis
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

          // Handle inputs based on distribution strategy
          for (let i = 0; i < zkp15InputCount; i++) {
            const originalIndex = distribution.zkp15[i]; // original index in pis array
            const icIndex = originalIndex + 1; // ic1, ic2, etc.
            const icPoint = VK.getIcPoint(icIndex);
            if (!icPoint) {
              throw new Error(`Missing IC point ic${icIndex} for zkp15 input ${i}`);
            }
            accBn = accBn.add(icPoint.scale(zkp15_pis[i])); // Use local index i for the zkp15 subset
          }

          // Verify that the accumulated result equals PI
          accBn.x.assertCanonical().assertEquals(PI.x);
          accBn.y.assertCanonical().assertEquals(PI.y);


          return { publicOutput: pis_hash };
        },
      },
    },
  });

  return { zkp15, ZKP15Proof: ZkProgram.Proof(zkp15) };
}

// Default export for backwards compatibility (can be removed later)
const { zkp15, ZKP15Proof } = createZkp15(5); // Default to 5 inputs for Risc0
export { ZKP15Proof, zkp15 };
