import { readFileSync } from 'fs';
import { verify, VerificationKey, Field, Poseidon, Provable } from 'o1js';
import { performSp1Plonk } from '../api/sp1/plonk.js';
import { ComputationalPlanExecutor } from '../compute/executor.js';
import { assertExactStructure } from '../api/validation/validation.js';
import { createSp1PlonkExampleVerifier } from './verify_sp1_plonk.js';
import { NodeProofLeft } from '../structs.js';
import { FrC } from '../towers/index.js';

// Runs the real sp1Plonk API end to end (zkp0-zkp23 -> layer1-5 -> node)
// against the fixture in example-proofs/, then verifies the result with
// createSp1PlonkExampleVerifier using pi0 (vkey_hash) and pi1
// (committed_values_digest) read directly from that fixture, confirming
// they match proof.publicOutput.rightOut at the top of the compression
// tree.
describe('sp1Plonk e2e', () => {
  test(
    'freshly generated example-generators/sp1 plonk proof converts and verifies',
    async () => {
      const obj: unknown = JSON.parse(
        readFileSync('example-proofs/sp1_plonk_obj_v6.1.0.json', 'utf-8')
      );
      assertExactStructure(obj, performSp1Plonk.schema, 'e2e sp1Plonk fixture');

      const pi0 = FrC.from(obj.proof.Plonk.public_inputs[0]);
      const pi1 = FrC.from(obj.proof.Plonk.public_inputs[1]);

      const executor = new ComputationalPlanExecutor(6);
      const output = await performSp1Plonk(executor, obj);

      const vk = VerificationKey.fromJSON(output.vkData);
      const nodeVkDigest = Field.from(output.proofData.publicOutput[2]);
      console.log('REAL nodeVkDigest:', nodeVkDigest.toBigInt().toString());
      const proof = await NodeProofLeft.fromJSON(output.proofData);

      const { sp1PlonkExampleVerifier } = createSp1PlonkExampleVerifier(
        vk,
        nodeVkDigest
      );
      const compiledVk = (await sp1PlonkExampleVerifier.compile()).verificationKey;

      const { Poseidon, Provable } = await import('o1js');
      const piDigest = Poseidon.hashPacked(Provable.Array(FrC.provable, 2), [pi0, pi1]);
      const result = await sp1PlonkExampleVerifier.compute(piDigest, proof, pi0, pi1);

      const valid = await verify(result.proof, compiledVk);
      expect(valid).toBe(true);
    },
    30 * 60 * 1000
  );
});
