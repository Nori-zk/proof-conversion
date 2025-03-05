
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
import { PlonkComputationalPlan } from "../../compute/plans/plonk/index.js";
import { Sp1 } from "./types.js";

export async function performSp1ToPlonk(executor: ComputationalPlanExecutor, sp1: Sp1) {
    // Unpack arguments
    const hexPi = `0x${Buffer.from(sp1.public_values.buffer.data).toString('hex')}`;
    const programVK = sp1.proof.Plonk.public_inputs[0];
    const encodedProof = `0x00000000${sp1.proof.Plonk.encoded_proof}`;

    // Invoke executor
    return executor.execute(new PlonkComputationalPlan(),{hexPi, programVK, encodedProof});
}


