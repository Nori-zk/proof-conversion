#!/usr/bin/env node

// Use child_process to run the main script with flags
import { spawn } from "child_process";

// Run the actual script with the required Node.js flags
const child = spawn('node', ['--experimental-vm-modules', '--experimental-wasm-modules', '--wasm-max-table-size=1000', './build/src/bin/cli.js', ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: process.cwd()
});

// Exit with the same code as the child process
child.on('exit', (code) => {
  process.exit(code);
});