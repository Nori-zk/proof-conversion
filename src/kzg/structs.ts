import { Field, Struct } from 'o1js';
import { Fp12, FrC } from '../towers/index.js';
import { G1Affine } from '../ec/index.js';
import { ArrayListHasher } from '../array_list_hasher.js';

// e(A, [1])*e(negB, [x]) = 1
class KzgProof extends Struct({
  A: G1Affine,
  negB: G1Affine,
  shift_power: Field,
  c: Fp12,
  c_inv: Fp12,
  pi0: FrC.provable,
  pi1: FrC.provable,
}) {}

class KzgState extends Struct({
  f: Fp12,
  lines_hashes_digest: Field,
}) {
  deepClone() {
    return new KzgState({
      f: new Fp12({ c0: this.f.c0, c1: this.f.c1 }),
      lines_hashes_digest: Field.from(this.lines_hashes_digest.toBigInt()),
    });
  }
}

class KzgAccumulator extends Struct({
  proof: KzgProof,
  state: KzgState,
}) {
  deepClone() {
    return new KzgAccumulator({
      proof: this.proof,
      state: this.state.deepClone(),
    });
  }
}

export { KzgProof, KzgState, KzgAccumulator, ArrayListHasher };
