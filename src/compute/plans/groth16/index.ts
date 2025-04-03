import { resolve } from 'path';
import { computeAuxWitness } from '../../../pairing-utils/index.js';
import { Alpha } from '../../../pairing-utils/index.js';
import { Beta } from '../../../pairing-utils/index.js';
import { AlphaBetaWasm } from '../../../pairing-utils/index.js';
import { makeAlphaBeta } from '../../../pairing-utils/index.js';
import {
  createDirectories,
  createDirectory,
  DirectoryStructure,
} from '../../../utils/cache.js';
import { getRandomString } from '../../../utils/random.js';
import { range } from '../../../utils/range.js';
import {
  ComputationalStage,
  ComputationPlan,
  ParallelComputationStage,
} from '../../plan.js';
import { PlatformFeatures } from '../platform/index.js';
import rootDir from '../../../utils/root_dir.js';
import { readFileSync, rmSync, writeFileSync } from 'fs';
import { getMlo } from '../../../plonk/get_mlo.js';
import { Risc0Proof, Risc0RawVk, Risc0Vk } from '../../../api/sp1/types.js';
import { Groth16Verifier } from '../../../groth/verifier.js';
import { Proof } from '../../../groth/proof.js';

export type Groth16Input = {
  risc0_proof: Risc0Proof;
  raw_vk: Risc0RawVk;
};

/*export interface PlonkProofData {
  maxProofsVerified: 0 | 1 | 2;
  proof: string;
  publicInput: string[];
  publicOutput: string[];
}*/

/*export interface PlonkVkData {
  data: string;
  hash: string;
}*/

/*export type PlonkInput = {
    hexPi: string;
    programVK: string;
    encodedProof: string;
  }; */

/*export interface PlonkOutput {
  vkData: PlonkVkData;
  proofData: PlonkProofData;
}*/

export interface Groth16Output {
    vkData: Risc0Vk;
    rawVkData: Risc0RawVk;
    proofData: Risc0Proof;
}

interface State extends PlatformFeatures, Groth16Output {
  workingDirName: string;
  workingDir: string;
  cacheDir: string;
  input: Groth16Input;
  witnessPath: string;
}

// Aynı
const proofVkCacheStructure: DirectoryStructure = {
  proofs: range(6).map((i) => `layer${i}`),
  vks: range(6).map((i) => `layer${i}`),
};

// Aynı
const nodeCacheStructure: DirectoryStructure = range(4).map((i) => `node${i}`);

