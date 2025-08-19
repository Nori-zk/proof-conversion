import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { ComputationalPlanExecutor } from '../compute/executor.js';
import { performSp1ToPlonk } from '../api/sp1/plonk.js';
import { performRisc0ToGroth16 } from '../api/risc0/groth16.js';
import { Logger } from '../logging/logger.js';
import { LogPrinter } from '../logging/log_printer.js';

new LogPrinter('[NoriProofConverter]', [
  'log',
  'info',
  'warn',
  'error',
  'debug',
  'fatal',
  'verbose',
]);
const logger = new Logger('CLI');

const MAX_PROCESSES = parseInt(process.env.MAX_PROCESSES || '1', 10);
const executor = new ComputationalPlanExecutor(MAX_PROCESSES);

// registry of decorated API functions (must expose .fromArgs/.fromObject/.argsMetadata/.objMetadata as provided by the decorator)
const commandMap: Record<string, any> = {
  sp1ToPlonk: performSp1ToPlonk,
  risc0ToGroth16: performRisc0ToGroth16,
};

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
  } catch (e: any) {
    throw new Error(`Failed to parse JSON from file "${p}": ${e.message ?? e}`);
  }
}

// --- help utilities using metadata ---
function summariseCommandMetadata(name: string, fn: any) {
  const supportsArgs = typeof fn?.fromArgs === 'function';
  const supportsObject = typeof fn?.fromObject === 'function';
  const argsMeta = Array.isArray(fn?.argsMetadata) ? fn.argsMetadata : null;
  const objMeta = Array.isArray(fn?.objMetadata) ? fn.objMetadata : null;
  return { name, supportsArgs, supportsObject, argsMeta, objMeta };
}

function buildHelpAfterText() {
  const lines: string[] = [];
  lines.push('\nAvailable commands and metadata:');
  for (const name of Object.keys(commandMap)) {
    const fn = commandMap[name];
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

function printDescribeDirect(commandName: string) {
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
  if (meta.supportsArgs) {
    logger.log(`  argsMetadata (files): ${JSON.stringify(meta.argsMeta)}`);
    logger.log('  Example (args-mode):');
    logger.log(
      `    $ nori-proof-converter ${commandName} path/to/hexPi.json path/to/programVK.json path/to/encodedProof.json`
    );
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
      `    $ nori-proof-converter ${commandName} path/to/input-file.json`
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
    } catch (e: any) {
      logger.fatal('Failed to print description:');
      logger.fatal(e.stack);
      process.exit(1);
    }
  });

// ---------- main command: accept zero-or-more args ----------
program
  .argument(
    '<command>',
    'command to execute (e.g. sp1ToPlonk or risc0ToGroth16)'
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

    let inputForExecutor: any;
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
        inputForExecutor = fn.fromObject(obj);
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
        inputForExecutor = (fn.fromArgs as (...a: any[]) => any)(...fileValues);
      }
    } catch (err: any) {
      logger.fatal(
        `Error preparing input for '${commandName}': ${
          err.message ?? err
        }`
      );
      logger.fatal(err.stack);
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
    } catch (err: any) {
      logger.fatal(
        `Error executing command '${commandName}': ${
          err.message ?? err
        }`
      );
      logger.fatal(err.stack);
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
} catch (err: any) {
  logger.log(program.helpInformation());
  logger.log(`Version: ${version}`);
  logger.log(`Available commands: ${Object.keys(commandMap).join(', ')}`);
  logger.fatal(err.stack);
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
