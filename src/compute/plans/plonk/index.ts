import { mkdirSync, rmSync } from 'fs';
import { ComputationalStage, ComputationPlan } from '../../plan.js';
import { PlatformFeatures } from '../platform';
import { resolve } from 'path';
import rootDir from '../../../utils/root_dir.js';
import { getRandomString } from '../../../utils/random.js';
import { getMlo } from '../../../plonk/get_mlo.js';
import { AuxWitnessWasm, computeAuxWitness } from '../../../pairing-utils/index.js';

export type PlonkInput = {
    hexPi: string;
    programVK: string;
    encodedProof: string;
}

export interface PlonkProofData {
    maxProofsVerified: 0 | 1 | 2,
    proof: string,
    publicInput: string[],
    publicOutput: string[]
}

export interface PlonkVkData {
    data: string;
    hash: string
}

export interface PlonkOutput {
    vkData: PlonkVkData;
    proofData: PlonkProofData;
}

interface State extends PlatformFeatures, PlonkOutput {
    cacheDir: string;
    input: PlonkInput;
    witness: AuxWitnessWasm;
}

/*
AUX_WITNESS_PATH="$E2E_PLONK_DIR/aux_wtns.json"

# Generate aux witness
start_time=$(date +%s)
./scripts/get_aux_witness_plonk.sh "$ENV_FILE"
*/

export class PlonkComputationalPlan implements ComputationPlan<State, PlonkOutput, PlonkInput> {
    readonly __inputType!: PlonkInput;
    name = "PlonkConverter";
    async init(state: State, input: PlonkInput): Promise<void> {
        state.input = input;
        state.cacheDir = getRandomString(20);
        mkdirSync(resolve(rootDir, 'conversion', state.cacheDir, 'e2e_plonk'), {recursive: true});
    }
    stages: ComputationalStage<State>[] = [
        {
            name: 'GenerateWitness',
            type: 'main-thread',
            execute: (state: State) => {
                const mlo = getMlo(state.input.encodedProof, state.input.programVK, state.input.hexPi).toJSON(); // This is a wasm function
                const witness = computeAuxWitness(JSON.parse(mlo));
                state.witness = witness;
                return;
            }
        }
    ];
    async collect(state: State): Promise<PlonkOutput> {
        rmSync(resolve(rootDir, 'conversion', state.cacheDir), {recursive: true});
        console.log(state.witness);
        return {} as PlonkOutput;
    }
}