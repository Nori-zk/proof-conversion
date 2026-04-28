import { getMlo } from './get_mlo.js';
import fs from 'fs';

const args = process.argv;
// assert(args.length >= 6)

const mloPath = args[2];
const hexProof = args[3];
const programVk = args[4];
const hexPi = args[5];
// SP1 v5: args[5]=hexPi was last arg.
// SP1 v6: pi2/pi3/pi4 inserted at args[6..8] (exit_code/vk_root/proof_nonce from public_inputs[2..4]).
const pi2 = args[6];
const pi3 = args[7];
const pi4 = args[8];

const mlo = getMlo(hexProof, programVk, hexPi, pi2, pi3, pi4);
fs.writeFileSync(mloPath, mlo.toJSON(), 'utf-8');
console.log(`JSON data has been written to ${mloPath}`);
