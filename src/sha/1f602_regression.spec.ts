import { Field } from 'o1js';
import { bytesToWord, wordToBytes } from './utils.js';

describe('regression_1f602_wordToBytes_canonicity_bound', () => {
  let maxSafeBytesPerWord: number;

  beforeAll(() => {
    // Largest bytesPerWord for which 2^(8*bytesPerWord) <= Field.ORDER, i.e.
    // the last width where the byte range cannot wrap around the field
    // modulus.
    maxSafeBytesPerWord = 0;
    while ((1n << BigInt(8 * (maxSafeBytesPerWord + 1))) <= Field.ORDER) {
      maxSafeBytesPerWord++;
    }
  });

  test('bytesPerWord at the safe bound (2^(8n) <= Field.ORDER) must not throw', () => {
    expect(() => wordToBytes(Field(0n), maxSafeBytesPerWord)).not.toThrow();
  });

  test('bytesPerWord one past the safe bound (2^(8n) > Field.ORDER) must throw', () => {
    expect(() =>
      wordToBytes(Field(0n), maxSafeBytesPerWord + 1)
    ).toThrow();
  });

  test('at the safe bound, wordToBytes round-trips to the original word', () => {
    const word = Field(123456789n);
    const bytes = wordToBytes(word, maxSafeBytesPerWord);
    expect(bytesToWord(bytes).toBigInt()).toBe(word.toBigInt());
  });

  test('default bytesPerWord=8 must not throw', () => {
    expect(() => wordToBytes(Field(42n))).not.toThrow();
  });
});
