import * as fs from 'fs';
import * as path from 'path';
import { Logger } from 'esm-iso-logger';
import { Command } from 'commander';
import { LogPrinter } from 'esm-iso-logger';
import { fileURLToPath } from 'url';
import { performSp1Plonk } from '../api/sp1/plonk.js';
import { performSp1Groth16 } from '../api/sp1/groth16.js';
import { performRisc0Groth16 } from '../api/risc0/groth16.js';
import { assertExactStructure } from '../api/validation/validation.js';
import { describeSchema, type SchemaNode } from '../api/validation/guards/core.js';
import { performSnarkjsGroth16 } from '../api/snarkjs/groth16.js';
import { ComputationalPlanExecutor } from '../compute/executor.js';

new LogPrinter('NoriProofConverter');
const logger = new Logger('CLI');

const MAX_PROCESSES = parseInt(process.env.MAX_PROCESSES || '1', 10);
const executor = new ComputationalPlanExecutor(MAX_PROCESSES);

// Extract input type from a command function
type ExtractInput<T> = T extends (executor: ComputationalPlanExecutor, input: infer I) => Promise<unknown> ? I : never;

// Helper to execute a specific command with proper type narrowing
// By making this generic over K and extracting the input type, we get proper narrowing
async function executeCommand<K extends keyof CommandMap>(
  key: K,
  executor: ComputationalPlanExecutor,
  input: ExtractInput<CommandMap[K]>
): Promise<unknown> {
  const fn = commandMap[key];
  // TODO: Fix TypeScript union type narrowing issue - for now we cast the function since input is validated by assertExactStructure
  return (fn as unknown as (executor: ComputationalPlanExecutor, input: unknown) => Promise<unknown>)(executor, input);
}

// registry of decorated API functions (must expose .fromArgs/.fromObject/.argsMetadata/.objMetadata as provided by the decorator)
const commandMap = { // p: Record<string, ApiCommandFunction>
  sp1Plonk: performSp1Plonk, // as ApiCommandFunction,
  risc0Groth16: performRisc0Groth16, // as ApiCommandFunction,
  sp1Groth16: performSp1Groth16, // as ApiCommandFunction,
  snarkjsGroth16: performSnarkjsGroth16, // as ApiCommandFunction,
};
type CommandMap = typeof commandMap;

