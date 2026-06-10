import { rmSync } from 'fs';
import { Cache, Poseidon } from 'o1js';
import { Sp1PlonkProof, deserializeProof } from './proof.js';
import { Sp1PlonkFiatShamir } from './fiat-shamir/index.js';
import { StateUntilPairing, empty } from './state.js';
import { Accumulator } from './accumulator.js';
import { parsePublicInputs } from './parse_pi.js';
import { FpC, FrC } from '../towers/index.js';
import { zkp0 } from './recursion/zkp0.js';

const BN254_P =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

const CACHE_DIR = './cache_ec50d_plonk';

const hexProof =
  '0x2fa6371b5f35e61b6ee787a62f9b9d2ab098c01a69c567936a516b6a30d724090f3acd44d559006b3c80ae52ef31bdfb0d44d203f078b803a5817e3155b75c172ce81bfce68297ffbbfd99b14103062a8e9961545e519d165659c9b7f55dfee31c22c3ffc0357f6a444ebf34f863500658708146821f7311b96561684f0c5427051f886e102d3dd013716b9135c9930cb2d586fb11174ef830e48ca1921308241bc56c5cc5299e3ac08cd6da72a38335ac862278fe8e9ebfe8993d08f3dbab0014f70705f8afecc117a14a985f352399d77b30749216cc3ac96cf8b8aaa1183209bb06da94df7869b93bec52c74a895e46146a4038ec90d877181bf5045c5e550e81bbfd082045362b977f731ee4fef04f4f81b504a556e85ca07d389b9c968f1335eacf508bb3144087c63f961bb3fa76d99c147e80ce77224729f87939691b0e821573fa2c5514a8b6b5577843879c2933b5f7b6113a6f29e1fa7ac64518b11fae7b000ebf59a769976544cd3875650fc844860426363b26fc7310eebef5e620cd8a3343510e1dd99466036de5d6f82297b800a8730ad1cba49f6915e62fd4070b8d69efb6a993795565883363abc818be3baefe57021db0e9129b31c5bda4276b713da355f876101be16aca930418068bb26a87f16e87abcda02341a43aa12a8b1837c44c580465b01614d069776f12fb63bd901cff54362f7829d0ea19881d032ff5624a2a6efe366915d7d98de4128d6ae924defbc9ac60708e2991acdc0bc5fd8a5c704ecf295f6bfeb7a93c51e7cff86bb2e018d838cca098b83d3acc1b74ae28d432876e0bf2e3df8773fdc79f4312c2da8472ea2ce2fbe12b92d3d32411b806bdb74428b584c066f2cae5e947d58827e8d093324756c010d5a732a1254fe6790b5e6afa3df946fe1c2aee5b764da69c711684e7e5305a3dddf9bfab2c166eeefaaaa3ac9e97f5d8a731f33b0c5728348d12e975801043e7038babd406c904a6771994738e992240b03669d62cdc734f586f943e8c7e21513ba60adb0ce1fa79a3637b7b7b97134d029b5091aa978023c3ef1a40c8837c8fd492177a014760a68808b42da6565350376d1b7e793899e0b4028aa052265a01a512f2860a2abb7d20db39520ebb97e29ef40d05d1e4cdd399f91e42414b796e0657183101bcf700f9490eac8328dbfd7790f0b506b0218e441908a72d9128cf6b750b5a';
const programVk =
  '43461131588686223641337899419912555996095376523616191917604125452674317300';
const piHex =
  '0x000000000093544016227b1189eb5e8f87f888a095a94d580be01ba299a7258bfb2df338dc407e1f00000000009354603808741da450ca33951bbaf45c8e3575e87df6a923a477f04d1c2e509946df6d081051a57085376d588d45812d060de9efc1c21a031fe780301989ed8904ae5e00000000000000000000000000000000000000000000000000000000000000005dde454730f62c0a078137ecdfd85dec121fee45ac94aa90a78bb18ff2edca9d';
const pi2Hex = '0';
const pi3Hex =
  '248831628400185611740479071450564250193912070693925013182243127282342200944';
const pi4Hex = '0';

type PointField =
  | 'l_com_y'
  | 'r_com_y'
  | 'o_com_y'
  | 'qcp_0_wire_y'
  | 'grand_product_y'
  | 'h0_y'
  | 'h1_y'
  | 'h2_y'
  | 'batch_opening_at_zeta_y'
  | 'batch_opening_at_zeta_omega_y';

type XField =
  | 'l_com_x'
  | 'r_com_x'
  | 'o_com_x'
  | 'qcp_0_wire_x'
  | 'grand_product_x'
  | 'h0_x'
  | 'h1_x'
  | 'h2_x'
  | 'batch_opening_at_zeta_x'
  | 'batch_opening_at_zeta_omega_x';

function makeAcc(): Accumulator {
  const [pi0, pi1] = parsePublicInputs(programVk, piHex);
  const proof = new Sp1PlonkProof(deserializeProof(hexProof));
  const fs = Sp1PlonkFiatShamir.empty();
  const state = new StateUntilPairing(
    empty(pi0, pi1, FrC.from(pi2Hex), FrC.from(pi3Hex), FrC.from(pi4Hex))
  );
  return new Accumulator({ proof, fs, state });
}

function tamperPoint(acc: Accumulator, yField: PointField, xField: XField): void {
  const origY = (acc.proof[yField] as FpC).toBigInt();
  const tamperedY = (origY + 1n) % BN254_P;
  const lhs = (tamperedY * tamperedY) % BN254_P;
  const x = (acc.proof[xField] as FpC).toBigInt();
  const rhs = (((x * x) % BN254_P) * x + 3n) % BN254_P;
  if (lhs === rhs) throw new Error(`tampered ${yField} is still on curve`);
  (acc.proof as unknown as Record<string, unknown>)[yField] = FpC.from(tamperedY);
}

describe('regression_ec50d_plonk_oncurve', () => {
  beforeAll(async () => {
    await zkp0.compile({ cache: Cache.FileSystem(CACHE_DIR) });
  }, 600_000);

  afterAll(() => {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  test('zkp0 must reject off-curve l_com', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'l_com_y', 'l_com_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve r_com', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'r_com_y', 'r_com_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve o_com', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'o_com_y', 'o_com_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve qcp_0_wire', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'qcp_0_wire_y', 'qcp_0_wire_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve grand_product', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'grand_product_y', 'grand_product_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve h0', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'h0_y', 'h0_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve h1', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'h1_y', 'h1_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve h2', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'h2_y', 'h2_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve batch_opening_at_zeta', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'batch_opening_at_zeta_y', 'batch_opening_at_zeta_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);

  test('zkp0 must reject off-curve batch_opening_at_zeta_omega', async () => {
    const acc = makeAcc();
    tamperPoint(acc, 'batch_opening_at_zeta_omega_y', 'batch_opening_at_zeta_omega_x');
    const cin0 = Poseidon.hashPacked(Accumulator, acc);
    await expect(zkp0.compute(cin0, acc)).rejects.toThrow();
  }, 600_000);
});
