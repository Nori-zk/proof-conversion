import { Fp2 } from './fp2.js';
import fs from 'fs';
import { GAMMA_1S, GAMMA_2S, GAMMA_3S, NEG_GAMMA_13 } from './precomputed.js';

fs.writeFile(
  './src/towers/gamma_1s.json',
  JSON.stringify(GAMMA_1S.map((g: Fp2) => Fp2.toJSON(g)), null, 2) + '\n',
  'utf8',
  (err: NodeJS.ErrnoException | null) => {
    if (err) {
      console.error('Error writing gamma_1s to file:', err);
      process.exit(1);
    }
    console.log('Data has been written to gamma_1s.json');
  }
);

fs.writeFile(
  './src/towers/gamma_2s.json',
  JSON.stringify(GAMMA_2S.map((g: Fp2) => Fp2.toJSON(g)), null, 2) + '\n',
  'utf8',
  (err: NodeJS.ErrnoException | null) => {
    if (err) {
      console.error('Error writing gamma_2s to file:', err);
      process.exit(1);
    }
    console.log('Data has been written to gamma_2s.json');
  }
);

fs.writeFile(
  './src/towers/gamma_3s.json',
  JSON.stringify(GAMMA_3S.map((g: Fp2) => Fp2.toJSON(g)), null, 2) + '\n',
  'utf8',
  (err: NodeJS.ErrnoException | null) => {
    if (err) {
      console.error('Error writing gamma_3s to file:', err);
      process.exit(1);
    }
    console.log('Data has been written to gamma_3s.json');
  }
);

fs.writeFile(
  './src/towers/neg_gamma.json',
  JSON.stringify(Fp2.toJSON(NEG_GAMMA_13), null, 2) + '\n',
  'utf8',
  (err: NodeJS.ErrnoException | null) => {
    if (err) {
      console.error('Error writing neg_gamma to file:', err);
      process.exit(1);
    }
    console.log('Data has been written to neg_gamma.json');
  }
);

// let gamma_1s_input = fs.readFileSync('./src/towers/gamma_1s.json', 'utf8');
// let parsed_gamma_1s: any[] = JSON.parse(gamma_1s_input);
// let gamma_1s = parsed_gamma_1s.map(
//   (g: any): Fp2 => Fp2.fromJSON(g)
// );

// gamma_1s[0].assert_equals(GAMMA_1S[0]);
