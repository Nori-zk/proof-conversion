import { FrC } from '../../towers/fr.js';
import {
  compute_alpha_square_lagrange_0,
  compute_commitment_linearized_polynomial,
  customPiLagrange,
  evalVanishing,
  fold_quotient,
  fold_state,
  opening_of_linearized_polynomial,
  pi_contribution,
  preparePairing,
} from './plonk_utils.js';
import { Sp1PlonkFiatShamir } from '../fiat-shamir/index.js';
import { Sp1PlonkProof, deserializeProof } from '../proof.js';
import { VK } from '../vk.js';
import { assertPointOnBn } from '../utils.js';

// SP1 v5: hexProof had a 4-byte vkey-hash prefix; pi0/pi1 were v5 values; no pi2/pi3/pi4.
// SP1 v6: hexProof is raw gnark proof (96-byte SP1 prefix stripped); pi2/pi3/pi4 added.
const hexProof =
  '0x2fa6371b5f35e61b6ee787a62f9b9d2ab098c01a69c567936a516b6a30d724090f3acd44d559006b3c80ae52ef31bdfb0d44d203f078b803a5817e3155b75c172ce81bfce68297ffbbfd99b14103062a8e9961545e519d165659c9b7f55dfee31c22c3ffc0357f6a444ebf34f863500658708146821f7311b96561684f0c5427051f886e102d3dd013716b9135c9930cb2d586fb11174ef830e48ca1921308241bc56c5cc5299e3ac08cd6da72a38335ac862278fe8e9ebfe8993d08f3dbab0014f70705f8afecc117a14a985f352399d77b30749216cc3ac96cf8b8aaa1183209bb06da94df7869b93bec52c74a895e46146a4038ec90d877181bf5045c5e550e81bbfd082045362b977f731ee4fef04f4f81b504a556e85ca07d389b9c968f1335eacf508bb3144087c63f961bb3fa76d99c147e80ce77224729f87939691b0e821573fa2c5514a8b6b5577843879c2933b5f7b6113a6f29e1fa7ac64518b11fae7b000ebf59a769976544cd3875650fc844860426363b26fc7310eebef5e620cd8a3343510e1dd99466036de5d6f82297b800a8730ad1cba49f6915e62fd4070b8d69efb6a993795565883363abc818be3baefe57021db0e9129b31c5bda4276b713da355f876101be16aca930418068bb26a87f16e87abcda02341a43aa12a8b1837c44c580465b01614d069776f12fb63bd901cff54362f7829d0ea19881d032ff5624a2a6efe366915d7d98de4128d6ae924defbc9ac60708e2991acdc0bc5fd8a5c704ecf295f6bfeb7a93c51e7cff86bb2e018d838cca098b83d3acc1b74ae28d432876e0bf2e3df8773fdc79f4312c2da8472ea2ce2fbe12b92d3d32411b806bdb74428b584c066f2cae5e947d58827e8d093324756c010d5a732a1254fe6790b5e6afa3df946fe1c2aee5b764da69c711684e7e5305a3dddf9bfab2c166eeefaaaa3ac9e97f5d8a731f33b0c5728348d12e975801043e7038babd406c904a6771994738e992240b03669d62cdc734f586f943e8c7e21513ba60adb0ce1fa79a3637b7b7b97134d029b5091aa978023c3ef1a40c8837c8fd492177a014760a68808b42da6565350376d1b7e793899e0b4028aa052265a01a512f2860a2abb7d20db39520ebb97e29ef40d05d1e4cdd399f91e42414b796e0657183101bcf700f9490eac8328dbfd7790f0b506b0218e441908a72d9128cf6b750b5a';
const proof = new Sp1PlonkProof(deserializeProof(hexProof));
const fs = Sp1PlonkFiatShamir.empty();

// SP1 v5: only pi0 (sp1_vkey_hash) and pi1 (committed_values_digest).
// SP1 v6: pi2=exit_code, pi3=vk_root, pi4=proof_nonce from public_inputs[2..4].
const pi0 = FrC.from(
  '0x0018991ef74ec8c8c8bce970facc24099c9b0dbda2efae7e689733cb1100bbf4'
);
const pi1 = FrC.from(
  '0x03031bc77a5129c040c5520c85d9d27e98af209b9777baaeda6cd7ef9263c6ff'
);
const pi2 = FrC.from('0');
const pi3 = FrC.from(
  '248831628400185611740479071450564250193912070693925013182243127282342200944'
);
const pi4 = FrC.from('0');

