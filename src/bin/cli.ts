import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ComputationalPlanExecutor } from "../compute/execute.js";
import { performSp1ToPlonk } from "../api/sp1/plonk.js";
import { Logger } from "../logging/logger.js";
import { LogPrinter } from "../logging/log_printer.js";

const logPrinter = new LogPrinter(['log', 'warn', 'error', 'debug', 'fatal', 'verbose']);
const logger = new Logger('CLI');

// Define max processes
const MAX_PROCESSES = parseInt(process.env.MAX_PROCESSES || '1');
const executor = new ComputationalPlanExecutor(MAX_PROCESSES);

// Define the command type for function signatures
type CommandFunction = (fileData: any) => Promise<any>;

// Command map where key is command name, value is async function
const commandMap: Record<string, CommandFunction> = {
  sp1ToPlonk: (fileData) => performSp1ToPlonk(executor, fileData)
};

// Get the current file's directory (ESM equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve package.json dynamically
const packageJsonPath = path.resolve(__dirname, "..", "..", "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

const program = new Command();

// Set metadata for the CLI
program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

// Define the main command
program
  .argument('<command>', 'command to execute (e.g. sp1ToPlonk)')
  .argument('<file-path>', 'file path to process')
  .action((commandName: string, filePath: string) => {
    logger.log(`Command '${commandName}' received with input path '${filePath}'`);
    // Check if the command exists in the map
    const commandFunction = commandMap[commandName];

    // If command is invalid, show available commands
    if (!commandFunction) {
      logger.fatal(`Error: Command '${commandName}' not found.`);
      logger.fatal(`Available commands: ${Object.keys(commandMap).join(', ')}`);

      process.exit(1);
    }

    logger.log(`Command '${commandName}' supported proceeding...`);

    // Read input data from the file
    let fileData: string;
    try {
      fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      logger.fatal(`Error reading JSON file at ${filePath}: ${err}`);
      process.exit(1);
    }

    logger.log(`Input path correct '${filePath}', json deserialized.`);
    logger.log(`Running ${commandName} with input data:`);

    // Execute the corresponding function with the file data
    commandFunction(fileData)
      .then((result) => {
        const resultStr = JSON.stringify(result, null, 2);
        logger.log(resultStr);  // Pretty-print result
        fs.writeFileSync(`${filePath}.converted`, resultStr);
      })
      .catch((err: unknown) => {
        logger.fatal(`Error executing command: ${err}`);
        process.exit(1);
      });
  });

// Add a basic check for arguments and show help if needed
if (process.argv.length <= 2) {
  console.log(program.helpInformation());  // Directly output help without triggering exit
  process.exit(0);  // Exit normally
} else {
  try {
    // Configure exit override to handle errors without recursion
    program.exitOverride((err) => {
      console.log(program.helpInformation());  // Output help text directly
      process.exit(1);  // Exit manually with error code
    });

    // Parse the command line arguments
    program.parse(process.argv);
  } catch (e: any) {
    console.log(program.helpInformation());
    process.exit(1);
  }
}

// Handle Ctrl+C (SIGINT)
process.on("SIGINT", async () => {
  try {
    logger.warn("Process interrupted by user. Cleaning up.");
    await executor.terminate();
    logger.fatal("Cleanup finished. Exiting now.");
    process.exit(0);
  }
  finally {
    logger.fatal("Cleanup failed. Exiting now.");
    process.exit(1);
  }
});