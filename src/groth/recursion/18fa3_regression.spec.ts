import { rmSync, readFileSync } from 'fs';
import { Cache, Field } from 'o1js';
import { FrC } from '../../towers/index.js';
import { Groth16VendorBrand } from '../vendor.js';

const CACHE_DIR = './cache_18fa3_groth16';
const ROGUE = FrC.from(999n);

// Load real SP1 Groth16 proof (example-proofs/sp1_groth16_obj_v6.1.0.json)
const sp1Json = JSON.parse(
  readFileSync('example-proofs/sp1_groth16_obj_v6.1.0.json', 'utf-8')
);

// Extract pi values from proof per src/compute/plans/sp1/groth16.ts
const pis = sp1Json.proof.Groth16.public_inputs;
const realPi0 = FrC.from(pis[0]);
const realPi1 = FrC.from(pis[1]);
const realPi2 = FrC.from(pis[2]);
const realPi3 = FrC.from(pis[3]);
const realPi4 = FrC.from(pis[4]);

function makePis(pi0: FrC, pi1: FrC, pi2: FrC, pi3: FrC, pi4: FrC): FrC[] {
  return [pi0, pi1, pi2, pi3, pi4];
}

describe('regression_18fa3_groth16_zkp14', () => {
  let zkp14: any;

  beforeAll(async () => {
    process.env.GROTH16_VK_PATH = 'src/groth/example_jsons/vk.json';
    const mod = await import('./zkp14.js');
    const created = mod.createZkp14(5, Groth16VendorBrand.SP1);
    zkp14 = created.zkp14;
    await zkp14.compile({ cache: Cache.FileSystem(CACHE_DIR) });
  });

  afterAll(() => {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  test('correct pi values accepted', async () => {
    const pis = makePis(realPi0, realPi1, realPi2, realPi3, realPi4);
    await zkp14.compute(Field(0), pis);
  });

  test('rogue pi2 must reject non-zero exit_code', async () => {
    const pis = makePis(realPi0, realPi1, ROGUE, realPi3, realPi4);
    await expect(zkp14.compute(Field(0), pis)).rejects.toThrow();
  });

  test('rogue pi3 must reject wrong vk_root', async () => {
    const pis = makePis(realPi0, realPi1, realPi2, ROGUE, realPi4);
    await expect(zkp14.compute(Field(0), pis)).rejects.toThrow();
  });

  test('rogue pi4 accepted by design (proof_nonce)', async () => {
    const pis = makePis(realPi0, realPi1, realPi2, realPi3, ROGUE);
    await zkp14.compute(Field(0), pis);
  });
});
