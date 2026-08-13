import { resolve } from 'path';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { createDirectory } from './utils/cache.js';
import { getRandomString } from './utils/random.js';
import { Groth16VendorBrand, parseGroth16VendorBrand } from './groth/vendor.js';
import rootDir from './utils/root_dir.js';
import {
  computeRisc0Groth16Pairing,
  convertSp1Groth16ToO1js,
  convertSnarkjsGroth16ToO1js,
} from './pairing-utils/index.js';

function usage(): never {
  console.error('usage: npm run vk-tree -- plonk');
  console.error('       npm run vk-tree -- groth16 <sp1|risc0>');
  console.error('       npm run vk-tree -- groth16 snarkjs <snarkjsObjPath>');
  process.exit(1);
}

const [, , family, vendorArg, vkPathArg] = process.argv;

// sp1 and risc0 each verify against one fixed, vendor-owned Groth16 VK.
// snarkjs has no such fixed VK - every circuit has its own - so it's the
// only vendor that takes one as an argument.
const FIXED_VENDOR_VK_PATHS: Partial<Record<Groth16VendorBrand, string>> = {
  [Groth16VendorBrand.SP1]: resolve(rootDir, 'example-proofs', 'sp1_groth16_obj_v6.1.0.json'),
  [Groth16VendorBrand.Risc0]: resolve(rootDir, 'example-proofs', 'risc_zero_groth16_args_vk.json'),
};

const cacheDir = resolve(
  process.cwd(),
  '.conversion-cache',
  getRandomString(20)
);
createDirectory(cacheDir);

try {
  let digest;
  if (family === 'plonk') {
    if (vendorArg !== undefined) usage();
    const { buildPlonkVkTree } = await import('./plonk/zkp_tree.js');
    digest = await buildPlonkVkTree(cacheDir);
  } else if (family === 'groth16') {
    if (vendorArg === undefined) usage();
    const vendor = parseGroth16VendorBrand(vendorArg);

    const fixedVkPath = FIXED_VENDOR_VK_PATHS[vendor];
    if (fixedVkPath !== undefined) {
      if (vkPathArg !== undefined) usage();

      // GrothVk.parse (src/groth/vk.ts) needs an o1js VK carrying alpha_beta.
      // Derive it from the fixture the same way the vendor's computation plan
      // does (src/compute/plans/{risc0,sp1}/groth16.ts): risc0's fixture is a
      // raw VK enriched via computeRisc0Groth16Pairing; sp1's is a proof
      // object converted via convertSp1Groth16ToO1js.
      const fixture = JSON.parse(readFileSync(fixedVkPath, 'utf-8'));
      const vk =
        vendor === Groth16VendorBrand.Risc0
          ? computeRisc0Groth16Pairing(fixture)
          : convertSp1Groth16ToO1js(fixture).vk;

      const enrichedVkPath = resolve(cacheDir, 'groth16_vk.json');
      writeFileSync(enrichedVkPath, JSON.stringify(vk));
      process.env.GROTH16_VK_PATH = enrichedVkPath;
    } else {
      // snarkjs: the caller supplies a snarkjs { proof, publicInputs, vk }
      // bundle. convertSnarkjsGroth16ToO1js computes alpha_beta and sizes the
      // IC points from that bundle's own public inputs, matching
      // src/compute/plans/snarkjs/groth16.ts.
      if (vkPathArg === undefined) usage();
      const { proof, publicInputs, vk } = JSON.parse(readFileSync(vkPathArg, 'utf-8'));
      const enrichedVk = convertSnarkjsGroth16ToO1js(proof, publicInputs, vk).vk;

      const enrichedVkPath = resolve(cacheDir, 'groth16_vk.json');
      writeFileSync(enrichedVkPath, JSON.stringify(enrichedVk));
      process.env.GROTH16_VK_PATH = enrichedVkPath;
    }

    // zkp0-zkp15 (src/groth/recursion/) read GROTH16_VK_PATH at module load
    // time, so it must be set before ./groth/zkp_tree.js - which
    // transitively imports all of them - is ever imported.
    const { buildGroth16VkTree } = await import('./groth/zkp_tree.js');
    digest = await buildGroth16VkTree(vendor, cacheDir);
  } else {
    usage();
  }

  console.log(digest.toBigInt().toString());
} finally {
  rmSync(cacheDir, { recursive: true, force: true });
}
