import { compute_pairing as computePairing } from '@nori-zk/proof-conversion-pairing-utils';
import { Risc0Groth16RawVk, Risc0Groth16Vk } from '../api/risc0/types.js';

export { 
  compute_aux_witness as computeAuxWitness,
  convert_sp1_groth16_to_o1js as convertSp1Groth16ToO1js,
  convert_snarkjs_groth16_to_o1js as convertSnarkjsGroth16ToO1js,
} from '@nori-zk/proof-conversion-pairing-utils';

export function computePairingRisc0(raw_vk: Risc0Groth16RawVk): Risc0Groth16Vk {
  const pairingInput = {alpha: raw_vk.alpha, beta: raw_vk.beta};
  const alpha_beta = computePairing(pairingInput);
  return {...raw_vk, alpha_beta};
}