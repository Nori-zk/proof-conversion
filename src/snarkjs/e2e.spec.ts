import { readFileSync } from 'fs';
import { verify, VerificationKey, Field, Poseidon, Provable } from 'o1js';
import { performSnarkjsGroth16 } from '../api/snarkjs/groth16.js';
import { ComputationalPlanExecutor } from '../compute/executor.js';
import { assertExactStructure } from '../api/validation/validation.js';
import { createSnarkjsGroth16ExampleVerifier } from './verify_snarkjs.js';
import { NodeProofLeft } from '../structs.js';
import { FrC } from '../towers/index.js';

// Runs the real snarkjsGroth16 API end to end (zkp0-zkp15 -> layer1-4 ->
// node) against the fixture in example-proofs/, then verifies the result
// with createSnarkjsGroth16ExampleVerifier using the public inputs read
// directly from that fixture, confirming they match
// proof.publicOutput.rightOut at the top of the compression tree.
describe('snarkjsGroth16 e2e', () => {
  test(
    'freshly generated example-generators/snarkjs proof converts and verifies',
    async () => {
      const obj: unknown = JSON.parse(
        readFileSync('example-proofs/snarkjs_groth16_obj.json', 'utf-8')
      );
      assertExactStructure(
        obj,
        performSnarkjsGroth16.schema,
        'e2e snarkjsGroth16 fixture'
      );

      const realPis = obj.publicInputs.map((pi) => FrC.from(pi));
      const inputCount = realPis.length;

      const executor = new ComputationalPlanExecutor(6);
      const output = await performSnarkjsGroth16(executor, obj);

      const vk = VerificationKey.fromJSON(output.vkData);
      const nodeVkDigest = Field.from(output.proofData.publicOutput[2]);
      console.log('REAL nodeVkDigest:', nodeVkDigest.toBigInt().toString());
      const proof = await NodeProofLeft.fromJSON(output.proofData);

      const { snarkjsGroth16ExampleVerifier } = createSnarkjsGroth16ExampleVerifier(
        vk,
        nodeVkDigest,
        inputCount
      );
      const compiledVk = (await snarkjsGroth16ExampleVerifier.compile()).verificationKey;

      const piDigest = Poseidon.hashPacked(
        Provable.Array(FrC.provable, inputCount),
        realPis
      );
      const result = await snarkjsGroth16ExampleVerifier.compute(piDigest, proof, realPis);

      const valid = await verify(result.proof, compiledVk);
      expect(valid).toBe(true);
    },
    30 * 60 * 1000
  );
});
