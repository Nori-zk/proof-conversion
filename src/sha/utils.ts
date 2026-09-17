import { Bool, Field, UInt8, Provable } from 'o1js';
import { FpC, FrC } from '../towers/index.js';

const provableBn254BaseFieldToBytes = (x: FpC) => {
  // append 2 zero bits to make it a multiple of 8 (256 bits)
  let bits = [Bool(false), Bool(false)];
  bits = x.toBits().concat(bits);

  const chunks: UInt8[] = [];

  for (let i = 0; i < bits.length; i += 8) {
    let chunk = Field.fromBits(bits.slice(i, i + 8));
    chunks.push(UInt8.Unsafe.fromField(chunk));
  }

  return chunks.reverse();
};

const provableBn254ScalarFieldToBytes = (x: FrC) => {
  // append 2 zero bits to make it a multiple of 8 (256 bits)
  let bits = [Bool(false), Bool(false)];
  bits = x.toBits().concat(bits);

  const chunks: UInt8[] = [];

  for (let i = 0; i < bits.length; i += 8) {
    let chunk = Field.fromBits(bits.slice(i, i + 8));
    chunks.push(UInt8.Unsafe.fromField(chunk));
  }

  return chunks.reverse();
};

function bytesToWord(wordBytes: UInt8[]): Field {
  return wordBytes.reduce((acc, byte, idx) => {
    const shift = 1n << BigInt(8 * idx);
    return acc.add(byte.value.mul(shift));
  }, Field.from(0));
}

function wordToBytes(word: Field, bytesPerWord = 8): UInt8[] {
  // Finding 1f602 - if bytesPerWord is large enough that 
  // 2^(8 * bytesPerWord) > p multiple distinct UInt8[]
  // values reconstruct to the same word modulo p
  // Block at circuit compile time
  if (1n << BigInt(8 * bytesPerWord) > Field.ORDER) {
    throw new Error(
      `wordToBytes: bytesPerWord=${bytesPerWord} exceeds the field capacity`
    );
  }

  let bytes = Provable.witness(Provable.Array(UInt8, bytesPerWord), () => {
    let w = word.toBigInt();
    return Array.from({ length: bytesPerWord }, (_, k) =>
      UInt8.from((w >> BigInt(8 * k)) & 0xffn)
    );
  });

  // check decomposition
  bytesToWord(bytes).assertEquals(word);

  return bytes;
}

// Field prime p (Pallas base field), little-endian bytes. p fits in 32 bytes,
// so any candidate byte array longer than 32 bytes is canonical only if every
// byte above index 31 is zero.
const FIELD_PRIME_LE: bigint[] = [
  1n, 0n, 0n, 0n, 237n, 48n, 45n, 153n, 27n, 249n, 76n, 9n, 252n, 152n, 70n,
  34n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 0n, 64n,
];

// Asserts that `bytes`, read little-endian, is strictly less than the field
// prime p. Scans most-significant byte to least-significant; `strictlyLess`
// latches the first byte-wise difference from p and is never overwritten
// after that, `different` latches true the moment any byte diverges from p.
function isCanonicalFieldBytesLE(bytes: UInt8[]): Bool {
  let strictlyLess = Bool(false);
  let different = Bool(false);

  for (let i = bytes.length - 1; i >= 0; i--) {
    // UInt8.lessThan uses an 8-bit-bounded comparison gadget (single
    // rangeCheck8) instead of Field.lessThan's generic full-field
    // comparison gadget, which is far more expensive since it doesn't
    // know either operand is byte-sized.
    const pByte = UInt8.from(i < 32 ? FIELD_PRIME_LE[i] : 0n);
    const byte = bytes[i];

    const isLess = byte.lessThan(pByte);
    const isDifferent = byte.value.equals(pByte.value).not();

    strictlyLess = Provable.if(different, strictlyLess, isLess);
    different = different.or(isDifferent);
  }

  return strictlyLess;
}

// wordToBytesCanonical - safe sibling of wordToBytes for bytesPerWord > 31
// (Finding 1f602). At bytesPerWord <= 31 the reconstruction constraint alone
// already pins the byte array down uniquely (2^(8*bytesPerWord) <= p), so
// this delegates straight to wordToBytes. Above that, the reconstruction
// equality is only mod p, so `bytes` could witness `word + k*p` for some
// k >= 1 instead of `word` itself; this adds the missing range constraint,
// asserting `bytes` is the canonical representative in [0, p), which rules
// out every such alternate witness regardless of k.
function wordToBytesCanonical(word: Field, bytesPerWord = 8): UInt8[] {
  if (1n << BigInt(8 * bytesPerWord) <= Field.ORDER) {
    return wordToBytes(word, bytesPerWord);
  }

  let bytes = Provable.witness(Provable.Array(UInt8, bytesPerWord), () => {
    let w = word.toBigInt();
    return Array.from({ length: bytesPerWord }, (_, k) =>
      UInt8.from((w >> BigInt(8 * k)) & 0xffn)
    );
  });

  bytesToWord(bytes).assertEquals(word);

  isCanonicalFieldBytesLE(bytes).assertTrue(
    'wordToBytesCanonical: witnessed bytes are not the canonical representation of word'
  );

  return bytes;
}

export {
  provableBn254BaseFieldToBytes,
  provableBn254ScalarFieldToBytes,
  wordToBytes,
  wordToBytesCanonical,
  bytesToWord,
  isCanonicalFieldBytesLE,
  FIELD_PRIME_LE,
};
