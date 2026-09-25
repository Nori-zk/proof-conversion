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
import { zkp14 } from './recursion/zkp14.js';
import { zkp15 } from './recursion/zkp15.js';
import { zkp16 } from './recursion/zkp16.js';
import { zkp17 } from './recursion/zkp17.js';
import { zkp18 } from './recursion/zkp18.js';
import { zkp19 } from './recursion/zkp19.js';
import { zkp20 } from './recursion/zkp20.js';
import { zkp21 } from './recursion/zkp21.js';
import { zkp22 } from './recursion/zkp22.js';
import { zkp23 } from './recursion/zkp23.js';

// One leaf, one process: compiles exactly the one zkp0-zkp23 leaf named by
// argv, prints its VerificationKey.hash, exits. Unlike Groth16's leaves,
// none of these take a vendor or inputCount - PLONK's tree shape is fixed.
const leaves = [
  zkp0, zkp1, zkp2, zkp3, zkp4, zkp5, zkp6, zkp7,
  zkp8, zkp9, zkp10, zkp11, zkp12, zkp13, zkp14, zkp15,
  zkp16, zkp17, zkp18, zkp19, zkp20, zkp21, zkp22, zkp23,
];

const [, , indexArg, cacheDir] = process.argv;
const index = Number(indexArg);

const zkp = leaves[index];
if (zkp === undefined) {
  console.error(`invalid leaf index '${indexArg}', expected 0-23`);
  process.exit(1);
}

const cache = Cache.FileSystem(cacheDir);
const vk = (await zkp.compile({ cache })).verificationKey;
console.log(vk.hash.toBigInt().toString());
