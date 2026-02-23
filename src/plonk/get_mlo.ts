import { Sp1PlonkVerifier } from './verifier.js';
import { VK } from './vk.js';
import { Sp1PlonkProof, deserializeProof } from './proof.js';
import { parsePublicInputs } from './parse_pi.js';
import { Fp12 } from '../towers/fp12.js';
import { FrC } from '../towers/index.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const g2_lines_required = require('./mm_loop/g2_lines.json');
const tau_lines_required = require('./mm_loop/tau_lines.json');
//import g2_lines_required from './mm_loop/g2_lines.json';
//import tau_lines_required from './mm_loop/tau_lines.json';
const g2_lines = JSON.stringify(g2_lines_required); //fs.readFileSync(`./src/plonk/mm_loop/g2_lines.json`, 'utf8');
const tau_lines = JSON.stringify(tau_lines_required); //fs.readFileSync(`./src/plonk/mm_loop/tau_lines.json`, 'utf8');

// SP1 v5: getMlo(hexProof, programVk, hexPi) — only pi0/pi1.
// SP1 v6: pi2/pi3/pi4 (hex strings from public_inputs[2..4]) added.
export function getMlo(
  hexProof: string,
  programVk: string,
  hexPi: string,
  pi2: string,
  pi3: string,
  pi4: string
): Fp12 {
  console.log(hexProof, programVk, hexPi);
  const [pi0, pi1] = parsePublicInputs(programVk, hexPi);

  const Verifier = new Sp1PlonkVerifier(VK, g2_lines, tau_lines);

  const proof = new Sp1PlonkProof(deserializeProof(hexProof));
  return Verifier.computeMlo(proof, pi0, pi1, FrC.from(pi2), FrC.from(pi3), FrC.from(pi4));
}
