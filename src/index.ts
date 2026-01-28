

// Safe / side-effect-free
export { parsePublicInputsProvable as parsePlonkPublicInputsProvable } from './plonk/parse_pi.js';
export { wordToBytes } from './sha/utils.js';
export { NodeProofLeft } from './structs.js';
export { FrC } from './towers/fr.js';
export { DeferredPromise } from './utils/DeferredPromise.js';

// Api
export { performSp1Plonk } from './api/sp1/plonk.js';
export { performRisc0Groth16 } from './api/risc0/groth16.js';
export { performSnarkjsGroth16 } from './api/snarkjs/groth16.js';
export { performSp1Groth16 } from './api/sp1/groth16.js';

export type { Sp1Input as Sp1 } from './api/validation/sp1/schema.js';

// Compute
export { ComputationalPlanExecutor } from './compute/executor.js';
export { PlatformFeatureDetectionComputationalPlan } from './compute/plans/platform/index.js';
export { ProcessCmd, ProcessCmdOutput } from './compute/plan.js';