import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { ComputationalStage, ComputationPlan } from '../../plan.js';
import { PlatformFeatures } from '../platform';
import { resolve } from 'path';
import rootDir from '../../../utils/root_dir.js';
import { getRandomString } from '../../../utils/random.js';
import { getMlo } from '../../../plonk/get_mlo.js';
import { AuxWitnessWasm, computeAuxWitness } from '../../../pairing-utils/index.js';
import { createDirectories, DirectoryStructure } from '../../../utils/cache.js';
import { range } from '../../../utils/range.js';

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
    cacheName: string;
    cacheDir: string;
    input: PlonkInput;
    witness: AuxWitnessWasm;
}

const proofVkCacheStructure: DirectoryStructure = {
    proofs: range(6).map(i => `layer${i}`),
    vks: range(6).map(i => `layer${i}`)
};

const nodeCacheStructure: DirectoryStructure = range(4).map((i)=>`node${i}`);

export class PlonkComputationalPlan implements ComputationPlan<State, PlonkOutput, PlonkInput> {
    readonly __inputType!: PlonkInput;
    name = "PlonkConverter";
    async init(state: State, input: PlonkInput): Promise<void> {
        state.input = input;
        state.cacheName = getRandomString(20);
        state.cacheDir = resolve(rootDir, 'conversion', state.cacheName, 'e2e_plonk')
        mkdirSync(state.cacheDir, {recursive: true});
    }
    stages: ComputationalStage<State>[] = [
        {
            name: 'GenerateWitness',
            type: 'main-thread',
            execute: (state: State) => {
                const mlo = getMlo(state.input.encodedProof, state.input.programVK, state.input.hexPi).toJSON(); // This is a wasm function
                const witness = computeAuxWitness(JSON.parse(mlo));
                state.witness = witness;

                // Create cache directories
                writeFileSync(resolve(state.cacheDir, 'mlo.json'), mlo);
                writeFileSync(resolve(state.cacheDir, 'aux_wtns.json'), JSON.stringify(witness));
                createDirectories(state.cacheDir,proofVkCacheStructure);
                createDirectories(state.cacheDir,nodeCacheStructure);
                return;
            }
        },
        /*
echo "Compiling recursion vks..."
node --max-old-space-size=$NODE_MEMORY_LIMIT \
  ./build/src/compile_recursion_vks.js "${WORK_DIR}" "${CACHE_DIR}"
        */
        {
            name: 'CompileRecursion',
            type: 'serial-cmd',
            processCmd: {
                cmd: 'node',
                args: ['--max-old-space-size=8192', './build/src/compile_recursion_vks.js', '', '']
            }
        }
    ];
    async collect(state: State): Promise<PlonkOutput> {
        rmSync(resolve(rootDir, 'conversion', state.cacheDir), {recursive: true});
        console.log(state.witness);
        return {} as PlonkOutput;
    }
}