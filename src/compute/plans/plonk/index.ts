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
            'name': 'CreateFileSystemCace',
            'type': 'main-thread',
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

                // Create cache directories
                writeFileSync(resolve(state.cacheDir, 'mlo.json'), mlo);
                writeFileSync(resolve(state.cacheDir, 'aux_wtns.json'), JSON.stringify(witness));

                return;
            }
        },
        /*
echo "Compiling recursion vks..."
node maxoldspacesize=$NODE_MEMORY_LIMIT \
  ./build/src/compile_recursion_vks.js "${WORK_DIR}" "${CACHE_DIR}"
        */
        {
            name: 'CompileRecursion',
            type: 'serial-cmd',
            processCmd: (state: State) => {
                return {
                    cmd: 'node',
                    args: ['--max-old-space-size=6000', './build/src/compile_recursion_vks.js', state.cacheDir, state.cacheDir]
                }
            }
        },

        /*
  # Pass arguments as positional parameters using ::::
  numactl --cpunodebind=$NUMA_NODE --membind=$NUMA_NODE \
    node --max-old-space-size=$NODE_MEMORY_LIMIT \
    ./build/src/plonk/recursion/prove_zkps.js \
    "zkp${ZKP_I}" \
    "$HEX_PROOF" \
    "$PROGRAM_VK" \
    "$HEX_PI" \
    "$AUX_WITNESS_PATH" \
    "$WORK_DIR" \
    "$CACHE_DIR"
        */
        {
            'name': 'ComputeZPK',
            type: 'parallel-cmd',
            processCmds: (state: State) => {
                return range(24).map((i) => {
                    return {
                        cmd: 'node',
                        args: ['--max-old-space-size=6000', './build/src/plonk/recursion/prove_zkps.js', `zkp${i}`, state.input.encodedProof, state.input.programVK, state.input.hexPi, state.cacheDir, state.cacheDir, state.cacheDir],
                    }
                })
            },
            numaOptimized: true
        },

        /*

 numactl --cpunodebind=$NUMA_NODE --membind=$NUMA_NODE \
    node --max-old-space-size=$NODE_MEMORY_LIMIT \
    ./build/src/node_resolver.js \
    24 \
    "${layer}" \
    "${ZKP_J}" \
    "${WORK_DIR}" \
    "${CACHE_DIR}"
}
        */

        {
            'name': 'CompressLayer',
            type: 'parallel-cmd',
            processCmds: (state: State) => {
                return range(5).map((i) => {
                    const upperLimit = Math.pow(2, 5 - i) - 1; // upper limit calculation as per the script
        
                    // Generate the commands for each ZKP_J in the range 0 to upperLimit
                    return range(upperLimit + 1).map((ZKP_J) => {
                        return {
                            cmd: 'node',
                            args: [
                                '--max-old-space-size=6000',
                                './build/src/node_resolver.js',
                                '24',
                                `${i}`, // Layer number (i)
                                `${ZKP_J}`, // This is ZKP_J
                                state.input.encodedProof,
                                state.input.programVK,
                                state.input.hexPi,
                                state.cacheDir,
                                state.cacheDir,
                                state.cacheDir,
                            ],
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