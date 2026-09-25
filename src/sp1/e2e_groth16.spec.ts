import { readFileSync } from 'fs';
import { verify, VerificationKey, Field, Poseidon, Provable } from 'o1js';
import { performSp1Groth16 } from '../api/sp1/groth16.js';
import { ComputationalPlanExecutor } from '../compute/executor.js';
import { assertExactStructure } from '../api/validation/validation.js';
import { createSp1Groth16ExampleVerifier } from './verify_sp1_groth16.js';
import { NodeProofLeft } from '../structs.js';
import { FrC } from '../towers/index.js';

// Runs the real sp1Groth16 API end to end (zkp0-zkp15 -> layer1-4 -> node)
// against the fixture in example-proofs/, then verifies the result with
// createSp1Groth16ExampleVerifier using pi1..pi5 read directly from that
// fixture, confirming they match proof.publicOutput.rightOut at the top of
// the compression tree.
describe('sp1Groth16 e2e', () => {
  test(
    'freshly generated example-generators/sp1 groth16 proof converts and verifies',
    async () => {
      const obj: unknown = JSON.parse(
        readFileSync('example-proofs/sp1_groth16_obj_v6.1.0.json', 'utf-8')
      );
      assertExactStructure(
        obj,
        performSp1Groth16.schema,
        'e2e sp1Groth16 fixture'
      );

      const realPis = obj.proof.Groth16.public_inputs.map((pi) => FrC.from(pi));

      const executor = new ComputationalPlanExecutor(6);
      const output = await performSp1Groth16(executor, obj);

      const vk = VerificationKey.fromJSON(output.vkData);
      const nodeVkDigest = Field.from(output.proofData.publicOutput[2]);
      console.log('REAL nodeVkDigest:', nodeVkDigest.toBigInt().toString());
      const proof = await NodeProofLeft.fromJSON(output.proofData);

      const { sp1Groth16ExampleVerifier } = createSp1Groth16ExampleVerifier(
        vk,
        nodeVkDigest
      );
      const compiledVk = (await sp1Groth16ExampleVerifier.compile()).verificationKey;

      const piDigest = Poseidon.hashPacked(Provable.Array(FrC.provable, 5), realPis);
      const result = await sp1Groth16ExampleVerifier.compute(piDigest, proof, realPis);

      const valid = await verify(result.proof, compiledVk);
      expect(valid).toBe(true);
    },
    30 * 60 * 1000
  );
});
