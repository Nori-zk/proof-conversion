import { Provable } from 'o1js';
import v8 from 'v8';
import { Sp1PlonkVerifier } from './verifier.js';
import { VK } from './vk.js';
import { FrC } from '../towers/fr.js';
import { Sp1PlonkProof, deserializeProof } from './proof.js';
import { parsePublicInputs } from './parse_pi.js';
import { AuXWitness } from './aux_witness.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const g2_lines_required = require('./mm_loop/g2_lines.json');
const tau_lines_required = require('./mm_loop/tau_lines.json');
//import g2_lines_required from './mm_loop/g2_lines.json';
//import tau_lines_required from './mm_loop/tau_lines.json';
const g2_lines = JSON.stringify(g2_lines_required); //fs.readFileSync(`./src/plonk/mm_loop/g2_lines.json`, 'utf8');
const tau_lines = JSON.stringify(tau_lines_required); //fs.readFileSync(`./src/plonk/mm_loop/tau_lines.json`, 'utf8');

// SP1 v5: hexProof had a 4-byte vkey-hash prefix; programVk/piHex/auxWtns were v5 values; no pi2/pi3/pi4.
// SP1 v6: hexProof is raw gnark proof (96-byte SP1 prefix stripped); pi2/pi3/pi4 added.
const hexProof =
  '0x2fa6371b5f35e61b6ee787a62f9b9d2ab098c01a69c567936a516b6a30d724090f3acd44d559006b3c80ae52ef31bdfb0d44d203f078b803a5817e3155b75c172ce81bfce68297ffbbfd99b14103062a8e9961545e519d165659c9b7f55dfee31c22c3ffc0357f6a444ebf34f863500658708146821f7311b96561684f0c5427051f886e102d3dd013716b9135c9930cb2d586fb11174ef830e48ca1921308241bc56c5cc5299e3ac08cd6da72a38335ac862278fe8e9ebfe8993d08f3dbab0014f70705f8afecc117a14a985f352399d77b30749216cc3ac96cf8b8aaa1183209bb06da94df7869b93bec52c74a895e46146a4038ec90d877181bf5045c5e550e81bbfd082045362b977f731ee4fef04f4f81b504a556e85ca07d389b9c968f1335eacf508bb3144087c63f961bb3fa76d99c147e80ce77224729f87939691b0e821573fa2c5514a8b6b5577843879c2933b5f7b6113a6f29e1fa7ac64518b11fae7b000ebf59a769976544cd3875650fc844860426363b26fc7310eebef5e620cd8a3343510e1dd99466036de5d6f82297b800a8730ad1cba49f6915e62fd4070b8d69efb6a993795565883363abc818be3baefe57021db0e9129b31c5bda4276b713da355f876101be16aca930418068bb26a87f16e87abcda02341a43aa12a8b1837c44c580465b01614d069776f12fb63bd901cff54362f7829d0ea19881d032ff5624a2a6efe366915d7d98de4128d6ae924defbc9ac60708e2991acdc0bc5fd8a5c704ecf295f6bfeb7a93c51e7cff86bb2e018d838cca098b83d3acc1b74ae28d432876e0bf2e3df8773fdc79f4312c2da8472ea2ce2fbe12b92d3d32411b806bdb74428b584c066f2cae5e947d58827e8d093324756c010d5a732a1254fe6790b5e6afa3df946fe1c2aee5b764da69c711684e7e5305a3dddf9bfab2c166eeefaaaa3ac9e97f5d8a731f33b0c5728348d12e975801043e7038babd406c904a6771994738e992240b03669d62cdc734f586f943e8c7e21513ba60adb0ce1fa79a3637b7b7b97134d029b5091aa978023c3ef1a40c8837c8fd492177a014760a68808b42da6565350376d1b7e793899e0b4028aa052265a01a512f2860a2abb7d20db39520ebb97e29ef40d05d1e4cdd399f91e42414b796e0657183101bcf700f9490eac8328dbfd7790f0b506b0218e441908a72d9128cf6b750b5a';
const programVk =
  '43461131588686223641337899419912555996095376523616191917604125452674317300';
const piHex =
  '0x000000000093544016227b1189eb5e8f87f888a095a94d580be01ba299a7258bfb2df338dc407e1f00000000009354603808741da450ca33951bbaf45c8e3575e87df6a923a477f04d1c2e509946df6d081051a57085376d588d45812d060de9efc1c21a031fe780301989ed8904ae5e00000000000000000000000000000000000000000000000000000000000000005dde454730f62c0a078137ecdfd85dec121fee45ac94aa90a78bb18ff2edca9d';
// SP1 v6: exit_code / vk_root / proof_nonce from public_inputs[2..4]
const pi2Hex = '0';
const pi3Hex = '248831628400185611740479071450564250193912070693925013182243127282342200944';
const pi4Hex = '0';

const auxWtnsJSON = {
  c: {
    g00: '12714043672891950886966957300333822067883471271914064550003022986019387546280',
    g01: '13093295111592901961581289292567871102629938196227222625980588910817898130581',
    g10: '4372007900064994191927900348426744350657725596653569963677230261923433768707',
    g11: '5966853439446300421271349091057728922750056176441156611552781372605112183161',
    g20: '328592474816806440556609364134748518855233707074851957196463874370639429164',
    g21: '20459618942177162005550261369052320319731393974203707703176682959016777272608',
    h00: '8199745618899020988111203295062207561548795287449882826782644622204407719648',
    h01: '15718852185731305763220603025535219600958553611291099208540065885878662141332',
    h10: '16589842896598584487080559704390636730114134837464047588803872817114147252052',
    h11: '19496853077113538431322531520124598610622000200352606171544792502285068482707',
    h20: '13364093559456064471496079161371773353997993079145045669339379411475428677665',
    h21: '13263440251490314958833045766938401288838551484283233157549991386470003126334',
  },
  shift_power: '2',
};
const auxWitness = AuXWitness.loadFromJSON(auxWtnsJSON);

const Verifier = new Sp1PlonkVerifier(VK, g2_lines, tau_lines);

function main() {
  const [pi0, pi1] = Provable.witness(Provable.Array(FrC.provable, 2), () =>
    parsePublicInputs(programVk, piHex)
  );
  // SP1 v5: only pi0/pi1 passed to verify.
  // SP1 v6: pi2/pi3/pi4 (exit_code/vk_root/proof_nonce) added.
  const pi2 = Provable.witness(FrC.provable, () => FrC.from(pi2Hex));
  const pi3 = Provable.witness(FrC.provable, () => FrC.from(pi3Hex));
  const pi4 = Provable.witness(FrC.provable, () => FrC.from(pi4Hex));
  const proof = Provable.witness(
    Sp1PlonkProof,
    () => new Sp1PlonkProof(deserializeProof(hexProof))
  );
  Verifier.verify(proof, pi0, pi1, pi2, pi3, pi4, auxWitness);
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
