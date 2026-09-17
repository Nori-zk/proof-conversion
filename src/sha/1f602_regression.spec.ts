import { Field, UInt8 } from 'o1js';
import {
  bytesToWord,
  wordToBytes,
  wordToBytesCanonical,
  isCanonicalFieldBytesLE,
  FIELD_PRIME_LE,
} from './utils.js';

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

function bigintToBytesLE(x: bigint, len: number): UInt8[] {
  return Array.from({ length: len }, (_, k) => UInt8.from((x >> BigInt(8 * k)) & 0xffn));
}

describe('regression_1f602_wordToBytesCanonical', () => {
  test('at the safe bound (31 bytes), delegates to wordToBytes and round-trips', () => {
    const word = Field(123456789n);
    const bytes = wordToBytesCanonical(word, 31);
    expect(bytesToWord(bytes).toBigInt()).toBe(word.toBigInt());
  });

  test('one past the safe bound (32 bytes), a genuine witness does not throw and round-trips', () => {
    const word = Field(123456789n);
    const bytes = wordToBytesCanonical(word, 32);
    expect(bytesToWord(bytes).toBigInt()).toBe(word.toBigInt());
  });

  test('isCanonicalFieldBytesLE accepts p-1, the largest canonical value', () => {
    const bytes = bigintToBytesLE(Field.ORDER - 1n, 32);
    expect(() => isCanonicalFieldBytesLE(bytes).assertTrue()).not.toThrow();
  });

  test('isCanonicalFieldBytesLE accepts 0', () => {
    const bytes = bigintToBytesLE(0n, 32);
    expect(() => isCanonicalFieldBytesLE(bytes).assertTrue()).not.toThrow();
  });

  test('isCanonicalFieldBytesLE rejects p itself, even though it reduces to 0 mod p', () => {
    const pBytes = bigintToBytesLE(Field.ORDER, 32);

    // this is exactly the hole finding 1f602 describes: the mod-p
    // reconstruction equality alone cannot distinguish word=0 from the
    // non-canonical witness bytes=p, since p === 0 (mod p).
    expect(bytesToWord(pBytes).toBigInt()).toBe(0n);

    // isCanonicalFieldBytesLE is the fix: it must still reject bytes=p as
    // a non-canonical representation of 0.
    expect(() => isCanonicalFieldBytesLE(pBytes).assertTrue()).toThrow();
  });

  test('isCanonicalFieldBytesLE rejects p+1, even though it reduces to 1 mod p', () => {
    const pPlusOneBytes = bigintToBytesLE(Field.ORDER + 1n, 32);

    expect(bytesToWord(pPlusOneBytes).toBigInt()).toBe(1n);
    expect(() => isCanonicalFieldBytesLE(pPlusOneBytes).assertTrue()).toThrow();
  });

  test('FIELD_PRIME_LE matches Field.ORDER', () => {
    const pFromConst = FIELD_PRIME_LE.reduce(
      (acc, b, i) => acc + (b << BigInt(8 * i)),
      0n
    );
    expect(pFromConst).toBe(Field.ORDER);
  });
});