/*
const a = commandMap['sp1Groth16'];
// Risc0Groth16Proof | Risc0Groth16Vk Risc0Groth16Proof
performRisc0Groth16.fromArgs({} as Risc0Groth16Vk, {} as Risc0Groth16Vk, );

performRisc0Groth16.schema

performSnarkjsGroth16.fromArgs({} as SnarkjsVK, {} as SnarkjsVK, {} as SnarkjsVK)


performSnarkjsGroth16.schema;
*/

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
  logger.debug(`[${name}] supportsArgs: ${supportsArgs}, fromArgs type: ${typeof fn?.fromArgs}`);
  if (supportsArgs && typeof fn.fromArgs === 'function') {
    const fromArgsWithKeys = fn.fromArgs as { keys?: readonly string[] };
    logger.debug(`[${name}] fromArgs.keys: ${JSON.stringify(fromArgsWithKeys.keys)}`);
  }
  const argsMeta = supportsArgs && typeof fn.fromArgs === 'function'
    ? (fn.fromArgs as { keys?: readonly string[] }).keys || null
    : null;
  logger.debug(`[${name}] argsMeta: ${JSON.stringify(argsMeta)}`);
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
    // Object mode is always supported (uses schema directly)
    parts.push('object: (yes)');
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
  logger.log('');

  // Print object-mode schema (always supported)
  logger.log('Object-mode schema:');
  if (typeof fn === 'function' && 'schema' in fn && fn.schema) {
    const objectSchema = describeSchema(fn.schema);
    const schemaLines = JSON.stringify(objectSchema, null, 2).split('\n');
    schemaLines.forEach(line => logger.log(line));
  } else {
    logger.log('  (no schema available)');
  }
  logger.log('');

  logger.log('Object-mode usage:');
  logger.log(`  $ nori-proof-converter ${commandName} path/to/${commandName}_input.json`);
  logger.log('');

  // Print args-mode schema if supported
  if (meta.supportsArgs && meta.argsMeta !== null && typeof fn === 'function' && 'schema' in fn && fn.schema) {
    logger.log('Args-mode (file-per-key) schemas:');
    type SchemaType = typeof fn.schema;
    for (const key of meta.argsMeta) {
      if (key in fn.schema) {
        const keySchema = describeSchema(fn.schema[key as keyof SchemaType]);
        logger.log(`  ${key}.json should have:`);
        const schemaLines = JSON.stringify(keySchema, null, 2).split('\n');
        schemaLines.forEach(line => logger.log(`    ${line}`));
      }
    }
    logger.log('');
    logger.log('Args-mode usage:');
    const argsExamplePaths = meta.argsMeta
      .map((arg: string) => `path/to/${arg}.json`)
      .join(' ');
    logger.log(`  $ nori-proof-converter ${commandName} ${argsExamplePaths}`);
  } else {
    logger.log('Args-mode: not supported');
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
  .action((commandName: keyof typeof commandMap) => {
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
  .action(async (commandName: keyof typeof commandMap, args: string[] = []) => {
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

    const outputNameHint: string | undefined = args[0];

    try {
      if (mode === 'object') {
        // object-mode: single arg MUST be a file path (no inline JSON)
        const obj = readFileStrict(args[0]); // throws if missing or invalid
        if (typeof obj !== 'object' || obj === null) {
          throw new Error('Object-mode requires a JSON object file.');
        }

        // Validate the object against the schema
        if (typeof fn === 'function' && 'schema' in fn && fn.schema) {
          // Validation try-catch
          try {
            assertExactStructure(obj, fn.schema, args[0]);
          } catch (e: unknown) {
            const error = e as Error;
            // Validation error - print schema
            logger.error('');
            logger.error('Object-mode schema expected:');
            const objectSchema = describeSchema(fn.schema);
            const schemaLines = JSON.stringify(objectSchema, null, 2).split('\n');
            schemaLines.forEach(line => logger.error(line));
            logger.error('');
            logger.error('Validation errors:');
            logger.error(error.message);
            process.exit(1);
          }

          // Execution try-catch
          try {
            const result = await executeCommand(commandName, executor, obj);
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
        }
      } else {
        // args-mode: require each arg to be a file path containing JSON
        if (fn.fromArgs === false || typeof fn.fromArgs !== 'function') {
          throw new Error(
            `Command '${commandName}' does not support args-mode (.fromArgs not provided).`
          );
        }

        // Get the keys from fromArgs.keys
        const fromArgsWithKeys = fn.fromArgs as { keys?: readonly string[] };
        const argsKeys = fromArgsWithKeys.keys;
        if (!Array.isArray(argsKeys)) {
          throw new Error(
            `Command '${commandName}' missing keys metadata for args-mode validation.`
          );
        }

        if (args.length !== argsKeys.length) {
          throw new Error(
            `Args-mode requires ${argsKeys.length} file arguments (${argsKeys.join(', ')}). Received ${args.length}.`
          );
        }

        // Build and validate in the same scope
        if (typeof fn === 'function' && 'schema' in fn && fn.schema) {
          // Read each file one by one and build object
          const constructedObj: Record<string, unknown> = {};
          for (let i = 0; i < argsKeys.length; i++) {
            const key = argsKeys[i];
            const filePath = args[i];
            constructedObj[key] = readFileStrict(filePath);
          }

          // Validation try-catch
          try {
            assertExactStructure(constructedObj, fn.schema, `args-mode input (${argsKeys.join(', ')})`);
          } catch (e: unknown) {
            const error = e as Error;
            // Validation error - print schemas for each file
            logger.error('');
            logger.error('Args-mode validation failed.');
            logger.error('');
            logger.error('Expected schemas for each file:');
            const schemaObj = fn.schema as Record<string, SchemaNode>;
            for (let i = 0; i < argsKeys.length; i++) {
              const key = argsKeys[i];
              const filePath = args[i];
              if (key in schemaObj) {
                logger.error('');
                logger.error(`  ${filePath} (${key}.json):`);
                const keySchema = describeSchema(schemaObj[key]);
                const schemaLines = JSON.stringify(keySchema, null, 2).split('\n');
                schemaLines.forEach(line => logger.error(`    ${line}`));
              }
            }
            logger.error('');
            logger.error('Validation errors:');
            logger.error(error.message);
            process.exit(1);
          }

          // Execution try-catch
          try {
            const result = await executeCommand(commandName, executor, constructedObj);
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
        }
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
