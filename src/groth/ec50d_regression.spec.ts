import { rmSync } from 'fs';
import { Cache, Poseidon } from 'o1js';
import { parseProof } from './proof.js';
import { AuXWitness } from '../aux_witness.js';
import { WitnessTracker } from './witness_tracker.js';
import { Accumulator } from './recursion/data.js';
import { G1Affine } from '../ec/index.js';
import { G2Affine } from '../ec/g2.js';
import { FpC, Fp2 } from '../towers/index.js';
import { zkp0 } from './recursion/zkp0.js';
import { zkp6 } from './recursion/zkp6.js';
import { GrothVk } from './vk.js';

const BN254_P =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

type Fp2Tuple = [bigint, bigint];

const fp_pow = (base: bigint, exp: bigint): bigint => {
  let result = 1n;
  base = ((base % BN254_P) + BN254_P) % BN254_P;
  while (exp > 0n) {
    if (exp & 1n) result = result * base % BN254_P;
    exp >>= 1n;
    base = base * base % BN254_P;
  }
  return result;
};
const fp_inv = (a: bigint) => fp_pow(a, BN254_P - 2n);

const fp2_mul = (a: Fp2Tuple, b: Fp2Tuple): Fp2Tuple => [
  ((a[0]*b[0] % BN254_P) - (a[1]*b[1] % BN254_P) + BN254_P) % BN254_P,
  ((a[0]*b[1] % BN254_P) + (a[1]*b[0] % BN254_P)) % BN254_P,
];
const fp2_add = (a: Fp2Tuple, b: Fp2Tuple): Fp2Tuple => [
  (a[0]+b[0]) % BN254_P, (a[1]+b[1]) % BN254_P,
];
const fp2_sq = (a: Fp2Tuple) => fp2_mul(a, a);
const fp2_inv = (a: Fp2Tuple): Fp2Tuple => {
  const norm = (a[0]*a[0] % BN254_P + a[1]*a[1] % BN254_P) % BN254_P;
  const inv_n = fp_inv(norm);
  return [(a[0]*inv_n) % BN254_P, ((BN254_P - a[1])*inv_n) % BN254_P];
};

const fp_sqrt = (n: bigint): bigint | null => {
  n = ((n % BN254_P) + BN254_P) % BN254_P;
  if (n === 0n) return 0n;
  if (fp_pow(n, (BN254_P - 1n) / 2n) !== 1n) return null;
  let q = BN254_P - 1n, s = 0n;
  while (q % 2n === 0n) { q /= 2n; s++; }
  let z = 2n;
  while (fp_pow(z, (BN254_P - 1n) / 2n) !== BN254_P - 1n) z++;
  let m = s, c = fp_pow(z, q), t = fp_pow(n, q), r = fp_pow(n, (q + 1n) / 2n);
  while (true) {
    if (t === 1n) return r;
    let i = 1n, tmp = t * t % BN254_P;
    while (tmp !== 1n) { tmp = tmp * tmp % BN254_P; i++; }
    let b = c;
    for (let j = 0n; j < m - i - 1n; j++) b = b * b % BN254_P;
    m = i; c = b * b % BN254_P; t = t * c % BN254_P; r = r * b % BN254_P;
  }
};

const fp2_sqrt = (a: Fp2Tuple): Fp2Tuple | null => {
  if (a[1] === 0n) {
    const s = fp_sqrt(a[0]);
    if (s !== null) return [s, 0n];
    const s2 = fp_sqrt((BN254_P - a[0]) % BN254_P);
    if (s2 !== null) return [0n, s2];
    return null;
  }
  const norm = (a[0]*a[0] % BN254_P + a[1]*a[1] % BN254_P) % BN254_P;
  const ns = fp_sqrt(norm);
  if (ns === null) return null;
  let alpha = (a[0] + ns) % BN254_P;
  alpha = alpha * fp_inv(2n) % BN254_P;
  let delta = fp_sqrt(alpha);
  if (delta === null) {
    alpha = ((a[0] - ns) % BN254_P + BN254_P) % BN254_P;
    alpha = alpha * fp_inv(2n) % BN254_P;
    delta = fp_sqrt(alpha);
    if (delta === null) return null;
  }
  const c1 = a[1] * fp_inv(2n * delta % BN254_P) % BN254_P;
  const y: Fp2Tuple = [delta, c1];
  const y2 = fp2_sq(y);
  if (y2[0] === a[0] && y2[1] === a[1]) return y;
  return null;
};

