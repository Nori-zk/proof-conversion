import { Fr, FrC, powFr } from "../../towers/fr.js"
import { compute_alpha_square_lagrange_0, compute_commitment_linearized_polynomial, customPiLagrange, evalVanishing, fold_quotient, fold_state, opening_of_linearized_polynomial, pi_contribution, preparePairing } from "./plonk_utils.js"
import { Sp1PlonkFiatShamir } from "../fiat-shamir/index.js";
import { Sp1PlonkProof, deserializeProof } from "../proof.js"
import { VK } from "../vk.js";
import { assertPointOnBn } from "../utils.js";
import { HashFr } from "./hash_fr.js";
import {parsePublicInputs} from '../parse_pi.js'
import { getMlo } from "../get_mlo.js";
const PROGRAM_VKEY ="0x00467584e2e560847e9e96b5102c082f5e07155429c6622988799df9d95dbb47"
// bytes internal constant PUBLIC_VALUES =
// hex"
const inputValues = "0x00000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000001a6d0000000000000000000000000000000000000000000000000000000000002ac2";


const hexProof = "0x54bdcae32122ba5d63ecb7d08cf7e217531928202417f27aa006e67ab53721eb386323bd1548e7a98de06f907d6067c9069866a6e8ca4a81a8553566abee9c2903efec8d0d3a52e9e717313d6fb5076bf3865cd8705a40b2613563b1d10f13adbeced54b179c997b00339169940341b4bb6ea21cd43992779b03e9a17fe6925f6273774e1b37fe45304344f3c66efee0b283cc6f8bb5d50e1f711d869080191284b5b93d10eafd8c57fab7d77ff15918e5e7fd93ed7ae6edc8629464aee148934e719c761e932ac3e956d05c70f9f2d2145c0b72f5e96127311b0b5ff805683091ec1f391beaffe65cf81e0613902331c700fcb0659c0c57e2f5d48d7e4eec04309060221f29322fc530473f367d34f38b47747afd4397acf8f75219ed6d393a468822b5152de3687df40b6ffebe49fbf0ceda8b54042283e454586875bb602b26a1175e165bdd7b6f29206896396e864904bb3cf5d375c84f311e5c557918dedccf27c30f43b11922ac6c9c0901634269de7d8ec9543ff834167149db30cd87b5c00c8d28cabf65079b6be84e5d013f514775e16d078215751f30547561ded0d2af784c0cbefb1fbd6149c09ed6eb0844265b1b0d038acd6b389cba9b3d6335e31567c706acf8cb896be0b70ce13eeb65990e69e29a48b85de56e2cda40d154034633f321f266a6af27e1adebe64e89a451bbeabb5fc0d9cf22c66c76710f599f39434b12f8ce865dda948710bed1755df69588eb5b0c21fb0f929b1bff7b7358c4cb1c271a65be960be28f2af49f3be51ddd6a4e552a3c1bb57204cd020d1057ae15602a43eb67628c5697ef5b181ded7e76a1f26997bca92ba31ef7337b63326a31cb1a13ec5b1d81605d83dbbf17f9699ebe3f2a2afa211dd09cf5de084d29ab28c212d9017f24ce6697e36d8c84b82970e1dedf5c74a821b73fce661c2a0bf1408f2c557c0e8962ad59cca1931cb276d3566e6f4a9411102cbf486c83aced09563d22a891e9abd3b6cee11963269c1f32f6131e97852584736ca8dbf7c6f9e34f660f79c2b9cd21515608ccc90af5e5689df83f623c08bc49284d93d4cfbf4ca60c2e2d8c1cb71195ac41b0788267d5af7092b421963519a1bb2e23774e7648344b19334175fa8031c8562bfb5209242b0a35282cbc7d05f96f4bf24318b6c37f0727f359fd9cf136abc923abbffc906a32cfb0e6d16ce61cc2d20748c2460f6844"
const proof = new Sp1PlonkProof(deserializeProof(hexProof))
const fs = Sp1PlonkFiatShamir.empty()
const [pi0, pi1] = parsePublicInputs(PROGRAM_VKEY, inputValues)
// Decoder for this is currently in solidity repo!
// const programVk = "0x0097228875a04c12dda0a76b705856f1a99fd19613c0ba69b056f4c4d18921e5";
// const publicInputBytes =
//   "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000000000000000000000000000000000000006b850f8a2400913e58dbf3791e084b944e3859a8f3fd45a6212c1ce0fdb345936dd29000000000000000000000000000000000000000000000000000000000000008a9391e49308c85b6c50f3dbceb31e4d1d0719337a2ea4c724e9a7eba73f35432a000000000000000000000000000000000000000000000000000000000006b97c4211fff419575c75d2e880ca014c64276bccc917f0e9ea26c7a923ac78e83f32c3faaef208b30c5b2a1bec70f8b22f14099876952f7c6c1e904adae5642856e69124c226260e0798d54fda8fbae89cf0da84b1894912675c9f0552628caf3ae700000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";

