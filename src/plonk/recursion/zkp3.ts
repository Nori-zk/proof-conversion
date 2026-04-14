import { ZkProgram, Field, Poseidon } from 'o1js';
import { Accumulator } from '../accumulator.js';
import { fold_quotient_split_1 } from '../piop/plonk_utils.js';
import {
  customPiLagrange,
  opening_of_linearized_polynomial,
  pi_contribution,
} from '../piop/plonk_utils.js';
import { VK } from '../vk.js';

const zkp3 = ZkProgram({
  name: 'zkp3',
  publicInput: Field,
  publicOutput: Field,
  methods: {
    compute: {
      privateInputs: [Accumulator],
      async method(input: Field, acc: Accumulator) {
        const inDigest = Poseidon.hashPacked(Accumulator, acc);
        inDigest.assertEquals(input);

        const [hx, hy] = fold_quotient_split_1(
          acc.state.hx,
          acc.state.hy,
          acc.state.zh_eval
        );

        acc.state.hx = hx;
        acc.state.hy = hy;

        // SP1 v5: only [pi0, pi1] contributed to the public input sum.
        // SP1 v6: all 5 public inputs [pi0..pi4] must be included.
        const pis = pi_contribution(
          [acc.state.pi0, acc.state.pi1, acc.state.pi2, acc.state.pi3, acc.state.pi4],
          acc.fs.zeta,
          acc.state.zh_eval,
          VK.inv_domain_size,
          VK.omega
        );

        // ~32k
        const l_pi_commit = customPiLagrange(
          acc.fs.zeta,
          acc.state.zh_eval,
          acc.proof.qcp_0_wire_x,
          acc.proof.qcp_0_wire_y,
          VK
        );
        const pi = pis.add(l_pi_commit).assertCanonical();

        // very cheap
        const linearized_opening = opening_of_linearized_polynomial(
          acc.proof,
          acc.fs.alpha,
          acc.fs.beta,
          acc.fs.gamma,
          pi,
          acc.state.alpha_2_l0
        );

        acc.state.pi = pi;
        acc.state.linearized_opening = linearized_opening;

        return { publicOutput: Poseidon.hashPacked(Accumulator, acc) };
      },
    },
  },
});

const ZKP3Proof = ZkProgram.Proof(zkp3);
export { ZKP3Proof, zkp3 };
