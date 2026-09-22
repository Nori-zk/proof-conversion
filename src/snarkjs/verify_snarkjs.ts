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
// must chain from. snarkjs circuits have between 0 and 6 public inputs (see
// src/groth/config.ts's getDistribution), hence the inputCount parameter.
// proof.publicOutput.rightOut is checked against a digest of the public
// inputs, confirming they match what appears at the top of the compression
// tree.
export function createSnarkjsGroth16ExampleVerifier(
  vk: VerificationKey,
  nodeVkDigest: Field,
  inputCount: number
) {
  const snarkjsGroth16ExampleVerifier = ZkProgram({
    name: `SnarkjsGroth16ExampleVerifier_${inputCount}`,
    publicInput: Field,
    publicOutput: Undefined,
    methods: {
      compute: {
        privateInputs: [NodeProofLeft, Provable.Array(FrC.provable, inputCount)],
        async method(input: Field, proof: NodeProofLeft, pis: Array<FrC>) {
          proof.verify(vk);
          proof.publicOutput.subtreeVkDigest.assertEquals(nodeVkDigest);

          const piDigest = Poseidon.hashPacked(
            Provable.Array(FrC.provable, inputCount),
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
    snarkjsGroth16ExampleVerifier,
    SnarkjsGroth16ExampleProof: ZkProgram.Proof(snarkjsGroth16ExampleVerifier),
  };
}