// ~110K - so we can probably split them into two circuits
// SP1 v5: squeezeGamma(proof, pi0, pi1, VK).
// SP1 v6: pi2/pi3/pi4 added to the hash.
fs.squeezeGamma(proof, pi0, pi1, pi2, pi3, pi4, VK);
fs.squeezeBeta();
fs.squeezeAlpha(proof);
fs.squeezeZeta(proof);

console.log('challenge gamma: ', fs.gamma.toBigInt());
console.log('challenge beta: ', fs.beta.toBigInt());
console.log('challenge alpha: ', fs.alpha.toBigInt());
console.log('challenge zeta: ', fs.zeta.toBigInt());

// very cheap
const [zeta_pow_n, zh_eval] = evalVanishing(fs.zeta, VK);
console.log('zh eval: ', zh_eval.toBigInt());

// very cheap
const alpha_2_l0 = compute_alpha_square_lagrange_0(
  zh_eval,
  fs.zeta,
  fs.alpha,
  VK
);
console.log('alpha_squared_l0', alpha_2_l0.toBigInt());

// ~60k
const [hx, hy] = fold_quotient(
  proof.h0_x,
  proof.h0_y,
  proof.h1_x,
  proof.h1_y,
  proof.h2_x,
  proof.h2_y,
  fs.zeta,
  zeta_pow_n,
  zh_eval
);
console.log('folded quotient x: ', hx.toBigInt());
console.log('folded quotient y: ', hy.toBigInt());
assertPointOnBn(hx.toBigInt(), hy.toBigInt());

// very cheap
// SP1 v5: pi_contribution([pi0, pi1], ...).
// SP1 v6: all 5 public inputs contribute to the polynomial sum.
const pis = pi_contribution(
  [pi0, pi1, pi2, pi3, pi4],
  fs.zeta,
  zh_eval,
  VK.inv_domain_size,
  VK.omega
);
console.log('pis without custom gates: ', pis.toBigInt());

// ~32k
const l_pi_commit = customPiLagrange(
  fs.zeta,
  zh_eval,
  proof.qcp_0_wire_x,
  proof.qcp_0_wire_y,
  VK
);
console.log('l_pi_commit: ', l_pi_commit.toBigInt());

const pi = pis.add(l_pi_commit).assertCanonical();
console.log('pi: ', pi.toBigInt());

// very cheap
const linearised_opening = opening_of_linearized_polynomial(
  proof,
  fs.alpha,
  fs.beta,
  fs.gamma,
  pi,
  alpha_2_l0
);
console.log('linearised_opening: ', linearised_opening.toBigInt());

// ~ 135K - we have to split this into two functions
const [lcm_x, lcm_y] = compute_commitment_linearized_polynomial(
  VK,
  proof,
  fs.alpha,
  fs.beta,
  fs.gamma,
  fs.zeta,
  alpha_2_l0,
  hx,
  hy
);
console.log('lcm x: ', lcm_x.toBigInt());
console.log('lcm y: ', lcm_y.toBigInt());
assertPointOnBn(lcm_x.toBigInt(), lcm_y.toBigInt());

// ~66K - we might need to split this
fs.squeezeGammaKzg(proof, VK, lcm_x, lcm_y, linearised_opening);
console.log('kzg gamma: ', fs.gamma_kzg.toBigInt());

// ~118K - split this also
const [cm_x, cm_y, cm_opening] = fold_state(
  VK,
  proof,
  lcm_x,
  lcm_y,
  linearised_opening,
  fs.gamma_kzg
);
console.log('kzg cm x: ', cm_x.toBigInt());
console.log('kzg cm y: ', cm_y.toBigInt());
console.log('kzg opening: ', cm_opening.toBigInt());

// ~33K
const random = fs.squeezeRandomForKzg(proof, cm_x, cm_y);
console.log('random for kzg: ', random.toBigInt());

// ~100K split this
const [kzg_cm_x, kzg_cm_y, neg_fq_x, neg_fq_y] = preparePairing(
  VK,
  proof,
  random,
  cm_x,
  cm_y,
  cm_opening,
  fs.zeta
);
console.log('kzg_cm_x: ', kzg_cm_x.toBigInt());
console.log('kzg_cm_y: ', kzg_cm_y.toBigInt());
console.log('neg fq x: ', neg_fq_x.toBigInt());
console.log('neg fq y: ', neg_fq_y.toBigInt());

// now e(kzg_cm, [1])*e(neg_fq, [x]) = 1
