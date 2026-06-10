import { Field } from 'o1js';
import { ArrayListHasher } from './array_list_hasher.js';
import { ATE_LOOP_COUNT } from './towers/consts.js';

const N = ATE_LOOP_COUNT.length;

describe('regression_0dd9c_array_list_hasher_length_validation', () => {

  test('hash with fewer than n elements must throw', () => {
    const short = new Array(N - 1).fill(Field(0n));
    expect(() => ArrayListHasher.hash(short)).toThrow();
  });

  test('hash with more than n elements must throw', () => {
    const long = new Array(N + 1).fill(Field(0n));
    expect(() => ArrayListHasher.hash(long)).toThrow();
  });

  test('hash with exactly n elements must not throw', () => {
    const exact = new Array(N).fill(Field(0n));
    expect(() => ArrayListHasher.hash(exact)).not.toThrow();
  });
});
