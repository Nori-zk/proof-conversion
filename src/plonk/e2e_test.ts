import { Provable } from 'o1js';
import v8 from 'v8';
import { Sp1PlonkVerifier } from './verifier.js';
import { VK } from './vk.js';
import fs from 'fs';
import { FrC } from '../towers/fr.js';
import { Sp1PlonkProof, deserializeProof } from './proof.js';
import { parsePublicInputs } from './parse_pi.js';
import { AuXWitness } from './aux_witness.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const g2_lines_required = require('./mm_loop/g2_lines.json');
const tau_lines_required = require('./mm_loop/tau_lines.json');
//import g2_lines_required from './mm_loop/g2_lines.json';
//import tau_lines_required from './mm_loop/tau_lines.json';
const g2_lines = JSON.stringify(g2_lines_required); //fs.readFileSync(`./src/plonk/mm_loop/g2_lines.json`, 'utf8');
const tau_lines = JSON.stringify(tau_lines_required); //fs.readFileSync(`./src/plonk/mm_loop/tau_lines.json`, 'utf8');

const hexProof =
  '0x000000002b348a7107866750f6543d7e689063c17446f56f2a27fb5d94413598afaa2a27278a2e97e14e0c017239058f400399637eb89cec1b09bc8985b31a836d2d25bc223f681b0ec1df64b686b7daa8f59cb9d607fdb2720961bf4d91d7351f0091271ecdb68301bd567ca89baf923cdb6d7aa38d5cc4f7d574c7f2308ab43e2b5aa812b80de51f005a9e41f0a75af50e759c1240ef0d6e255a64198a8b7f494461b61529dbe2eebf91ca13d0800d76ef36db03433995c1f4290c7e21a26c87ffaf5714061df93a9e8cd84378bc8c24c58006bd61baa7f2bbb338538dc30be142d6c211773281f596168cba5a97918e255351d0ae36405ba6c67e1668f0af2478c82f08def7e6614240c323b5ef448ea8defa80d6db5b57451ce6d35258fbed5f276910799d30f5617773da68807ca837eafbdfc7dc0141f65e6b9a25da87cd0c0acf1795e3e7a46f6f8b82cf3987f9a52ac4e71e9077cfb0e242621e75f92cb6948d1512a00e840652ba614abb71ccc2119ae6177b0dfb1a111493d0ce58b7c73fc7061ca8e68485048b6f210449d94114f6799afaeffe5e41ae9a3a3eee8e33ce3b1a0ea9570f365b14fa3ec1bba9c8a98196e71a77102453042588dc0e3a238a68057efb6e482f4acd040b18bf0affae6ae1fa7899c5e52196fcfbad77c88bc45228956fa5e51b258d192bc4fe66a6d20a88a7a7c4aad0d951cc8e733e0c6edda71b1b865106329c0f82fd1d305efd7fcb7ac497898e2471a8bb258770b4dea4261ad5f30f167a7ed121fde7965793f1a8e63ccd4b9085762163bfc2643c93355d300dccd1c012c6665cbf15d169d76544605f36c438a93e13bba1594b5cbcbaad28059a3693207cd063ab87569122198e5fe3628e23a0d2fe2c6ee4339995f4c212f95e284b23f6f5b68bfd6558826bf5a43462baa4098336fb988e7985dd792e2dd2c25876aa9ab4b3ab243b9e7203fc742435a4cf7835e3f3a6b15fc157ad792b7c2b6a91cf8eb556cc1b0f01a055767b1a79b56ad432f355158fb96be20b970675efc8bd93ca9686a60084dd0ea78e6899d0646b2a733c8bf93480cd03b3d40efffec4db241761fae520d8b18e529b9854b872f1fc2f4ff5a5c3b8929a223c066f4bc867ac93e2f7a5070d0ca8d2321ae0919a250432e4d0afb1ec7d5d2d930514a682d50772e4a4592122d94bea1f459545b3738da896146a24c4ad95f7c9';
const programVk =
  '59324415940869066039123984526206753880970583045117737570549855736778974249';
const piHex =
  '0xf744347c0307cbdbc4b7f03bc58423268799cd8008b182aeff7a388d8e1132e84c037de9f8bee7e3b1cb70b5e1cc5272e1f2a3c0a6f8eed40b7465afb0020ad20e38cf85aee627d711b046ecd5749f7f276b2212dcb33f8d7f1da16e89bf9efc00000000000000000000000000000000000000000000000000000000001c788e00000000000000000000000000000000000000000000000000000000001c78a2000000000000000000000000000000000000000fffffffffffffffffffffffff';

const auxWtnsJSON = {
  c: {
    g00: '672065780038225432796180279410858165330938844895825122079090027796565770096',
    g01: '16377509699287614675451231190756608105313274811968943074449485094211846914292',
    g10: '17025535842766212447876586775083616174185101681436325360465167496457088955040',
    g11: '6185199670713267884898853863672318143851252647258880470011449698335736075683',
    g20: '15307233113382602021125643806454272484089705878578731247297656075625138666803',
    g21: '19165870072884453366333407271566065865145576833763147192570311323531104686526',
    h00: '20555152638297213117585501618484672831816810592999476908579150273779296292448',
    h01: '13103207647384813544522197065685455036734966829857169511828595558377675408358',
    h10: '6641517964032836013612058443951727719028336404026524422075979799307064751535',
    h11: '20070665456234328031801955227480156660637017270071962215814749116463333494892',
    h20: '21715475519688654116267711493102533422345400646335516342868315117192312699602',
    h21: '7853618919741584922733469121150194687973711115638758989162163786241076713824',
  },
  shift_power: '2',
};
const auxWitness = AuXWitness.loadFromJSON(auxWtnsJSON);

const Verifier = new Sp1PlonkVerifier(VK, g2_lines, tau_lines);

function main() {
  const [pi0, pi1] = Provable.witness(Provable.Array(FrC.provable, 2), () =>
    parsePublicInputs(programVk, piHex)
  );
  const proof = Provable.witness(
    Sp1PlonkProof,
    () => new Sp1PlonkProof(deserializeProof(hexProof))
  );

  Verifier.verify(proof, pi0, pi1, auxWitness);
}

// npm run build && node --max-old-space-size=65536 build/src/plonk/e2e_test.js
(async () => {
  console.time('running Fp constant version');
  main();
  console.timeEnd('running Fp constant version');

  console.time('running Fp witness generation & checks');
  await Provable.runAndCheck(main);
  console.timeEnd('running Fp witness generation & checks');

  console.time('creating Fp constraint system');
  let cs = await Provable.constraintSystem(main);
  console.timeEnd('creating Fp constraint system');

  console.log(cs.summary());
  const totalHeapSize = v8.getHeapStatistics().total_available_size;
  let totalHeapSizeinGB = (totalHeapSize / 1024 / 1024 / 1024).toFixed(2);
  console.log(`Total heap size: ${totalHeapSizeinGB} GB`);

  // used_heap_size
  const usedHeapSize = v8.getHeapStatistics().used_heap_size;
  let usedHeapSizeinGB = (usedHeapSize / 1024 / 1024 / 1024).toFixed(2);
  console.log(`Used heap size: ${usedHeapSizeinGB} GB`);
})();
