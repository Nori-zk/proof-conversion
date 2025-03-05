import { resolve } from 'path';
import { AuxWitnessWasm, computeAuxWitness } from '../../../pairing-utils/index.js';
import { createDirectories, DirectoryStructure } from '../../../utils/cache.js';
import { getRandomString } from '../../../utils/random.js';
import { range } from '../../../utils/range.js';
import { ComputationalStage, ComputationPlan } from '../../plan.js';
import { PlatformFeatures } from '../platform/index.js';
import rootDir from '../../../utils/root_dir.js';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { getMlo } from '../../../plonk/get_mlo.js';

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
    witnessPath: string;
}

const proofVkCacheStructure: DirectoryStructure = {
    proofs: range(6).map(i => `layer${i}`),
    vks: range(6).map(i => `layer${i}`)
};

const nodeCacheStructure: DirectoryStructure = range(4).map((i) => `node${i}`);

export class PlonkComputationalPlan implements ComputationPlan<State, PlonkOutput, PlonkInput> {
    readonly __inputType!: PlonkInput;
    name = "PlonkConverter";
    async init(state: State, input: PlonkInput): Promise<void> {
        state.input = input;
        state.cacheName = getRandomString(20);
        state.cacheDir = resolve(rootDir, 'conversion', state.cacheName, 'e2e_plonk')
    }
    stages: ComputationalStage<State>[] = [
        {
            name: 'CreateFileSystemCace',
            type: 'main-thread',
            execute: (state) => {
                mkdirSync(state.cacheDir, { recursive: true });
                createDirectories(state.cacheDir, proofVkCacheStructure);
                createDirectories(state.cacheDir, nodeCacheStructure);
            }
        },
        {
            name: 'GenerateWitness',
            type: 'main-thread',
            execute: (state: State) => {
                const mlo = getMlo(state.input.encodedProof, state.input.programVK, state.input.hexPi).toJSON(); // This is a wasm function
                const witness = computeAuxWitness(JSON.parse(mlo));
                state.witness = witness;
                state.witnessPath = resolve(state.cacheDir, 'aux_wtns.json');
                // Write the mlo and witness to the cache dir
                writeFileSync(resolve(state.cacheDir, 'mlo.json'), mlo);
                writeFileSync(state.witnessPath, JSON.stringify(witness));
                return;
            }
        },
        {
            name: 'CompileRecursion',
            type: 'serial-cmd',
            processCmd: (state: State) => {
                return {
                    cmd: 'node',
                    args: [
                        '--max-old-space-size=6000',
                        './build/src/compile_recursion_vks.js',
                        state.cacheDir,
                        state.cacheDir
                    ]
                }
            }
        },
        {
            name: 'ComputeZPK',
            type: 'parallel-cmd',
            processCmds: (state: State) => {
                return range(24).map((i) => {
                    return {
                        cmd: 'node',
                        args: [
                            '--max-old-space-size=6000',
                            './build/src/plonk/recursion/prove_zkps.js',
                            `zkp${i}`,
                            state.input.encodedProof,
                            state.input.programVK,
                            state.input.hexPi,
                            state.witnessPath,
                            state.cacheDir,
                            state.cacheDir
                        ],
                        emit: true,
                    }
                })
            },
            numaOptimized: true
        },
        {
            name: 'CompressLayer',
            type: 'parallel-cmd',
            processCmds: (state: State) => {
                return range(5).map((i) => {
                    const upperLimit = Math.pow(2, 5 - i) - 1;
                    return range(upperLimit + 1).map((ZKP_J) => {
                        return {
                            cmd: 'node',
                            args: [
                                '--max-old-space-size=6000',
                                './build/src/node_resolver.js',
                                '24',
                                `${i}`,
                                `${ZKP_J}`,
                                state.cacheDir,
                                state.cacheDir,
                            ],
                            emit: true,
                        };
                    });
                }).flat();
            },
            numaOptimized: true
        },
    ];
    async collect(state: State): Promise<PlonkOutput> {
        rmSync(resolve(rootDir, 'conversion', state.cacheDir), { recursive: true });
        console.log(state.witness);
        return {} as PlonkOutput;
    }
}