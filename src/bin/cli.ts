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
import {
  describeSchema,
  type SchemaNode,
} from '../api/validation/guards/core.js';
import { performSnarkjsGroth16 } from '../api/snarkjs/groth16.js';
import { ComputationalPlanExecutor } from '../compute/executor.js';

new LogPrinter('NoriProofConverter');
const logger = new Logger('CLI');

const MAX_PROCESSES = parseInt(process.env.MAX_PROCESSES || '1', 10);
const executor = new ComputationalPlanExecutor(MAX_PROCESSES);

// Extract input type from a command function
type ExtractInput<T> = T extends (
  executor: ComputationalPlanExecutor,
  input: infer I
) => Promise<unknown>
  ? I
  : never;

// Helper to execute a specific command with proper type narrowing
// By making this generic over K and extracting the input type, we get proper narrowing
async function executeCommand<K extends keyof CommandMap>(
  key: K,
  executor: ComputationalPlanExecutor,
  input: ExtractInput<CommandMap[K]>
): Promise<unknown> {
  const fn = commandMap[key];
  // TODO: Fix TypeScript union type narrowing issue - for now we cast the function since input is validated by assertExactStructure
  return (
    fn as unknown as (
      executor: ComputationalPlanExecutor,
      input: unknown
    ) => Promise<unknown>
  )(executor, input);
}

// registry of decorated API functions (must be decorated by ApiMethod)
const commandMap = {
  sp1Plonk: performSp1Plonk,
  risc0Groth16: performRisc0Groth16,
  sp1Groth16: performSp1Groth16,
  snarkjsGroth16: performSnarkjsGroth16,
};
type CommandMap = typeof commandMap;
type CommandMapKey = keyof CommandMap;

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

// Strict: read a path as JSON file, or print help + error and exit
function readFileStrict(
  p: string,
  commandName: CommandMapKey,
  keyHint?: string
): unknown {
  if (!fs.existsSync(p) || !fs.statSync(p).isFile()) {
    const mode = keyHint ? 'Args-mode' : 'Object-mode';
    const argInfo = keyHint ? ` for argument '${keyHint}':` : ':';
    logger.error(
      `${mode}: file does not exist${argInfo}. Printing usage information:`
    );
    describeCommand(commandName);
    logger.error(`Failed to read file${argInfo}`);
    logger.error(`  File: ${p}${keyHint ? ` (expected ${keyHint}.json)` : ''}`);
    logger.error(`  Reason: File does not exist or is not a file.`);
    logger.error('');
    logger.fatal(
      `Due to the file read error running '${commandName}' in '${mode}' cannot continue`
    );
    process.exit(1);
  }
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e: unknown) {
    const error = e as Error;
    const mode = keyHint ? 'Args-mode' : 'Object-mode';
    const argInfo = keyHint ? ` for argument '${keyHint}'` : '';
    logger.error(
      `${mode}: invalid JSON${argInfo}. Printing usage information:`
    );
    describeCommand(commandName);
    logger.error(`Failed to parse JSON from file${argInfo}`);
    logger.error(`  File: ${p}${keyHint ? ` (expected ${keyHint}.json)` : ''}`);
    logger.error(`  Reason: ${error.message ?? error}`);
    logger.error('');
    logger.fatal(
      `Due to the JSON parse error running '${commandName}' in '${mode}' cannot continue`
    );
    process.exit(1);
  }
}

// --- help utilities using metadata ---
function summariseCommandMetadata(
  name: string,
  fn: CommandMap[keyof CommandMap]
) {
  const supportsArgs = typeof fn?.fromArgs === 'function';
  logger.debug(
    `[${name}] supportsArgs: ${supportsArgs}, fromArgs type: ${typeof fn?.fromArgs}`
  );
  if (supportsArgs && typeof fn.fromArgs === 'function') {
    const fromArgsWithKeys = fn.fromArgs as { keys?: readonly string[] };
    logger.debug(
      `[${name}] fromArgs.keys: ${JSON.stringify(fromArgsWithKeys.keys)}`
    );
  }
  const argsMeta =
    supportsArgs && typeof fn.fromArgs === 'function'
      ? (fn.fromArgs as { keys?: readonly string[] }).keys || null
      : null;
  logger.debug(`[${name}] argsMeta: ${JSON.stringify(argsMeta)}`);
  return { name, supportsArgs, argsMeta };
}

// Helper to print object-mode schema
function printObjectModeSchema(schema: Record<string, SchemaNode>) {
  logger.log('');
  logger.log(`Provide one JSON file path arguments`);
  logger.log('');
  logger.log('Expected schemas for the file:');
  const objectSchema = describeSchema(schema);
  const schemaLines = JSON.stringify(objectSchema, null, 2).split('\n');
  schemaLines.forEach((line) => logger.log(`    ${line}`));
  logger.log('');
}

