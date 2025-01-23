import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_PATH = join(__dirname, '../../../../..');

// Function to get the latest proof name from the directory
function getLatestProofName(): string {
  const proofDir = join(BASE_PATH, 'proofs-to-run');
  console.log('proofDir', proofDir);
  const files = readdirSync(proofDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.replace('.json', ''))
    // .filter((name) => /^\d+$/.test(name))
    .sort((a, b) => b.localeCompare(a)); // Sort in descending order

  if (files.length === 0) {
    throw new Error('No proof files found');
  }

  return files[0];
}

const PROOF_NAME = getLatestProofName();

export const PATH_TO_SP1_PROOF = join(
  BASE_PATH,
  `proofs-to-run/${PROOF_NAME}.json`
);

export const PATH_TO_O1_PROOF = join(
  BASE_PATH,
  `scripts/conversion/${PROOF_NAME}/e2e_plonk/proofs/layer5/p0.json`
);
export const PATH_TO_O1_VK = join(
  BASE_PATH,
  `scripts/conversion/${PROOF_NAME}/e2e_plonk/vks/nodeVk.json`
);
