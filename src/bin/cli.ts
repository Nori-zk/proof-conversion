import * as fs from 'fs';
import * as path from 'path';
import { Logger } from 'esm-iso-logger';
import { Command } from 'commander';
import { LogPrinter } from 'esm-iso-logger';
import { fileURLToPath } from 'url';
import { performSp1Plonk } from '../api/sp1/plonk.js';
import { performSp1Groth16 } from '../api/sp1/groth16.js';
import { ApiCommandFunction } from '../api/methodDecorator.js';
import { performRisc0Groth16 } from '../api/risc0/groth16.js';
import { performSnarkjsGroth16 } from '../api/snarkjs/groth16.js';
import { ComputationalPlanExecutor } from '../compute/executor.js';
import { assertExactStructure } from 'src/api/validation/validation.js';
import { Risc0Groth16Proof, Risc0Groth16Vk } from 'src/api/validation/risc0/schema.js';
import { SnarkjsVK } from 'pairing-utils/pkg/pairing_utils.js';

new LogPrinter('NoriProofConverter');
const logger = new Logger('CLI');

const MAX_PROCESSES = parseInt(process.env.MAX_PROCESSES || '1', 10);
const executor = new ComputationalPlanExecutor(MAX_PROCESSES);

// registry of decorated API functions (must expose .fromArgs/.fromObject/.argsMetadata/.objMetadata as provided by the decorator)
const commandMap = { // p: Record<string, ApiCommandFunction>
  sp1Plonk: performSp1Plonk, // as ApiCommandFunction,
  risc0Groth16: performRisc0Groth16, // as ApiCommandFunction,
  sp1Groth16: performSp1Groth16, // as ApiCommandFunction,
  snarkjsGroth16: performSnarkjsGroth16, // as ApiCommandFunction,
};
type CommandMap = typeof commandMap;


const a = commandMap['sp1Groth16'];
// Risc0Groth16Proof | Risc0Groth16Vk Risc0Groth16Proof
performRisc0Groth16.fromArgs({} as Risc0Groth16Vk, {} as Risc0Groth16Vk, );

performSnarkjsGroth16.fromArgs({} as SnarkjsVK, {} as SnarkjsVK, {} as SnarkjsVK)

performSnarkjsGroth16.schema;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'package.json'
);
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version as string;

// Write output JSON file. If inputFileHint provided, use it to name output, else use commandName.
function writeJsonFile(
  filePathHint: string | undefined,
  commandName: string,
  resultStr: string
) {
  const baseHint = filePathHint ? path.basename(filePathHint) : commandName;
  const baseNoExt = baseHint.toLowerCase().endsWith('.json')
    ? baseHint.slice(0, -5)
    : baseHint;
  const outDir = filePathHint ? path.dirname(filePathHint) : process.cwd();
  const outPath = path.join(outDir, `${baseNoExt}.${commandName}.json`);
  fs.writeFileSync(outPath, resultStr);
  return outPath;
}

// Strict: read a path as JSON file, or throw if missing / not a file / invalid json
function readFileStrict(p: string) {
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
    throw new Error(
      `Expected file path, but "${p}" does not exist or is not a file.`
    );
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e: unknown) {
    const error = e as Error;
    throw new Error(`Failed to parse JSON from file "${p}": ${error.message ?? error}`);
  }
}

// --- help utilities using metadata ---
function summariseCommandMetadata(name: string, fn: CommandMap[keyof CommandMap]) {
  const supportsArgs = typeof fn?.fromArgs === 'function';
  //const supportsObject = typeof fn?.from === 'function';
  const argsMeta = Array.isArray(fn?.argsMetadata) ? fn.argsMetadata : null;
  //const objMeta = Array.isArray(fn?.objMetadata) ? fn.objMetadata : null;
  return { name, supportsArgs, argsMeta };
}

