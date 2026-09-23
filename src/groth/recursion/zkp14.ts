import { Field, Poseidon, Provable, ZkProgram } from 'o1js';
import { FrC } from '../../towers/index.js';
import { SP1_VK_ROOT } from '../../sp1_vk_root.js';
import {
  RISC0_CONTROL_ROOT_0,
  RISC0_CONTROL_ROOT_1,
  RISC0_BN254_CONTROL_ID,
} from '../../risc0_control_id.js';
import { VK } from '../vk_from_env.js';
import { G1Affine } from '../../ec/index.js';
import { bn254 } from '../../ec/g1.js';
import { getDistribution } from '../config.js';
import { Groth16VendorBrand } from '../vendor.js';

// Factory function to create zkp14 with correct public input array size
export function createZkp14(inputCount: number, vendor: Groth16VendorBrand) {
  const distribution = getDistribution(inputCount);
  const zkp14InputCount = distribution.zkp14.length;

  const zkp14 = ZkProgram({
    name: `zkp14_${vendor}_${inputCount}inputs`,
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

          // Pin the public inputs that identify which recursion/verification
          // keys the underlying proof trusts to their legitimate vendor
          // values. Which inputs (if any) need pinning, and to what, differs
          // per vendor - see src/groth/vendor.ts.
          switch (vendor) {
            case Groth16VendorBrand.SP1:
              // pi3 (exit_code) must be 0; pi4 (vk_root) must be the
              // legitimate SP1 recursion merkle root.
              full_pis[2].assertEquals(FrC.from(0n));
              full_pis[3].assertEquals(SP1_VK_ROOT);
              break;
            case Groth16VendorBrand.Risc0:
              // pi1/pi2 are the two halves of the recursion control root;
              // pi5 is the BN254 identity control id. See
              // pairing-utils/src/risc0_control_id.rs for the derivation.
              full_pis[0].assertEquals(RISC0_CONTROL_ROOT_0);
              full_pis[1].assertEquals(RISC0_CONTROL_ROOT_1);
              full_pis[4].assertEquals(RISC0_BN254_CONTROL_ID);
              break;
            case Groth16VendorBrand.Snarkjs:
              // snarkjs circuits are fully user-defined - there is no
              // vendor-fixed recursion/verification key to pin here.
              break;
            default:
              throw new Error(`Unknown Groth16VendorBrand '${vendor}'! Pick on of ${Object.values(Groth16VendorBrand).join(', ')}`)
          }

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
