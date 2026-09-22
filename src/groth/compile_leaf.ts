import { Cache } from 'o1js';
import { zkp0 } from './recursion/zkp0.js';
import { zkp1 } from './recursion/zkp1.js';
import { zkp2 } from './recursion/zkp2.js';
import { zkp3 } from './recursion/zkp3.js';
import { zkp4 } from './recursion/zkp4.js';
import { zkp5 } from './recursion/zkp5.js';
import { zkp6 } from './recursion/zkp6.js';
import { zkp7 } from './recursion/zkp7.js';
import { zkp8 } from './recursion/zkp8.js';
import { zkp9 } from './recursion/zkp9.js';
import { zkp10 } from './recursion/zkp10.js';
import { zkp11 } from './recursion/zkp11.js';
import { zkp12 } from './recursion/zkp12.js';
import { zkp13 } from './recursion/zkp13.js';
import { createZkp14 } from './recursion/zkp14.js';
import { createZkp15 } from './recursion/zkp15.js';
import { parseGroth16VendorBrand } from './vendor.js';
import { VK } from './vk_from_env.js';

// One leaf, one process: compiles exactly the one zkp0-zkp15 leaf named by
// argv, prints its VerificationKey.hash, exits. GROTH16_VK_PATH must already
// be set in this process's env - zkp0-zkp13's pairing constants and zkp14's
// IC-point accumulation both read it via vk_from_env.js at module load time.
// inputCount comes from that same VK's own IC point count, not a separate
// arg.
const fixedLeaves = [
  zkp0, zkp1, zkp2, zkp3, zkp4, zkp5, zkp6, zkp7,
  zkp8, zkp9, zkp10, zkp11, zkp12, zkp13,
];

const [, , indexArg, vendorArg, cacheDir] = process.argv;
const index = Number(indexArg);
const cache = Cache.FileSystem(cacheDir);
const inputCount = VK.inputCount;

let zkp;
if (index >= 0 && index <= 13) {
  zkp = fixedLeaves[index];
} else if (index === 14) {
  const vendor = parseGroth16VendorBrand(vendorArg);
  zkp = createZkp14(inputCount, vendor).zkp14;
} else if (index === 15) {
  zkp = createZkp15(inputCount).zkp15;
} else {
  console.error(`invalid leaf index '${indexArg}', expected 0-15`);
  process.exit(1);
}

const vk = (await zkp.compile({ cache })).verificationKey;
console.log(vk.hash.toBigInt().toString());
