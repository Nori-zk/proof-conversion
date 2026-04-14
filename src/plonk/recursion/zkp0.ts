import { ZkProgram, Field, Poseidon } from 'o1js';
import { Accumulator } from '../accumulator.js';
import { VK } from '../vk.js';

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
