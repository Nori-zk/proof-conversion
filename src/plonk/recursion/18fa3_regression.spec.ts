import { rmSync, readFileSync } from 'fs';
import { Cache, Poseidon } from 'o1js';
import { FrC } from '../../towers/index.js';
import { zkp0 } from './zkp0.js';
import { Accumulator } from '../accumulator.js';
import { Sp1PlonkProof, deserializeProof } from '../proof.js';
import { Sp1PlonkFiatShamir } from '../fiat-shamir/index.js';
import { StateUntilPairing, empty } from '../state.js';
import { parsePublicInputs } from '../parse_pi.js';
const CACHE_DIR = './cache_18fa3_plonk';
const ROGUE = FrC.from(999n);

// Load real SP1 PLONK proof (example-proofs/sp1_plonk_obj_v6.1.0.json)
const sp1Json = JSON.parse(
  readFileSync('example-proofs/sp1_plonk_obj_v6.1.0.json', 'utf-8')
);

// Extract fields per src/compute/plans/sp1/plonk.ts:57-63
const hexPi = `0x${Buffer.from(sp1Json.public_values.buffer.data).toString('hex')}`;
const programVk = sp1Json.proof.Plonk.public_inputs[0];
const hexProof = `0x${sp1Json.proof.Plonk.encoded_proof.slice(192)}`;
const pi2Str = sp1Json.proof.Plonk.public_inputs[2];
const pi3Str = sp1Json.proof.Plonk.public_inputs[3];
const pi4Str = sp1Json.proof.Plonk.public_inputs[4];

// Construct accumulator per src/plonk/recursion/prove_zkps.ts:52-67
function makeAcc(pi0: FrC, pi1: FrC, pi2: FrC, pi3: FrC, pi4: FrC) {
  const proof = new Sp1PlonkProof(deserializeProof(hexProof));
  const fs = Sp1PlonkFiatShamir.empty();
  const state = new StateUntilPairing(empty(pi0, pi1, pi2, pi3, pi4));
  return new Accumulator({ proof, fs, state });
}

const [realPi0, realPi1] = parsePublicInputs(programVk, hexPi);
const realPi2 = FrC.from(pi2Str);
const realPi3 = FrC.from(pi3Str);
const realPi4 = FrC.from(pi4Str);

describe('regression_18fa3_plonk_zkp0', () => {
  beforeAll(async () => {
    await zkp0.compile({ cache: Cache.FileSystem(CACHE_DIR) });
  });

  afterAll(() => {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  test('correct pi values accepted', async () => {
    const acc = makeAcc(realPi0, realPi1, realPi2, realPi3, realPi4);
    const input = Poseidon.hashPacked(Accumulator, acc);
    await zkp0.compute(input, acc);
  });

  test('rogue pi2 must reject non-zero exit_code', async () => {
    const acc = makeAcc(realPi0, realPi1, ROGUE, realPi3, realPi4);
    const input = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(input, acc)).rejects.toThrow();
  });

  test('rogue pi3 must reject wrong vk_root', async () => {
    const acc = makeAcc(realPi0, realPi1, realPi2, ROGUE, realPi4);
    const input = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(input, acc)).rejects.toThrow();
  });

  test('rogue pi4 accepted by design (proof_nonce)', async () => {
    const acc = makeAcc(realPi0, realPi1, realPi2, realPi3, ROGUE);
    const input = Poseidon.hashPacked(Accumulator, acc);
    await zkp0.compute(input, acc);
  });
});