function buildHelpAfterText() {
  const lines: string[] = [];
  lines.push('\nAvailable commands and metadata:');
  for (const name of Object.keys(commandMap)) {
    const fn = commandMap[name as keyof CommandMap];
    const meta = summariseCommandMetadata(name, fn);
    const parts: string[] = [];
    parts.push(
      meta.supportsArgs
        ? `args(files): [${(meta.argsMeta || []).join(', ')}]`
        : 'args: (no)'
    );
    parts.push(
      meta.supportsObject
        ? `object(file): [${(meta.objMeta || []).join(', ')}]`
        : 'object: (no)'
    );
    lines.push(`  - ${name}    ${parts.join(' | ')}`);
  }
  lines.push('\nRun `describe <command>` for more details and examples.');
  return lines.join('\n');
}

function printDescribeDirect(commandName: keyof typeof commandMap) {
  const fn = commandMap[commandName];
  if (!fn) {
    logger.error(
      `\nCommand '${commandName}' not found. Available: ${Object.keys(
        commandMap
      ).join(', ')}\n`
    );
    return;
  }
  const meta = summariseCommandMetadata(commandName, fn);

  logger.log('');
  logger.log(`=== ${commandName} ===`);
  logger.log(`Supports args-mode (file-based): ${meta.supportsArgs}`);
  if (meta.supportsArgs && meta.argsMeta !== null) {
    logger.log(`  argsMetadata (files): ${JSON.stringify(meta.argsMeta)}`);
    logger.log('  Example (args-mode):');
    const argsExamplePaths = meta.argsMeta.map((arg: string) => `path/to/${commandName}_args_${arg}.json`).join(' ');
    logger.log(`    $ nori-proof-converter ${commandName} ${argsExamplePaths}`);
  } else {
    logger.log('  args-mode: not supported');
  }
  logger.log('');
  logger.log(`Supports object-mode (single file only): ${meta.supportsObject}`);
  if (meta.supportsObject) {
    logger.log(
      `  objMetadata (Json file must have keys): ${JSON.stringify(
        meta.objMeta
      )}`
    );
    logger.log('  Example (object-mode):');
    logger.log(
      `    $ nori-proof-converter ${commandName} path/to/${commandName}_obj.json`
    );
  } else {
    logger.log('  object-mode: not supported');
  }
  logger.log('');
}

const program = new Command();
program
  .name(Object.keys(packageJson.bin)[0])
  .description(packageJson.description)
  .version(packageJson.version);

// append metadata summary to help text
program.addHelpText('after', () => buildHelpAfterText());

// describe subcommand (same output as printDescribeDirect, but callable)
program
  .command('describe <command>')
  .description('Show detailed metadata and examples for a command')
  .action((commandName: string) => {
    try {
      printDescribeDirect(commandName);
      process.exit(0);
    } catch (e: unknown) {
      const error = e as Error;
      logger.fatal('Failed to print description:');
      logger.fatal(error.stack);
      process.exit(1);
    }
  });

