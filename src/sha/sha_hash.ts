import { Bytes, Gadgets, UInt8, Field, UInt32, Provable } from 'o1js';
import { bytesToWord, wordToBytes } from './utils.js';

/*
we have 741 bytes to hash: 

l = 741 * 8 = 5928
l + 1 = 5928
l + 1 % 512 = 297 

k = 448 - 297 = 151

bin_len(l) = ceil(log2(l * 8)) = 13 


so padding should be: 
1 + 0*(k + 64 - 13) + bin(l)  
*/

const padding = [
  UInt8.from(0x80n),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0),
  UInt8.from(0x17n),
  UInt8.from(0x28n),
];

let s = 'a'.repeat(741);

class Bytes741 extends Bytes(741) {}
let preimageBytes = Bytes741.fromString(s);
let hash = Gadgets.SHA2.hash(256, preimageBytes);
console.log(hash.toHex());
//96505839157e4f0984258b89bda90c3661bfce8505d34120f2989236f4c576a2

let preimage: UInt8[] = preimageBytes.bytes.concat(padding);

const chunks: UInt32[] = [];

let H = Gadgets.SHA2.initialState<UInt32>(256);

for (let i = 0; i < preimage.length; i += 4) {
  const chunk = UInt32.Unsafe.fromField(
    bytesToWord(preimage.slice(i, i + 4).reverse())
  );
  chunks.push(chunk);
}

const n = 12;

for (let i = 0; i < n; i++) {
  const messageBlock = chunks.slice(16 * i, 16 * (i + 1));
  let W = Gadgets.SHA2.messageSchedule(256, messageBlock);
  H = Gadgets.SHA2.compression(256, H, W);
}

const digest_bytes = Bytes.from(
  H.map((x) => wordToBytes(x.value, 4).reverse()).flat()
);
console.log(digest_bytes.toHex());
