import * as console from 'console';
import { LogPrinter } from 'esm-iso-logger';

global.console = console;

// Without this, esm-iso-logger's Logger instances (used throughout the
// compute executor / API methods, e.g. `new Logger('API')` in
// src/api/risc0/groth16.ts) emit to nothing under jest - only plain
// console.log calls show up. The CLI wires this up once at startup
// (src/bin/cli.ts: `new LogPrinter('NoriProofConverter')`); tests need the
// same thing so pipeline logging is visible when running e2e specs.
new LogPrinter('NoriProofConversionTests');
