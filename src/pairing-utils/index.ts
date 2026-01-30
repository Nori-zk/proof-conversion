import { compute_pairing as computePairing } from '@nori-zk/proof-conversion-utils';
import { Risc0Groth16Vk, Risc0Groth16PairedVk } from 'src/api/risc0/schema.js';

export { 
  compute_aux_witness as computeAuxWitness,
  convert_sp1_groth16_to_o1js as convertSp1Groth16ToO1js,
  convert_snarkjs_groth16_to_o1js as convertSnarkjsGroth16ToO1js,
} from '@nori-zk/proof-conversion-utils';

export const computeRisc0Groth16Pairing = ({alpha, beta, ...rest}: Risc0Groth16Vk) =>
  ({ ...rest, alpha, beta, alpha_beta:computePairing({alpha, beta})}) as Risc0Groth16PairedVk;