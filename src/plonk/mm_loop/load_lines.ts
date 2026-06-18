import { G2Line, G2LineJSON } from '../../lines/index.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const g2_lines_required = require('./g2_lines.json');
const tau_lines_required = require('./tau_lines.json');

const parsed_g2_lines: G2LineJSON[] = JSON.parse(JSON.stringify(g2_lines_required));
const g2_lines = parsed_g2_lines.map((g: G2LineJSON): G2Line => G2Line.fromJSON(g));

const parsed_tau_lines: G2LineJSON[] = JSON.parse(JSON.stringify(tau_lines_required));
const tau_lines = parsed_tau_lines.map((tau: G2LineJSON): G2Line => G2Line.fromJSON(tau));

export { g2_lines, tau_lines };
