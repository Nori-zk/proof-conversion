import rootDir from '../../../utils/root_dir.js';
import { range } from '../../../utils/range.js';
import { parseProof } from '../../../groth/proof.js';
import { resolve } from 'path';
import { Groth16Verifier } from '../../../groth/verifier.js';
import { getRandomString } from '../../../utils/random.js';
import { PlatformFeatures } from '../platform/index.js';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import {
  computeAuxWitness,
  convertSp1Groth16ToO1js,
} from '../../../pairing-utils/index.js';
import {
  createDirectories,
  createDirectory,
  DirectoryStructure,
} from '../../../utils/cache.js';
import {
  ComputationalStage,
  ComputationPlan,
  ParallelComputationStage,
} from '../../plan.js';
import {
  ConversionOutput,
  ProofDataOutput,
  VkDataOutput,
} from '../../types.js';
import type { SP1ProofWithPublicValuesGroth16NoTee } from "src/api/validation/sp1/schema.js"; // FIXME

interface State extends PlatformFeatures, ConversionOutput {
  workingDirName: string;
  workingDir: string;
  cacheDir: string;
  input: SP1ProofWithPublicValuesGroth16NoTee;
  witnessPath: string;
  proofPath: string;
  vkPath: string;
}

// CHECKME FIXME - I CHANGE THE RANGE TO 6 it used to be 5
const proofVkCacheStructure: DirectoryStructure = {
  proofs: range(5).map((i) => `layer${i}`),
  vks: range(5).map((i) => `layer${i}`),
};
const nodeCacheStructure: DirectoryStructure = range(4).map((i) => `node${i}`);

export class Sp1Groth16ComputationalPlan implements ComputationPlan<
  State,
  ConversionOutput,
  SP1ProofWithPublicValuesGroth16NoTee
