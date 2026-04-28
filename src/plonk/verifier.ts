import { G1Affine } from '../ec/index.js';
import { Fp12, FrC } from '../towers/index.js';
import { AuXWitness } from './aux_witness.js';
import { make_w27 } from './helpers.js';
import { KZGPairing } from './mm_loop/multi_miller.js';
import { PlonkVerifierPIOP } from './piop/piop.js';
import { Sp1PlonkProof } from './proof.js';
import { Sp1PlonkVk } from './vk.js';

class Sp1PlonkVerifier {
  piopV: PlonkVerifierPIOP;
  kzgP: KZGPairing;

  constructor(VK: Sp1PlonkVk, g2_lines: string, tau_lines: string) {
    let w27 = make_w27();
    this.piopV = new PlonkVerifierPIOP(VK);
    this.kzgP = new KZGPairing(g2_lines, tau_lines, w27);
  }

  // SP1 v5: verify(proof, pi0, pi1, auxWitness).
  // SP1 v6: pi2/pi3/pi4 added to thread through to piop.
  verify(proof: Sp1PlonkProof, pi0: FrC, pi1: FrC, pi2: FrC, pi3: FrC, pi4: FrC, auxWitness: AuXWitness) {
    const [kzg_cm_x, kzg_cm_y, neg_fq_x, neg_fq_y] = this.piopV.piop(
      proof,
      pi0,
      pi1,
      pi2,
      pi3,
      pi4
    );

    const A = new G1Affine({ x: kzg_cm_x, y: kzg_cm_y });
    const negB = new G1Affine({ x: neg_fq_x, y: neg_fq_y });

    this.kzgP.proveEqual(A, negB, auxWitness.shift_power, auxWitness.c);
  }

  // SP1 v5: computeMlo(proof, pi0, pi1).
  // SP1 v6: pi2/pi3/pi4 added to thread through to piop.
  computeMlo(proof: Sp1PlonkProof, pi0: FrC, pi1: FrC, pi2: FrC, pi3: FrC, pi4: FrC): Fp12 {
    const [kzg_cm_x, kzg_cm_y, neg_fq_x, neg_fq_y] = this.piopV.piop(
      proof,
      pi0,
      pi1,
      pi2,
      pi3,
      pi4
    );
    const A = new G1Affine({ x: kzg_cm_x, y: kzg_cm_y });
    const negB = new G1Affine({ x: neg_fq_x, y: neg_fq_y });

    return this.kzgP.multiMillerLoop(A, negB);
  }
}

export { Sp1PlonkVerifier };
