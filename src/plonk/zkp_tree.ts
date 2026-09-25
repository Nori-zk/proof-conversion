import { resolve } from 'path';
import { mkdirSync, readFileSync } from 'fs';
import { Field, VerificationKey } from 'o1js';
import rootDir from '../utils/root_dir.js';
import { runWorker } from '../utils/spawn_worker.js';
import { buildTreeOfVks } from '../tree_of_vks.js';

export async function buildPlonkVkTree(cacheDir: string) {
  const leafScript = resolve(rootDir, 'build', 'src', 'plonk', 'compile_leaf.js');
  const recursionVksScript = resolve(rootDir, 'build', 'src', 'compile_recursion_vks.js');

  const baseVksHashes = [];
  for (let i = 0; i <= 23; i++) {
    const hash = await runWorker(leafScript, [String(i), cacheDir]);
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
