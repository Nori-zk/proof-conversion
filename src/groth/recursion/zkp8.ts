import { ZkProgram, Field, Poseidon, Provable } from 'o1js';

import { Accumulator } from './data.js';
import { Fp12 } from '../../towers/fp12.js';
import { ATE_LOOP_COUNT } from '../../towers/consts.js';
import { ArrayListHasher } from '../../array_list_hasher.js';

const zkp8 = ZkProgram({
  name: 'zkp8',
  publicInput: Field,
  publicOutput: Field,
  methods: {
    compute: {
      privateInputs: [
        Accumulator,
        Provable.Array(Field, 9),
        Provable.Array(Fp12, 11),
        Provable.Array(Field, ATE_LOOP_COUNT.length - 9 - 11),
      ],
      async method(
        input: Field,
        acc: Accumulator,
        lhs_line_hashes: Array<Field>,
        g_chunk: Array<Fp12>,
        rhs_lines_hashes: Array<Field>
      ) {
        input.assertEquals(Poseidon.hashPacked(Accumulator, acc));

        const opening = ArrayListHasher.open(
          lhs_line_hashes,
          g_chunk,
          rhs_lines_hashes
        );
        acc.state.g_digest.assertEquals(opening);

        let f = acc.state.f;

        let idx = 0;
        for (let i = 10; i < 21; i++) {
          f = f.square().mul(g_chunk[idx]);

          if (ATE_LOOP_COUNT[i] == 1) {
            f = f.mul(acc.proof.c_inv);
          }

          if (ATE_LOOP_COUNT[i] == -1) {
            f = f.mul(acc.proof.c);
          }

          idx += 1;
        }

        acc.state.f = f;

        return { publicOutput: Poseidon.hashPacked(Accumulator, acc) };
      },
    },
  },
});

const ZKP8Proof = ZkProgram.Proof(zkp8);
export { ZKP8Proof, zkp8 };
