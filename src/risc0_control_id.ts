import { FrC } from './towers/index.js';
import data from './risc0_control_id_v3.0.6.json' with { type: 'json' };

// See pairing-utils/src/risc0_control_id.rs for the derivation, the
// canonical-version explanation, and the two independent cross-checks
// (Solidity source + a real self-verified proof in example-generators/risc0/).
const RISC0_CONTROL_ROOT_0: FrC = FrC.from(BigInt(data.risc0_control_root_0));
const RISC0_CONTROL_ROOT_1: FrC = FrC.from(BigInt(data.risc0_control_root_1));
const RISC0_BN254_CONTROL_ID: FrC = FrC.from(BigInt(data.risc0_bn254_control_id));

export { RISC0_CONTROL_ROOT_0, RISC0_CONTROL_ROOT_1, RISC0_BN254_CONTROL_ID };