function findTwistPointNotInSubgroup(): G2Affine {
  const b_tw = fp2_mul([3n, 0n], fp2_inv([9n, 1n]));
  for (let i = 1n; i < 100n; i++) {
    const x: Fp2Tuple = [i, i + 1n];
    const rhs = fp2_add(fp2_mul(fp2_sq(x), x), b_tw);
    const y = fp2_sqrt(rhs);
    if (y) {
      return new G2Affine({
        x: new Fp2({ c0: FpC.from(x[0]), c1: FpC.from(x[1]) }),
        y: new Fp2({ c0: FpC.from(y[0]), c1: FpC.from(y[1]) }),
      });
    }
  }
  throw new Error('failed to find twist point');
}

const VK_PATH = './src/groth/example_jsons/vk.json';
const PROOF_PATH = './src/groth/example_jsons/proof.json';
const AUX_PATH = './src/groth/example_jsons/aux_witness.json';
const CACHE_DIR = './cache_ec50d_groth';

process.env.GROTH16_VK_PATH = VK_PATH;

const vk = GrothVk.parse(VK_PATH);

describe('regression_ec50d_groth16_oncurve', () => {
  beforeAll(async () => {
    await zkp0.compile({ cache: Cache.FileSystem(CACHE_DIR) });
  }, 600_000);

  afterAll(() => {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  test('zkp0 must reject off-curve negA (G1 on-curve check)', async () => {
    const proof = parseProof(vk, PROOF_PATH);
    const auxWitness = AuXWitness.loadFromPath(AUX_PATH);

    const origY = proof.negA.y.toBigInt();
    const tamperedY = (origY + 1n) % BN254_P;
    const lhs = (tamperedY * tamperedY) % BN254_P;
    const x = proof.negA.x.toBigInt();
    const rhs = (((x * x) % BN254_P) * x + 3n) % BN254_P;
    expect(lhs).not.toBe(rhs);

    const tamperedProof = {
      ...proof,
      negA: new G1Affine({ x: proof.negA.x, y: FpC.from(tamperedY) }),
    };

    const wt = new WitnessTracker(tamperedProof, auxWitness);
    const [acc_0, lines_0, all_b_lines] = wt.in0();
    const cin0 = Poseidon.hashPacked(Accumulator, acc_0);

    await expect(
      zkp0.compute(cin0, acc_0, lines_0, all_b_lines)
    ).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve C (G1 on-curve check)', async () => {
    const proof = parseProof(vk, PROOF_PATH);
    const auxWitness = AuXWitness.loadFromPath(AUX_PATH);

    const origY = proof.C.y.toBigInt();
    const tamperedY = (origY + 1n) % BN254_P;
    const lhs = (tamperedY * tamperedY) % BN254_P;
    const x = proof.C.x.toBigInt();
    const rhs = (((x * x) % BN254_P) * x + 3n) % BN254_P;
    expect(lhs).not.toBe(rhs);

    const tamperedProof = {
      ...proof,
      C: new G1Affine({ x: proof.C.x, y: FpC.from(tamperedY) }),
    };

    const wt = new WitnessTracker(tamperedProof, auxWitness);
    const [acc_0, lines_0, all_b_lines] = wt.in0();
    const cin0 = Poseidon.hashPacked(Accumulator, acc_0);

    await expect(
      zkp0.compute(cin0, acc_0, lines_0, all_b_lines)
    ).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve PI (G1 on-curve check)', async () => {
    const proof = parseProof(vk, PROOF_PATH);
    const auxWitness = AuXWitness.loadFromPath(AUX_PATH);

    const origY = proof.PI.y.toBigInt();
    const tamperedY = (origY + 1n) % BN254_P;
    const lhs = (tamperedY * tamperedY) % BN254_P;
    const x = proof.PI.x.toBigInt();
    const rhs = (((x * x) % BN254_P) * x + 3n) % BN254_P;
    expect(lhs).not.toBe(rhs);

    const tamperedProof = {
      ...proof,
      PI: new G1Affine({ x: proof.PI.x, y: FpC.from(tamperedY) }),
    };

    const wt = new WitnessTracker(tamperedProof, auxWitness);
    const [acc_0, lines_0, all_b_lines] = wt.in0();
    const cin0 = Poseidon.hashPacked(Accumulator, acc_0);

    await expect(
      zkp0.compute(cin0, acc_0, lines_0, all_b_lines)
    ).rejects.toThrow();
  }, 600_000);
});

describe('regression_ec50d_groth16_g2_oncurve', () => {
  beforeAll(async () => {
    await zkp6.compile({ cache: Cache.FileSystem(CACHE_DIR) });
  }, 600_000);

  afterAll(() => {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  // Tests the G2 on-curve check only (y^2 = x^3 + b_twist).
  // Does NOT exercise the subgroup check: the on-curve check rejects before it.
  test('zkp6 must reject off-curve B (G2 on-curve check)', async () => {
    const proof = parseProof(vk, PROOF_PATH);
    const auxWitness = AuXWitness.loadFromPath(AUX_PATH);

    const origC0 = proof.B.y.c0.toBigInt();
    const tamperedC0 = (origC0 + 1n) % BN254_P;

    const tamperedProof = {
      ...proof,
      B: new G2Affine({
        x: proof.B.x,
        y: new Fp2({ c0: FpC.from(tamperedC0), c1: proof.B.y.c1 }),
      }),
    };

    const wt = new WitnessTracker(tamperedProof, auxWitness);
    wt.in0();
    wt.zkp0();
    wt.zkp1();
    wt.zkp2();
    wt.zkp3();
    wt.zkp4();
    const [acc_6, lines_6] = wt.zkp5();
    const all_b_lines = wt.b_lines;
    const cin6 = Poseidon.hashPacked(Accumulator, acc_6);

    await expect(
      zkp6.compute(cin6, acc_6, lines_6, all_b_lines)
    ).rejects.toThrow();
  }, 600_000);

  // Fails on missing subgroup check (bad B accepted) and on broken check (valid B rejected).
  test('zkp6 subgroup check must reject bad B and accept valid B', async () => {
    const proof = parseProof(vk, PROOF_PATH);
    const auxWitness = AuXWitness.loadFromPath(AUX_PATH);

    // Part 1: bad B (on twist curve, not in G2[r]) must be rejected
    const badB = findTwistPointNotInSubgroup();
    const badProof = { ...proof, B: badB };
    const wtBad = new WitnessTracker(badProof, auxWitness);
    wtBad.in0();
    wtBad.zkp0();
    wtBad.zkp1();
    wtBad.zkp2();
    wtBad.zkp3();
    wtBad.zkp4();
    const [acc_bad, lines_bad] = wtBad.zkp5();
    const bad_b_lines = wtBad.b_lines;
    const cin_bad = Poseidon.hashPacked(Accumulator, acc_bad);

    await expect(
      zkp6.compute(cin_bad, acc_bad, lines_bad, bad_b_lines)
    ).rejects.toThrow();

    // Part 2: valid B (on-curve and in G2[r]) must be accepted
    const wtGood = new WitnessTracker(proof, auxWitness);
    wtGood.in0();
    wtGood.zkp0();
    wtGood.zkp1();
    wtGood.zkp2();
    wtGood.zkp3();
    wtGood.zkp4();
    const [acc_good, lines_good] = wtGood.zkp5();
    const good_b_lines = wtGood.b_lines;
    const cin_good = Poseidon.hashPacked(Accumulator, acc_good);

    const result = await zkp6.compute(cin_good, acc_good, lines_good, good_b_lines);
    expect(result.proof).toBeDefined();
  }, 600_000);
});
