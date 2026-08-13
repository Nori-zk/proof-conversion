import { spawn } from 'child_process';

// Runs a Node script as a subprocess with the given args and resolves with
// its trimmed stdout.
export function runWorker(scriptPath: string, args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let output = '';
    const child = spawn(
      'node',
      ['--max-old-space-size=6000', scriptPath, ...args],
      { env: process.env }
    );
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`'${scriptPath} ${args.join(' ')}' exited with code ${code}`));
        return;
      }
      resolvePromise(output.trim());
    });
  });
}