// ---------- main command: accept zero-or-more args ----------
program
  .argument(
    '<command>',
    'command to execute (e.g. sp1Plonk or risc0Groth16)'
  )
  .argument(
    '[args...]',
    'optional arguments: single JSON file (object-mode) or multiple file paths (args-mode)'
  )
  .action(async (commandName: string, args: string[] = []) => {
    logger.debug(
      `entering action for command='${commandName}', args=${JSON.stringify(
        args
      )}`
    );
    const fn = commandMap[commandName];
    if (!fn) {
      logger.error(
        `Command '${commandName}' not found. Available: ${Object.keys(
          commandMap
        ).join(', ')}`
      );
      process.exit(1);
    }

    // If no args provided, print command-specific help/metadata and exit
    if (!Array.isArray(args) || args.length === 0) {
      logger.info(
        `No args provided for '${commandName}' — printing usage:`
      );
      printDescribeDirect(commandName);
      process.exit(0);
    }

    // determine mode and validate
    const mode = args.length === 1 ? 'object' : 'args';
    logger.debug(`selected mode='${mode}'`);

    let inputForExecutor: unknown;
    const outputNameHint: string | undefined = args[0];

    try {
      if (mode === 'object') {
        // object-mode: single arg MUST be a file path (no inline JSON)
        const obj = readFileStrict(args[0]); // throws if missing or invalid
        if (typeof obj !== 'object' || obj === null) {
          throw new Error('Object-mode requires a JSON object file.');
        }

        if (typeof fn.fromObject !== 'function') {
          throw new Error(
            `Command '${commandName}' does not support object-mode (.fromObject not provided).`
          );
        }
        if (!Array.isArray(fn.objMetadata)) {
          throw new Error(
            `Command '${commandName}' missing objMetadata for object-mode validation.`
          );
        }

        for (const key of fn.objMetadata) {
          if (!(key in obj)) {
            throw new Error(
              `Object-mode input file is missing required key "${String(key)}".`
            );
          }
        }

        // build final TInput
        inputForExecutor = fn.from(obj);
        assertExactStructure(inputForExecutor, fn.schema, "somecontext should be provided by api");
        inputForExecutor;
        fn.schema;
      } else {
        // args-mode: require each arg to be a file path containing JSON
        if (fn.fromArgs === false || typeof fn.fromArgs !== 'function') {
          throw new Error(
            `Command '${commandName}' does not support args-mode (.fromArgs not provided).`
          );
        }
        if (!Array.isArray(fn.argsMetadata)) {
          throw new Error(
            `Command '${commandName}' missing argsMetadata for args-mode validation.`
          );
        }

        if (args.length !== fn.argsMetadata.length) {
          throw new Error(
            `Args-mode requires ${
              fn.argsMetadata.length
            } file arguments (${fn.argsMetadata.join(', ')}). Received ${
              args.length
            }.`
          );
        }

        // read each file strictly
        const fileValues = args.map((a) => readFileStrict(a));

        // build final TInput via fromArgs (spread)
        inputForExecutor = (fn.fromArgs as (...a: unknown[]) => unknown)(...fileValues);
      }
    } catch (e: unknown) {
      const error = e as Error;
      logger.fatal(
        `Error preparing input for '${commandName}': ${
          error.message ?? error
        }`
      );
      logger.fatal(error.stack);
      process.exit(1);
    }

    try {
      const result = await fn(executor, inputForExecutor);
      const resultStr = JSON.stringify(result, null, 2);
      const outputFilePath = writeJsonFile(
        outputNameHint,
        commandName,
        resultStr
      );
      logger.info(
        `Wrote result of command ${commandName} to disk: ${outputFilePath}`
      );
      process.exit(0);
    } catch (e: unknown) {
      const error = e as Error;
      logger.fatal(
        `Error executing command '${commandName}': ${
          error.message ?? error
        }`
      );
      logger.fatal(error.stack);
      process.exit(1);
    }
  });

// show help when no args at all
if (process.argv.length <= 2) {
  logger.log(program.helpInformation());
  logger.log(`Version: ${version}`);
  logger.log(`Available commands: ${Object.keys(commandMap).join(', ')}`);
  process.exit(0);
}

try {
  program.exitOverride((err) => {
    logger.log(program.helpInformation());
    logger.log(`Version: ${version}`);
    logger.log(`Available commands: ${Object.keys(commandMap).join(', ')}`);
    logger.fatal(err.stack);
    process.exit(1);
  });

  program.parse(process.argv);
} catch (e: unknown) {
  const error = e as Error;
  logger.log(program.helpInformation());
  logger.log(`Version: ${version}`);
  logger.log(`Available commands: ${Object.keys(commandMap).join(', ')}`);
  logger.fatal(error.stack);
  process.exit(1);
}

// Ctrl+C handling
process.on('SIGINT', async () => {
  try {
    logger.warn('Process interrupted by user. Cleaning up.');
    await executor.terminate();
    logger.fatal('Cleanup finished. Exiting now.');
    process.exit(0);
  } finally {
    logger.fatal('Cleanup failed. Exiting now.');
    process.exit(1);
  }
});
