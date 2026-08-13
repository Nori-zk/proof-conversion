import { rmSync, readFileSync } from 'fs';
import { Cache, Field } from 'o1js';
import { FrC } from '../../towers/index.js';
import { Groth16VendorBrand } from '../vendor.js';

const CACHE_DIR_SP1 = './cache_vendor_branch_sp1';
const CACHE_DIR_RISC0 = './cache_vendor_branch_risc0';

// Real SP1 Groth16 proof (same fixture 18fa3_regression.spec.ts uses)
const sp1Json = JSON.parse(
  readFileSync('example-proofs/sp1_groth16_obj_v6.1.0.json', 'utf-8')
);
const sp1Pis = (sp1Json.proof.Groth16.public_inputs as string[]).map((p) =>
  FrC.from(p)
);

// Real, self-verified Risc0 Groth16 proof (example-generators/risc0/, risc0 v3.0.6)
const risc0Json = JSON.parse(
  readFileSync('example-proofs/risc_zero_groth16_obj.json', 'utf-8')
);
const risc0Pis = [
  risc0Json.risc0_proof.pi1,
  risc0Json.risc0_proof.pi2,
  risc0Json.risc0_proof.pi3,
  risc0Json.risc0_proof.pi4,
  risc0Json.risc0_proof.pi5,
].map((p: string) => FrC.from(p));

describe('vendor_branch_regression_zkp14', () => {
  let zkp14Sp1: any;
  let zkp14Risc0: any;

  beforeAll(async () => {
    process.env.GROTH16_VK_PATH = 'src/groth/example_jsons/vk.json';
    const mod = await import('./zkp14.js');
    zkp14Sp1 = mod.createZkp14(5, Groth16VendorBrand.SP1).zkp14;
    await zkp14Sp1.compile({ cache: Cache.FileSystem(CACHE_DIR_SP1) });
    zkp14Risc0 = mod.createZkp14(5, Groth16VendorBrand.Risc0).zkp14;
    await zkp14Risc0.compile({ cache: Cache.FileSystem(CACHE_DIR_RISC0) });
  });

  afterAll(() => {
    rmSync(CACHE_DIR_SP1, { recursive: true, force: true });
    rmSync(CACHE_DIR_RISC0, { recursive: true, force: true });
  });

  test('real SP1 proof accepted when compiled for the SP1 vendor (sanity)', async () => {
    await zkp14Sp1.compute(Field(0), sp1Pis);
  });

  test('real Risc0 proof accepted when compiled for the Risc0 vendor (sanity)', async () => {
    await zkp14Risc0.compute(Field(0), risc0Pis);
  });

  test('real Risc0 proof rejected when compiled for the SP1 vendor', async () => {
    await expect(zkp14Sp1.compute(Field(0), risc0Pis)).rejects.toThrow();
  });

  test('real SP1 proof rejected when compiled for the Risc0 vendor', async () => {
    await expect(zkp14Risc0.compute(Field(0), sp1Pis)).rejects.toThrow();
  });
});
