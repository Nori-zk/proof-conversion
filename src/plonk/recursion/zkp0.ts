import { ZkProgram, Field, Poseidon } from 'o1js';
import { Accumulator } from '../accumulator.js';
import { VK } from '../vk.js';
import { G1Affine } from '../../ec/index.js';

// ~ 52792
const zkp0 = ZkProgram({
  name: 'zkp0',
  publicInput: Field,
  publicOutput: Field,
  methods: {
    compute: {
      privateInputs: [Accumulator],
      async method(input: Field, acc: Accumulator) {
        const inDigest = Poseidon.hashPacked(Accumulator, acc);
        inDigest.assertEquals(input);

        // G1 on-curve checks: BN254 G1 has prime order so on-curve implies subgroup membership.
        // All 10 prover-supplied points enter as raw coordinates, so we assert
        // y^2 = x^3 + 3 here at first use.
        new G1Affine({ x: acc.proof.l_com_x, y: acc.proof.l_com_y }).assertOnCurve();
        new G1Affine({ x: acc.proof.r_com_x, y: acc.proof.r_com_y }).assertOnCurve();
        new G1Affine({ x: acc.proof.o_com_x, y: acc.proof.o_com_y }).assertOnCurve();
        new G1Affine({ x: acc.proof.qcp_0_wire_x, y: acc.proof.qcp_0_wire_y }).assertOnCurve();
        new G1Affine({ x: acc.proof.grand_product_x, y: acc.proof.grand_product_y }).assertOnCurve();
        new G1Affine({ x: acc.proof.h0_x, y: acc.proof.h0_y }).assertOnCurve();
        new G1Affine({ x: acc.proof.h1_x, y: acc.proof.h1_y }).assertOnCurve();
        new G1Affine({ x: acc.proof.h2_x, y: acc.proof.h2_y }).assertOnCurve();
        new G1Affine({ x: acc.proof.batch_opening_at_zeta_x, y: acc.proof.batch_opening_at_zeta_y }).assertOnCurve();
        new G1Affine({ x: acc.proof.batch_opening_at_zeta_omega_x, y: acc.proof.batch_opening_at_zeta_omega_y }).assertOnCurve();

        // SP1 v5: only pi0/pi1 were hashed into gamma.
        // SP1 v6: pi2/pi3/pi4 (exit_code/vk_root/proof_nonce) must also be hashed.
        acc.fs.squeezeGamma(acc.proof, acc.state.pi0, acc.state.pi1, acc.state.pi2, acc.state.pi3, acc.state.pi4, VK);
        acc.fs.squeezeBeta();

        return {
          publicOutput: Poseidon.hashPacked(Accumulator, acc),
        };
      },
    },
  },
});

const ZKP0Proof = ZkProgram.Proof(zkp0);
export { ZKP0Proof, zkp0 };
