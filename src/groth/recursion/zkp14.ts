import { Field, Poseidon, Provable, ZkProgram } from 'o1js';
import { FrC } from '../../towers/index.js';
import { SP1_VK_ROOT } from '../../sp1_vk_root.js';
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
        privateInputs: [Provable.Array(FrC.provable, inputCount)],
        async method(input: Field, full_pis: Array<FrC>) {
          const pis_hash = Poseidon.hashPacked(
            Provable.Array(FrC.provable, inputCount),
            full_pis
          );

          // Pin exit_code to 0 and vk_root to the legitimate SP1 recursion merkle root
          full_pis[2].assertEquals(FrC.from(0n));
          full_pis[3].assertEquals(SP1_VK_ROOT);

          let acc = new bn254({ x: VK.ic0.x, y: VK.ic0.y });

          // Handle inputs based on distribution strategy

          // Index directly into full_pis to ensure accumulation uses the same
          // values that are hashed into pis_hash (prevents unconstrained witness attack)

          // In provable code both branches of Provable.if are always evaluated, so we
          // cannot guard scale() with a plain if. Instead we replace a zero scalar with
          // a dummy non-zero value (1) so scale() never sees zero, then use Provable.if
          // to keep acc unchanged when the original scalar was zero.

          for (let i = 0; i < zkp14InputCount; i++) {
            const originalIndex = distribution.zkp14[i];
            const icIndex = originalIndex + 1; // ic1, ic2, etc.
            const icPoint = VK.getIcPoint(icIndex);
            if (!icPoint) {
              throw new Error(`Missing IC point ic${icIndex} for zkp14 input ${i}`);
            }
            const isZero = full_pis[originalIndex].equals(0n);
            const safeScalar = Provable.if(isZero, FrC.provable, FrC.from(1n), full_pis[originalIndex]);
            const scaled = icPoint.scale(safeScalar);
            const accWithScaled = acc.add(scaled);
            acc = Provable.if(isZero, bn254.provable, acc, accWithScaled);
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
