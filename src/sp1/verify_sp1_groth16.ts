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
// must chain from. proof.publicOutput.rightOut is checked against a digest
// of the 5 public inputs, confirming they match what appears at the top of
// the compression tree.
export function createSp1Groth16ExampleVerifier(
  vk: VerificationKey,
  nodeVkDigest: Field
) {
  const sp1Groth16ExampleVerifier = ZkProgram({
    name: 'Sp1Groth16ExampleVerifier',
    publicInput: Field,
    publicOutput: Undefined,
    methods: {
      compute: {
        privateInputs: [NodeProofLeft, Provable.Array(FrC.provable, 5)],
        async method(input: Field, proof: NodeProofLeft, pis: Array<FrC>) {
          proof.verify(vk);
          proof.publicOutput.subtreeVkDigest.assertEquals(nodeVkDigest);

          const piDigest = Poseidon.hashPacked(
            Provable.Array(FrC.provable, 5),
            pis
          );
          piDigest.assertEquals(input);
          piDigest.assertEquals(proof.publicOutput.rightOut);

          return undefined;
        },
      },
    },
  });

  return {
    sp1Groth16ExampleVerifier,
    Sp1Groth16ExampleProof: ZkProgram.Proof(sp1Groth16ExampleVerifier),
  };
}
