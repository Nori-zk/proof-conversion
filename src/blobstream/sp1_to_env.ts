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
// SP1 v5: encoded_proof had a 4-byte vkey-hash prefix prepended as 0x00000000.
// SP1 v6: skip the 96-byte SP1 prefix (192 hex chars) to get the raw gnark proof.
const encodedProof = '0x' + sp1.proof.Plonk.encoded_proof.slice(192);
// SP1 v6: pi2=exit_code, pi3=vk_root, pi4=proof_nonce from public_inputs[2..4]
const pi2 = sp1.proof.Plonk.public_inputs[2];
const pi3 = sp1.proof.Plonk.public_inputs[3];
const pi4 = sp1.proof.Plonk.public_inputs[4];

const env = `\
WORK_DIR=${workDir}/${proofName}/e2e_plonk
CACHE_DIR=${workDir}/plonk_cache
HEX_PROOF="${encodedProof}"
PROGRAM_VK="${programVk}"
HEX_PI="0x${hexPi}"
PI2="${pi2}"
PI3="${pi3}"
PI4="${pi4}"
`;

fs.writeFileSync(envPath, env, 'utf8');