// Helper to print args-mode schemas for each file
function printArgsModeSchemas(
  argsKeys: readonly string[],
  schema: Record<string, SchemaNode>,
  filePaths?: string[]
) {
  logger.log('');
  logger.log(
    `Provide '${argsKeys.length}' JSON file path arguments, in order: ${argsKeys.join(', ')}`
  );
  logger.log('');
  logger.log('Expected schemas for each file:');
  for (let i = 0; i < argsKeys.length; i++) {
    const key = argsKeys[i];
    const filePath = filePaths ? filePaths[i] : undefined;
    if (key in schema) {
      logger.log('');
      if (filePath) {
        logger.log(`  ${filePath} (${key}.json):`);
      } else {
        logger.log(`  ${key}.json:`);
      }
      const keySchema = describeSchema(schema[key]);
      const schemaLines = JSON.stringify(keySchema, null, 2).split('\n');
      schemaLines.forEach((line) => logger.log(`    ${line}`));
    }
  }
  logger.log('');
}

function buildHelpAfterText() {
  const lines: string[] = [];
  lines.push('Available commands and metadata:');
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
  lines.forEach((line)=>logger.log(line));
  return '';
}

function describeCommand(commandName: CommandMapKey) {
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
    printObjectModeSchema(fn.schema);
  } else {
    logger.log('  (no schema available)');
  }
  logger.log('');

  logger.log('Object-mode usage:');
  logger.log(
    `  $ nori-proof-converter ${commandName} path/to/${commandName}_input.json`
  );
  logger.log('');

  // Print args-mode schema if supported
  if (
    meta.supportsArgs &&
    meta.argsMeta !== null &&
    typeof fn === 'function' &&
    'schema' in fn &&
    fn.schema
  ) {
    logger.log('Args-mode (file-per-key) schemas:');
    printArgsModeSchemas(meta.argsMeta, fn.schema);
    logger.log('Args-mode usage:');
    const argsExamplePaths = meta.argsMeta
      .map((arg: string) => `path/to/${arg}.json`)
      .join(' ');
    logger.log(`  $ nori-proof-converter ${commandName} ${argsExamplePaths}`);
  } else {
    logger.log('Args-mode: not supported');
  }
}

const program = new Command();
program
  .name(Object.keys(packageJson.bin)[0])
  .description(packageJson.description)
  .version(packageJson.version);

// append metadata summary to help text
program.addHelpText('after', () => buildHelpAfterText());