// const pi0 = FrC.from("0x0097228875a04c12dda0a76b705856f1a99fd19613c0ba69b056f4c4d18921e5")
// const pi1 = FrC.from("0x048e48f4b209e2dc6d92839ecba0e9321e83ea61ecb6430fc737b1e94c3fabbb")

console.log("pi0: ", pi0.toBigInt())
console.log("pi1: ", pi1.toBigInt())
// ~110K - so we can probably split them into two circuits
fs.squeezeGamma(proof, pi0, pi1, VK)
fs.squeezeBeta()
fs.squeezeAlpha(proof)
fs.squeezeZeta(proof)

console.log("challenge gamma: ", fs.gamma.toBigInt())
console.log("challenge beta: ", fs.beta.toBigInt())
console.log("challenge alpha: ", fs.alpha.toBigInt())
console.log("challenge zeta: ", fs.zeta.toBigInt())

// very cheap
const [zeta_pow_n, zh_eval] = evalVanishing(fs.zeta, VK)
console.log("zeta_pow_n",zeta_pow_n.toBigInt() )
console.log("zh eval: ", zh_eval.toBigInt())

// very cheap
const alpha_2_l0 = compute_alpha_square_lagrange_0(zh_eval, fs.zeta, fs.alpha, VK); 
console.log("alpha_squared_l0", alpha_2_l0.toBigInt())

// ~60k
const [hx, hy] = fold_quotient(proof.h0_x, proof.h0_y, proof.h1_x, proof.h1_y, proof.h2_x, proof.h2_y, fs.zeta, zeta_pow_n, zh_eval)
console.log("folded quotient x: ", hx.toBigInt())
console.log("folded quotient y: ", hy.toBigInt())
assertPointOnBn(hx.toBigInt(), hy.toBigInt())

// very cheap
const pis = pi_contribution([pi0, pi1], fs.zeta, zh_eval, VK.inv_domain_size, VK.omega)
console.log(fs.zeta.toBigInt(),"fs.zeta")
console.log(zh_eval.toBigInt(),"zh_eval") 
console.log(VK.inv_domain_size.toBigInt(),"VK.inv_domain_size") 
console.log(VK.omega.toBigInt(),"VK.omega")
console.log("pis without custom gates: ", pis.toBigInt())

// ~32k
const l_pi_commit = customPiLagrange(fs.zeta, zh_eval, proof.qcp_0_wire_x, proof.qcp_0_wire_y, VK)
console.log("l_pi_commit: ", l_pi_commit.toBigInt())

const pi = pis.add(l_pi_commit).assertCanonical(); 
console.log("pi: ", pi.toBigInt())

// very cheap
const linearised_opening = opening_of_linearized_polynomial(proof, fs.alpha, fs.beta, fs.gamma, pi, alpha_2_l0);
console.log("linearised_opening: ", linearised_opening.toBigInt())

// ~ 135K - we have to split this into two functions
const [lcm_x, lcm_y] = compute_commitment_linearized_polynomial(VK, proof, fs.alpha, fs.beta, fs.gamma, fs.zeta, alpha_2_l0, hx, hy)
console.log("lcm x: ", lcm_x.toBigInt())
console.log("lcm y: ", lcm_y.toBigInt())
assertPointOnBn(lcm_x.toBigInt(), lcm_y.toBigInt());

// ~66K - we might need to split this
fs.squeezeGammaKzg(proof, VK, lcm_x, lcm_y, linearised_opening)
console.log("kzg gamma: ", fs.gamma_kzg.toBigInt())


// ~118K - split this also
const [cm_x, cm_y, cm_opening] = fold_state(VK, proof, lcm_x, lcm_y, linearised_opening, fs.gamma_kzg);
console.log("kzg cm x: ", cm_x.toBigInt())
console.log("kzg cm y: ", cm_y.toBigInt())
console.log("kzg opening: ", cm_opening.toBigInt())


// ~33K
const random = fs.squeezeRandomForKzg(proof, cm_x, cm_y)
console.log("random for kzg: ", random.toBigInt())

// ~100K split this
const [kzg_cm_x, kzg_cm_y, neg_fq_x, neg_fq_y] = preparePairing(VK, proof, random, cm_x, cm_y, cm_opening, fs.zeta)
console.log("kzg_cm_x: ", kzg_cm_x.toBigInt())
console.log("kzg_cm_y: ", kzg_cm_y.toBigInt())
console.log("neg fq x: ", neg_fq_x.toBigInt())
console.log("neg fq y: ", neg_fq_y.toBigInt())

// now e(kzg_cm, [1])*e(neg_fq, [x]) = 1

// try {
//   getMlo(hexProof, PROGRAM_VKEY, inputValues)
// } catch (e) {
//   console.error(e)
// }