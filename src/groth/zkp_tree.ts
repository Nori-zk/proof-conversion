import { resolve } from 'path';
import { mkdirSync, readFileSync } from 'fs';
import { Field, VerificationKey } from 'o1js';
import rootDir from '../utils/root_dir.js';
import { runWorker } from '../utils/spawn_worker.js';
import { buildTreeOfVks } from '../tree_of_vks.js';
import { Groth16VendorBrand } from './vendor.js';

export async function buildGroth16VkTree(
  vendor: Groth16VendorBrand,
  cacheDir: string
) {
  const knownVendors = Object.values(Groth16VendorBrand) as string[];
  if (!knownVendors.includes(vendor)) {
    throw new Error(
      `Unknown Groth16VendorBrand '${vendor}', expected one of: ${knownVendors.join(', ')}`
    );
  }

  const leafScript = resolve(rootDir, 'build', 'src', 'groth', 'compile_leaf.js');
  const recursionVksScript = resolve(rootDir, 'build', 'src', 'compile_recursion_vks.js');

  const baseVksHashes = [];
  for (let i = 0; i <= 15; i++) {
    const hash = await runWorker(leafScript, [String(i), vendor, cacheDir]);
    baseVksHashes.push(Field.from(BigInt(hash)));
  }

  mkdirSync(resolve(cacheDir, 'vks'), { recursive: true });
  await runWorker(recursionVksScript, [cacheDir, cacheDir]);
  const layer1Vk = VerificationKey.fromJSON(
    JSON.parse(readFileSync(resolve(cacheDir, 'vks', 'layer1Vk.json'), 'utf-8'))
  ).hash;
  const nodeVk = VerificationKey.fromJSON(
    JSON.parse(readFileSync(resolve(cacheDir, 'vks', 'nodeVk.json'), 'utf-8'))
  ).hash;

  return buildTreeOfVks(baseVksHashes, layer1Vk, nodeVk);
}
