import {
  Field,
  Provable,
  VerificationKey,
  Poseidon,
  ZkProgram,
  Undefined,
} from 'o1js';
import { FrC } from '../towers/index.js';
import { NodeProofLeft } from '../structs.js';

// vk and nodeVkDigest identify the specific compiled circuit tree a proof
// must chain from. zkp23 (src/plonk/recursion/zkp23.ts) hashes only pi0
// (vkey_hash) and pi1 (committed_values_digest) into its publicOutput -
// exit_code/vk_root/proof_nonce are pinned in-circuit by zkp0 and not
// propagated further - so proof.publicOutput.rightOut is checked against a
// digest of exactly those two values, matching the pi0/pi1 check the Mina
// bridge contract itself performs.
export function createSp1PlonkExampleVerifier(
  vk: VerificationKey,
  nodeVkDigest: Field
) {
  const sp1PlonkExampleVerifier = ZkProgram({
    name: 'Sp1PlonkExampleVerifier',
    publicInput: Field,
    publicOutput: Undefined,
    methods: {
      compute: {
        privateInputs: [NodeProofLeft, FrC.provable, FrC.provable],
        async method(
          input: Field,
          proof: NodeProofLeft,
          pi0: FrC,
          pi1: FrC
        ) {
          proof.verify(vk);
          proof.publicOutput.subtreeVkDigest.assertEquals(nodeVkDigest);

          const piDigest = Poseidon.hashPacked(
            Provable.Array(FrC.provable, 2),
            [pi0, pi1]
          );
          piDigest.assertEquals(input);
          piDigest.assertEquals(proof.publicOutput.rightOut);

          return undefined;
        },
      },
    },
  });

  return {
    sp1PlonkExampleVerifier,
    Sp1PlonkExampleProof: ZkProgram.Proof(sp1PlonkExampleVerifier),
  };
}
