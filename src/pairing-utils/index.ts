import { 
    compute_and_serialize_aux_witness_js as wasmComputeAuxWitness, 
    make_alpha_beta_js as wasmMakeAlphaBeta 
} from "@nori-zk/proof-conversion-pairing-utils";

export interface Field12Wasm {
    g00: string;
    g01: string;
    g10: string;
    g11: string;
    g20: string;
    g21: string;
    h00: string;
    h01: string;
    h10: string;
    h11: string;
    h20: string;
    h21: string;
}

export interface AuxWitnessWasm {
    c: Field12Wasm;
    shift_power: string;
}

export interface AlphaBetaPoint {
    x: string;
    y: string;
    x_c0?: string;
    x_c1?: string;
    y_c0?: string;
    y_c1?: string;
}

export interface AlphaBetaWasm {
    alpha: AlphaBetaPoint;
    beta: AlphaBetaPoint;
}

export interface AlphaBetaOutputWasm {
    g00: string;
    g01: string;
    g10: string;
    g11: string;
    g20: string;
    g21: string;
    h00: string;
    h01: string;
    h10: string;
    h11: string;
    h20: string;
    h21: string;
}

export function computeAuxWitness(input: Field12Wasm): AuxWitnessWasm {
    return wasmComputeAuxWitness(input) as AuxWitnessWasm;
}

export function makeAlphaBeta(input: AlphaBetaWasm): AlphaBetaOutputWasm {
    return wasmMakeAlphaBeta(input) as AlphaBetaOutputWasm;
}