export class Groth16ComputationalPlan
  implements ComputationPlan<State, Groth16Output, Groth16Input>
{
  readonly __inputType!: Groth16Input;
  name = 'Groth16Converter';
  async init(state: State, input: Groth16Input): Promise<void> {
    state.input = input;
    state.workingDirName = getRandomString(20);
    const pwd = process.cwd();
    state.workingDir = resolve(pwd, '.groth16-conversion-cache', state.workingDirName);
    state.cacheDir = resolve(pwd, '.groth16-conversion-cache', 'groth16_cache');
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
      name: 'makeAlphaBeta',
      type: 'main-thread',
      execute: (state: State) => {
        // print proceeding makeAlphaBeta
        console.log('Proceeding makeAlphaBeta...');
        const raw_vk = state.input.raw_vk;

        // use makeAlphaBeta from pairing-utils
        const input: AlphaBetaWasm = {
          alpha: {
            x: raw_vk.alpha.x,
            y: raw_vk.alpha.y,
          },
          beta: {
            x_c0: raw_vk.beta.x_c0,
            x_c1: raw_vk.beta.x_c1,
            y_c0: raw_vk.beta.y_c0,
            y_c1: raw_vk.beta.y_c1,
          },
        };

        const risc0_vk = makeAlphaBeta(raw_vk, input);
        console.log("Alpha Beta: ", risc0_vk);

        // print risc0_vk to a json file
        writeFileSync(resolve(state.workingDir, 'risc_zero_vk.json'), JSON.stringify(risc0_vk));
        
        // write proof to path
        writeFileSync(
          resolve(state.workingDir, 'risc_zero_proof.json'),
          JSON.stringify(state.input.risc0_proof)
        );
        
        // print proof path
        console.log('Proof path:', resolve(state.workingDir, 'risc_zero_proof.json'));

        // print working dir
        console.log('Working dir:', state.workingDir);
        
        // print write completed
        console.log('Write completed.');
      },
    },
    {     
          name: 'GenerateWitness',
          type: 'main-thread',
          execute: (state: State) => {
            // args = [vk_path, proof_path, mlo_write_path]
            const vk_path = resolve(state.workingDir, 'risc_zero_vk.json');
            const proof_path = resolve(state.workingDir, 'risc_zero_proof.json');
            
            const groth16 = new Groth16Verifier(vk_path);
            const proof = Proof.parse(groth16.vk, proof_path);
            const mlo = groth16.multiMillerLoop(proof).toJSON();
    
            //// print mlo
            const witness = computeAuxWitness(JSON.parse(mlo));
            state.witnessPath = resolve(state.workingDir, 'aux_wtns.json');
            // Write the mlo and witness to the cache dir
            writeFileSync(resolve(state.workingDir, 'mlo.json'), mlo);
            writeFileSync(state.witnessPath, JSON.stringify(witness));
            return;
          },
        },
    // If u wanna see stdout then you can change the capture boolean key in the plonk plan to emit
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
          //capture: true,
          emit: true,
          printableArgs: [0, 1, 2],
        };
      },
    },
    /*{
      name: 'ComputeZPK',
      type: 'parallel-cmd',
      processCmds: (state: State) => {
        return range(24).map((i) => {
          return {
            cmd: 'node',
            args: [
              '--max-old-space-size=6000',
              resolve(
                rootDir,
                'build',
                'src',
                'plonk',
                'recursion',
                'prove_zkps.js'
              ),
              `zkp${i}`,
              state.input.encodedProof,
              state.input.programVK,
              state.input.hexPi,
              state.witnessPath,
              state.workingDir,
              state.cacheDir,
            ],
            //capture: true,
            emit: true,
            printableArgs: [0, 1, 2],
          };
        });
      },
      numaOptimized: true,
    },
    ...range(1, 6).map((i) => {
      const stage: ParallelComputationStage<State> = {
        name: `CompressLayer${i}`,
        type: 'parallel-cmd',
        processCmds: (state: State) => {
          const upperLimit = Math.pow(2, 5 - i) - 1;
          return range(upperLimit + 1).map((ZKP_J) => {
            return {
              cmd: 'node',
              args: [
                '--max-old-space-size=6000',
                resolve(rootDir, 'build', 'src', 'node_resolver.js'),
                '24',
                `${i}`,
                `${ZKP_J}`,
                state.workingDir,
                state.cacheDir,
              ],
              //capture: true,
              emit: true,
              printableArgs: [0, 1, 2, 3, 4],
            };
          });
        },
        numaOptimized: true,
      };
      return stage;
    }),*/
  ];
  async then(state: State): Promise<Groth16Output> {
    const output: Groth16Output = {
      vkData: JSON.parse(
        readFileSync(resolve(state.workingDir, 'vks', 'nodeVk.json'), 'utf8')
      ) as Risc0Vk,
      proofData: JSON.parse(
        readFileSync(
          resolve(state.workingDir, 'proofs', 'layer5', 'p0.json'),
          'utf8'
        )
      ) as Risc0Proof,
      rawVkData: JSON.parse(
        readFileSync(resolve(state.workingDir, 'vks', 'raw_vk.json'), 'utf8')
      ) as Risc0RawVk,
    };
    return output;
  }
  async finally(state: State): Promise<void> {
    rmSync(state.workingDir, { recursive: true, force: true });
  }
}
