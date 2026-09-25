import { readFileSync } from 'fs';
import { verify, VerificationKey, Field, Poseidon, Provable } from 'o1js';
import { performRisc0Groth16 } from '../api/risc0/groth16.js';
import { ComputationalPlanExecutor } from '../compute/executor.js';
import { assertExactStructure } from '../api/validation/validation.js';
import { createRiscZeroExampleVerifier } from './verify_risc_zero.js';
import { NodeProofLeft } from '../structs.js';
import { FrC } from '../towers/index.js';

// Runs the real risc0Groth16 API end to end (zkp0-zkp15 -> layer1-4 -> node)
// against the fixture in example-proofs/, then verifies the result with
// createRiscZeroExampleVerifier using pi1..pi5 read directly from that
// fixture, confirming they match proof.publicOutput.rightOut at the top of
// the compression tree.
describe('risc0Groth16 e2e', () => {
  test(
    'freshly generated example-generators/risc0 proof converts and verifies',
    async () => {
      const obj: unknown = JSON.parse(
        readFileSync('example-proofs/risc_zero_groth16_obj.json', 'utf-8')
      );
      assertExactStructure(
        obj,
        performRisc0Groth16.schema,
        'e2e risc0Groth16 fixture'
      );

      const realPis = [
        obj.risc0_proof.pi1,
        obj.risc0_proof.pi2,
        obj.risc0_proof.pi3,
        obj.risc0_proof.pi4,
        obj.risc0_proof.pi5,
      ].map((pi) => FrC.from(pi));

      const executor = new ComputationalPlanExecutor(6);
      const output = await performRisc0Groth16(executor, obj);

      const vk = VerificationKey.fromJSON(output.vkData);
      const nodeVkDigest = Field.from(output.proofData.publicOutput[2]);
      console.log('REAL nodeVkDigest:', nodeVkDigest.toBigInt().toString());
      const proof = await NodeProofLeft.fromJSON(output.proofData);

      const { riscZeroExampleVerifier } = createRiscZeroExampleVerifier(
        vk,
        nodeVkDigest
      );
      const compiledVk = (await riscZeroExampleVerifier.compile()).verificationKey;

      const piDigest = Poseidon.hashPacked(Provable.Array(FrC.provable, 5), realPis);
      const result = await riscZeroExampleVerifier.compute(piDigest, proof, realPis);

      const valid = await verify(result.proof, compiledVk);
      expect(valid).toBe(true);
    },
    30 * 60 * 1000
  );
});
