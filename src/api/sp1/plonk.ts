
/*

const outputFilePathVK = path.resolve(outputFolderPath, 'e2e_plonk', 'vks', 'nodeVk.json');
const outputFilePathProof = path.resolve(outputFolderPath, 'e2e_plonk', 'proofs', 'layer5', 'p0.json');

import fs from 'fs';

const args = process.argv;

const sp1Proof = args[2];
const runDir = args[3];
const workDir = args[4];
const proofName = args[5];
const envPath = `${runDir}/env.${proofName}`;

const sp1 = JSON.parse(fs.readFileSync(sp1Proof, 'utf8'));
const hexPi = Buffer.from(sp1.public_values.buffer.data).toString('hex');
const programVk = sp1.proof.Plonk.public_inputs[0];
const encodedProof = sp1.proof.Plonk.encoded_proof;

const env = `\
WORK_DIR=${workDir}/${proofName}/e2e_plonk
CACHE_DIR=${workDir}/plonk_cache
HEX_PROOF="0x00000000${encodedProof}"
PROGRAM_VK="${programVk}"
HEX_PI="0x${hexPi}"
`;

fs.writeFileSync(envPath, env, 'utf8');

*/

import { ComputationalPlanExecutor } from "../../compute/execute.js";
import { PlonkComputationalPlan, PlonkInput } from "../../compute/plans/plonk";
import { Sp1 } from "./types.js";

export async function performSp1Plonk(sp1: Sp1) {
    // Unpack argument

    const hexPi = `0x${Buffer.from(sp1.public_values.buffer.data).toString('hex')}`;
    const programVK = sp1.proof.Plonk.public_inputs[0];
    const encodedProof = `0x00000000${sp1.proof.Plonk.encoded_proof}`;

    const proofInput: PlonkInput = {hexPi, programVK, encodedProof};

    const executor = new ComputationalPlanExecutor(2);
    const result = executor.execute(new PlonkComputationalPlan(),proofInput);
}


/*

import { ComputationalPlanExecutor } from "./execute.js";
import { NumaNodeTestComputationPlan } from "./plans/tests/numa.js";

async function main() {
    const testPlanExecutor = new ComputationalPlanExecutor(12);
    const result = await testPlanExecutor.execute(new NumaNodeTestComputationPlan(), "TestInput");
    console.log(result);
    console.log(testPlanExecutor.workerFreeStatus());
}

main().catch(console.error);


*/