// describe subcommand (same output as describeCommand, but callable)
program
  .command('describe [command]')
  .description('Show detailed metadata and examples for a command')
  .action((commandName: CommandMapKey | undefined) => {
    logger.info(
      `Running action for command='describe', args=[${commandName ? `'${commandName}'` : ''}]`
    );
    if (!commandName) {
      logger.error(
        `describe: missing required argument 'command'. Printing usage information:`
      );
      logger.log('');
      logger.log('Usage:');
      logger.log('  $ nori-proof-converter describe <command>');
      logger.log('');
      logger.log('Available commands:');
      Object.keys(commandMap).forEach((name) => {
        logger.log(`  - ${name}`);
      });
      logger.log('');
      logger.fatal(
        `Due to missing required argument running 'describe' cannot continue`
      );
      process.exit(1);
    }

    try {
      describeCommand(commandName);
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
  .argument('<command>', 'command to execute (e.g. sp1Plonk or risc0Groth16)')
  .argument(
    '[args...]',
    'optional arguments: single JSON file (object-mode) or multiple file paths (args-mode)'
  )
  .action(async (commandName: CommandMapKey, args: string[] = []) => {
    logger.info(
      `Running action for command='${commandName}', args=${JSON.stringify(
        args
      )}`
    );
    const fn = commandMap[commandName];
    if (!fn) {
      logger.fatal(
        `Command '${commandName}' not found. Available: ${Object.keys(
          commandMap
        ).join(', ')}`
      );
      process.exit(1);
    }

    // If no args provided, print command-specific help/metadata and exit
    if (!Array.isArray(args) || args.length === 0) {
      logger.info(`No args provided for '${commandName}' — printing usage:`);
      describeCommand(commandName);
      process.exit(0);
    }

    // determine mode and validate
    const mode = args.length === 1 ? 'object' : 'args';
    logger.debug(`selected mode='${mode}'`);

    const outputNameHint: string | undefined = args[0];

    if (mode === 'object') {
      // object-mode: single arg MUST be a file path (no inline JSON)
      const obj = readFileStrict(args[0], commandName);
      if (typeof obj !== 'object' || obj === null) {
        logger.fatal('Object-mode requires a JSON object file.');
        process.exit(1);
      }

      // Validate the object against the schema
      if (typeof fn === 'function' && 'schema' in fn && fn.schema) {
        // Validation try-catch
        try {
          assertExactStructure(obj, fn.schema, `Object-mode input ${args[0]}`);
        } catch (e: unknown) {
          const error = e as Error;
          // Validation error - print schema
          logger.error(`Object-mode validation failed for '${commandName}'.`);

          printObjectModeSchema(fn.schema);
          logger.error('Validation errors:');
          logger.error('');

          // Parse and format errors
          logger.error(`  ${args[0]}:`);
          const errorLines = error.message
            .split('\n')
            .filter(
              (line) => line.trim() && !line.includes('validation failed:')
            );
          errorLines.forEach((line) => logger.error(`    ${line}`));
          logger.error('');
          logger.fatal(
            `Due to the validation issues running '${commandName}' in '${mode}' mode cannot continue`
          );
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
            `Wrote result of command '${commandName}' to disk: '${outputFilePath}'`
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
      } else {
        logger.fatal(
          `Command '${commandName}' was not a compatible ApiMethod. Raise an issue in our GitHub!`
        );
        process.exit(1);
      }
    } else {
      // args-mode: require each arg to be a file path containing JSON
      if (fn.fromArgs === false || typeof fn.fromArgs !== 'function') {
        logger.fatal(
          `Command '${commandName}' does not support args-mode. Please provide a single json file path argument.`
        );
        process.exit(1);
      }

      // Get the keys from fromArgs.keys
      const fromArgsWithKeys = fn.fromArgs as { keys?: readonly string[] };
      const argsKeys = fromArgsWithKeys.keys;
      if (!Array.isArray(argsKeys)) {
        logger.fatal(
          `Command '${commandName}' missing keys metadata for args-mode validation. Please raise an issue on Github!`
        );
        process.exit(1);
      }

      if (args.length !== argsKeys.length) {
        logger.error(
          `Args-mode requires ${argsKeys.length} file arguments. Received ${args.length}.`
        );

        // Print schemas for each expected file
        const schemaObj = fn.schema as Record<string, SchemaNode>;
        printArgsModeSchemas(argsKeys, schemaObj);

        logger.error('Usage:');
        const argsExamplePaths = argsKeys
          .map((arg: string) => `path/to/${arg}.json`)
          .join(' ');
        logger.error(
          `  $ nori-proof-converter ${commandName} ${argsExamplePaths}`
        );
        logger.error('');
        logger.fatal(
          `Due to wrong number of arguments running '${commandName}' in '${mode}' mode cannot continue`
        );
        process.exit(1);
      }

      // Build and validate in the same scope
      if (typeof fn === 'function' && 'schema' in fn && fn.schema) {
        // Read each file one by one and build object
        const constructedObj: Record<string, unknown> = {};
        for (let i = 0; i < argsKeys.length; i++) {
          const key = argsKeys[i];
          const filePath = args[i];
          constructedObj[key] = readFileStrict(filePath, commandName, key);
        }

        // Validation try-catch
        try {
          assertExactStructure(
            constructedObj,
            fn.schema,
            `Args-mode input (${argsKeys.join(', ')})`
          );
        } catch (e: unknown) {
          const error = e as Error;
          // Validation error - print schemas for each file
          logger.error(`Args-mode validation failed for '${commandName}'.`);

          const schemaObj = fn.schema as Record<string, SchemaNode>;
          printArgsModeSchemas(argsKeys, schemaObj, args);

          logger.error('Validation errors:');
          logger.error('');

          // Parse and group errors by file
          const errorsByFile: Record<string, string[]> = {};
          const errorLines = error.message
            .split('\n')
            .filter(
              (line) => line.trim() && !line.includes('validation failed:')
            );

          for (const errorLine of errorLines) {
            // Extract the top-level key from the path
            // Match patterns like: "key[...]", "key:", "key should have type"
            const match = errorLine.match(/^\s*(\w+)(?:\[|:| )/);
            if (match) {
              const fileKey = match[1];
              if (!errorsByFile[fileKey]) {
                errorsByFile[fileKey] = [];
              }
              errorsByFile[fileKey].push(errorLine);
            }
          }

          // Print errors grouped by file
          for (let i = 0; i < argsKeys.length; i++) {
            const key = argsKeys[i];
            const filePath = args[i];
            const fileErrors = errorsByFile[key];

            if (fileErrors && fileErrors.length > 0) {
              logger.error(`  ${filePath} (${key}.json):`);
              fileErrors.forEach((err) => {
                logger.error(`    ${err}`);
              });
              logger.error('');
            }
          }

          logger.fatal(
            `Due to the validation issues running '${commandName}' in '${mode}' mode cannot continue`
          );
          process.exit(1);
        }

        // Execution try-catch
        try {
          const result = await executeCommand(
            commandName,
            executor,
            constructedObj
          );
          const resultStr = JSON.stringify(result, null, 2);
          const outputFilePath = writeJsonFile(
            outputNameHint,
            commandName,
            resultStr
          );
          logger.info(
            `Wrote result of command ${commandName} to disk: '${outputFilePath}'`
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
      } else {
        logger.fatal(
          `Command '${commandName}' was not a compatible ApiMethod. Raise an issue in our GitHub!`
        );
        process.exit(1);
      }
    }
  });

// show help when no args at all
if (process.argv.length <= 2) {
  logger.log(program.helpInformation());
  logger.log(`Version: ${version}`);
  logger.log(`Available commands: ${Object.keys(commandMap).join(', ')}`);
  process.exit(0);
}

// Override exit
try {
  program.exitOverride((err) => {
    if (err.exitCode === 0) {
      process.exit(0);
    }
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

// TODO Override help... How??

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
