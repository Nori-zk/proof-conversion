import {
  compute_and_serialize_aux_witness_js as wasmComputeAuxWitness,
  make_alpha_beta_js as wasmMakeAlphaBeta,
} from '@nori-zk/proof-conversion-pairing-utils';
import { Fp12Type } from '../towers/fp12';

export interface AuxWitnessWasm {
  c: Fp12Type;
  shift_power: string;
}

export interface Alpha {
  x: string;
  y: string;
}

export interface Beta {
  x_c0: string;
  x_c1: string;
  y_c0: string;
  y_c1: string;
}

export interface AlphaBetaWasm {
  alpha: Alpha;
  beta: Beta;
}

export function computeAuxWitness(f12: Fp12Type): AuxWitnessWasm {
  return wasmComputeAuxWitness(f12) as AuxWitnessWasm;
}

export function makeAlphaBeta(raw_vk: unknown, input: AlphaBetaWasm) {
  // this is not complete
  // cargo run --bin alphabeta -- $RAW_VK_PATH $VK_PATH &
  // make_alpha_beta this function takes json_path for the $RAW_VK_PATH env var and uses this as "v"... it then
  // extends v by overriding the alpha_beta Field12 fields

  throw Error(
    'This function is not implemented yet... The raw_vk type is not implemented'
  );

  const v = (raw_vk || { alpha_beta: {} }) as { alpha_beta: Fp12Type };

  const serialized_alpha_beta = wasmMakeAlphaBeta(input) as Fp12Type;

  v['alpha_beta']['g00'] = serialized_alpha_beta.g00;
  v['alpha_beta']['g01'] = serialized_alpha_beta.g01;
  v['alpha_beta']['g10'] = serialized_alpha_beta.g10;
  v['alpha_beta']['g11'] = serialized_alpha_beta.g11;
  v['alpha_beta']['g20'] = serialized_alpha_beta.g20;
  v['alpha_beta']['g21'] = serialized_alpha_beta.g21;
  v['alpha_beta']['h00'] = serialized_alpha_beta.h00;
  v['alpha_beta']['h01'] = serialized_alpha_beta.h01;
  v['alpha_beta']['h10'] = serialized_alpha_beta.h10;
  v['alpha_beta']['h11'] = serialized_alpha_beta.h11;
  v['alpha_beta']['h20'] = serialized_alpha_beta.h20;
  v['alpha_beta']['h21'] = serialized_alpha_beta.h21;

  return v;
}
