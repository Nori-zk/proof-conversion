// Node.js dep free ===============================================================================

// Types

// Conversion output
export type * from './compute/types.js';

// Proof input formats
export type * from './api/risc0/schema.js';
export type * from './api/snarkjs/schema.js';
export type * from './api/sp1/schema.js';

// Utilities

export * from '@nori-zk/proof-conversion-utils';
export { parsePublicInputsProvable as parsePlonkPublicInputsProvable } from './plonk/parse_pi.js';
export {
  wordToBytes,
  wordToBytesCanonical,
  isCanonicalFieldBytesLE,
} from './sha/utils.js';
export { NodeProofLeft } from './structs.js';
export { FrC } from './towers/fr.js';
export { DeferredPromise } from './utils/DeferredPromise.js';

// Node.js ========================================================================================

// Api
export { performSp1Plonk } from './api/sp1/plonk.js';
export { performRisc0Groth16 } from './api/risc0/groth16.js';
export { performSnarkjsGroth16 } from './api/snarkjs/groth16.js';
export { performSp1Groth16 } from './api/sp1/groth16.js';

// Compute
export { ComputationalPlanExecutor } from './compute/executor.js';
export { PlatformFeatureDetectionComputationalPlan } from './compute/plans/platform/index.js';
export { ProcessCmd, ProcessCmdOutput } from './compute/plan.js';
