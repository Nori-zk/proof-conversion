import { ZkProgram, Field, Poseidon } from 'o1js';
import { FrC } from '../../towers/index.js';
import { Accumulator } from '../accumulator.js';
import { VK } from '../vk.js';
import { SP1_VK_ROOT } from '../../sp1_vk_root.js';

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

        // Pin exit_code to 0 and vk_root to the legitimate SP1 recursion merkle root
        acc.state.pi2.assertEquals(FrC.from(0n));
        acc.state.pi3.assertEquals(SP1_VK_ROOT);

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
