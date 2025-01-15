import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_PATH = join(__dirname, '../../../../..');

const PROOF_NAME = '1736168227';

export const PATH_TO_SP1_PROOF = join(
  BASE_PATH,
  `example-proofs/${PROOF_NAME}.json`
);

export const PATH_TO_O1_PROOF = join(
  BASE_PATH,
  `scripts/conversion/${PROOF_NAME}/e2e_plonk/proofs/layer5/p0.json`
);
// o1js-blobstream/scripts/conversion/${PROOF_NAME}/e2e_plonk/proofs/layer5/p0.json
export const PATH_TO_O1_VK = join(
  BASE_PATH,
  `scripts/conversion/${PROOF_NAME}/e2e_plonk/vks/nodeVk.json`
);
// o1js-blobstream/scripts/conversion/1729682178/e2e_plonk/vks //also should work as it's same vk
