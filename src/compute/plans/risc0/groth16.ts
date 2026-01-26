import { resolve } from 'path';
import {
  computeAuxWitness,
  computePairingRisc0,
} from '../../../pairing-utils/index.js';
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
import { Risc0Groth16Proof, Risc0Groth16RawVk } from '../../../api/risc0/types.js';
import { Groth16Verifier } from '../../../groth/verifier.js';
import { Proof } from '../../../groth/proof.js';
import {
  ConversionOutput,
  ProofDataOutput,
  VkDataOutput,
} from '../../types.js';

export type Risc0Groth16Input = {
  risc0_proof: Risc0Groth16Proof;
  raw_vk: Risc0Groth16RawVk;
};

interface State extends PlatformFeatures, ConversionOutput {
  workingDirName: string;
  workingDir: string;
  cacheDir: string;
  input: Risc0Groth16Input;
  witnessPath: string;
  proofPath: string;
  vkPath: string;
}

const proofVkCacheStructure: DirectoryStructure = {
  proofs: range(5).map((i) => `layer${i}`),
  vks: range(5).map((i) => `layer${i}`),
};

const nodeCacheStructure: DirectoryStructure = range(4).map((i) => `node${i}`);

export class Risc0Groth16ComputationalPlan implements ComputationPlan<
  State,
  ConversionOutput,
  Risc0Groth16Input
> {
  readonly __inputType!: Risc0Groth16Input;
  name = 'Risc0Groth16Converter';
  async init(state: State, input: Risc0Groth16Input): Promise<void> {
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
      name: 'makeAlphaBeta',
      type: 'main-thread',
      execute: (state: State) => {
        const { raw_vk: rawVk } = state.input;
        const risc0Vk = computePairingRisc0(rawVk);

        writeFileSync(
          resolve(state.workingDir, 'risc_zero_vk.json'),
          JSON.stringify(risc0Vk)
        );

        writeFileSync(
          resolve(state.workingDir, 'risc_zero_proof.json'),
          JSON.stringify(state.input.risc0_proof)
        );

        state.vkPath = resolve(state.workingDir, 'risc_zero_vk.json');
        state.proofPath = resolve(state.workingDir, 'risc_zero_proof.json');
      },
    },
    {
      name: 'GenerateWitness',
      type: 'main-thread',
      execute: (state: State) => {
        const { vkPath, proofPath } = state;

        const groth16 = new Groth16Verifier(vkPath);
        const proof = Proof.parse(groth16.vk, proofPath);
        const mlo = groth16.multiMillerLoop(proof).toJSON();

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
    ...range(1, 5).map((i) => {
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
