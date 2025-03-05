import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { ComputationalPlanExecutor } from "../compute/execute.js";
import { performSp1ToPlonk } from "../api/sp1/plonk.js";

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
    // Check if the command exists in the map
    const commandFunction = commandMap[commandName];

    // If command is invalid, show available commands
    if (!commandFunction) {
      console.error(`Error: Command '${commandName}' not found.`);
      console.log('\nAvailable commands:');
      console.log(Object.keys(commandMap).join(', '));  // List available commands
      process.exit(1);
    }

    // Read input data from the file
    let fileData: string;
    try {
      fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`Error reading JSON file at ${filePath}: ${err}`);
      process.exit(1);
    }

    // Execute the corresponding function with the file data
    commandFunction(fileData)
      .then((result) => {
        const resultStr = JSON.stringify(result, null, 2);
        console.log(resultStr);  // Pretty-print result
        fs.writeFileSync(`${filePath}.converted`,resultStr);
      })
      .catch((err: unknown) => {
        console.error('Error executing command:', err);
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