> {
  readonly __inputType!: SP1ProofWithPublicValuesGroth16NoTee;
  name = 'Sp1Groth16Converter';
  async init(state: State, input: SP1ProofWithPublicValuesGroth16NoTee): Promise<void> {
    state.input = input;
    state.workingDirName = getRandomString(20);
    const pwd = process.cwd();
    state.workingDir = resolve(pwd, '.conversion-cache', state.workingDirName);
    state.cacheDir = resolve(pwd, '.conversion-cache', 'groth16_cache');
  }
  stages: ComputationalStage<State>[] = [
    {
      // Create the cache and working directories
      // Create the proofs and vks directories
      // Create the node directories
      name: 'CreateFileSystemCache',
      type: 'main-thread',
      execute: (state) => {
        createDirectory(state.cacheDir);
        createDirectory(state.workingDir);
        createDirectories(state.workingDir, proofVkCacheStructure);
        createDirectories(state.workingDir, nodeCacheStructure);
      },
    },
    {
      name: 'ConvertSp1Groth16ToO1js',
      type: 'main-thread',
      execute: (state: State) => {
        const o1jsGroth16 = convertSp1Groth16ToO1js(state.input);
        /*
            This is what we get ================================
            export interface O1jsGroth16 {
                proof: O1jsProof;
                vk: O1jsVK;
            }
            export interface O1jsVK {
                alpha: AffinePoint2d;
                beta: ComplexAffinePoint2d;
                gamma: ComplexAffinePoint2d;
                delta: ComplexAffinePoint2d;
                alpha_beta: Field12;
                w27: Field12;
                ic0: AffinePoint2d;
                ic1?: AffinePoint2d;
                ic2?: AffinePoint2d;
                ic3?: AffinePoint2d;
                ic4?: AffinePoint2d;
                ic5?: AffinePoint2d;
                ic6?: AffinePoint2d;
            }
            export interface O1jsProof {
                negA: AffinePoint2d;
                B: ComplexAffinePoint2d;
                C: AffinePoint2d;
                pi1?: string;
                pi2?: string;
                pi3?: string;
                pi4?: string;
                pi5?: string;
                pi6?: string;
            }
        */
        
        /*
        THE VERIFIER EXPECTS THIS AS THE VK (NOTE it does NOT want alpha and beta we should strip them out)
            type SerializedVk = {
                ic6?: AffinePoint2d | undefined;
                alpha_beta: Field12;
                gamma: ComplexAffinePoint2d;
                delta: ComplexAffinePoint2d;
                w27: Field12;
                ic0: AffinePoint2d;
                ic1?: AffinePoint2d | undefined;
                ic2?: AffinePoint2d | undefined;
                ic3?: AffinePoint2d | undefined;
                ic4?: AffinePoint2d | undefined;
                ic5?: AffinePoint2d | undefined;
            }
        */

        /* THE PROOF EXPECTS THIS
            interface O1jsProof {
                negA: AffinePoint2d;
                B: ComplexAffinePoint2d;
                C: AffinePoint2d;
                pi1?: string;
                pi2?: string;
                pi3?: string;
                pi4?: string;
                pi5?: string;
                pi6?: string;
            }
        */

        // o1jsGroth16.vk Need to remove alpha and beta
        const { vk: {alpha, beta, ...o1jsGroth16Vk}} = o1jsGroth16;
        // Just void alpha and beta because we won't use them and otherwise the linter complains
        void alpha;
        void beta;

        // Write vk and proof 
        writeFileSync(
          resolve(state.workingDir, 'sp1_groth16_vk.json'),
          JSON.stringify(o1jsGroth16Vk)
        );

        writeFileSync(
          resolve(state.workingDir, 'sp1_groth16_proof.json'),
          JSON.stringify(o1jsGroth16.proof)
        );

        state.vkPath = resolve(state.workingDir, 'sp1_groth16_vk.json');
        state.proofPath = resolve(state.workingDir, 'sp1_groth16_proof.json');
      },
    },
    {
      name: 'GenerateWitness',
      type: 'main-thread',
      execute: (state: State) => {
        const { vkPath, proofPath } = state;

        const groth16 = new Groth16Verifier(vkPath);
        // this extract the proof nega C B and public inputs but operates on the public inputs with the vk
        const proof = parseProof(groth16.vk, proofPath); // CHECKME FIXME - I had to change this from Proof to parseProof see src/groth/proof.ts
        // then this modified  proof goes through the multimillerloop and gives us an f1p
        const mlo = groth16.multiMillerLoop(proof).toJSON(); 
        // F12 goes to wasm to compute the witness
        const witness = computeAuxWitness(JSON.parse(mlo)); 
        state.witnessPath = resolve(state.workingDir, 'aux_wtns.json');

        // Write the mlo and witness to the cache dir
        writeFileSync(resolve(state.workingDir, 'mlo.json'), mlo);
        writeFileSync(state.witnessPath, JSON.stringify(witness));

        return;
      },
    },
    {
      name: 'CompileRecursion',
      type: 'serial-cmd',
      processCmd: (state: State) => {
        return {
          cmd: 'node',
          args: [
            '--max-old-space-size=6000',
            resolve(rootDir, 'build', 'src', 'compile_recursion_vks.js'),
            state.workingDir,
            state.cacheDir,
          ],
          capture: true,
          printableArgs: [0, 1, 2],
        };
      },
    },
    {
      name: 'ComputeZKP',
      type: 'parallel-cmd',
      processCmds: (state: State) => {
        process.env.GROTH16_VK_PATH = state.vkPath;
        return range(16).map((i) => {
          return {
            cmd: 'node',
            args: [
              '--max-old-space-size=6000',
              resolve(
                rootDir,
                'build',
                'src',
                'groth',
                'recursion',
                'prove_zkps.js'
              ),
              `zkp${i}`,
              state.proofPath,
              state.witnessPath,
              state.workingDir,
              state.cacheDir,
            ],
            capture: true,
            printableArgs: [0, 1, 2],
          };
        });
      },
      numaOptimized: true,
    },
    ...range(1, 5).map((i) => { // CHECKME FIXME - ...range(1, 5) i had change from this 
      const stage: ParallelComputationStage<State> = {
        name: `CompressLayer${i}`,
        type: 'parallel-cmd',
        processCmds: (state: State) => {
          const upperLimit = Math.pow(2, 4 - i) - 1;
          return range(upperLimit + 1).map((ZKP_J) => {
            return {
              cmd: 'node',
              args: [
                '--max-old-space-size=6000',
                resolve(rootDir, 'build', 'src', 'node_resolver.js'),
                '16',
                `${i}`,
                `${ZKP_J}`,
                state.workingDir,
                state.cacheDir,
              ],
              capture: true,
              printableArgs: [0, 1, 2, 3, 4],
            };
          });
        },
        numaOptimized: true,
      };
      return stage;
    }),
  ];
  async then(state: State): Promise<ConversionOutput> {
    const output: ConversionOutput = {
      vkData: JSON.parse(
        readFileSync(resolve(state.workingDir, 'vks', 'nodeVk.json'), 'utf8')
      ) as VkDataOutput,
      proofData: JSON.parse(
        readFileSync(
          resolve(state.workingDir, 'proofs', 'layer4', 'p0.json'),
          'utf8'
        )
      ) as ProofDataOutput,
    };
    return output;
  }
  async finally(state: State): Promise<void> {
    rmSync(state.workingDir, { recursive: true, force: true });
  }
}
