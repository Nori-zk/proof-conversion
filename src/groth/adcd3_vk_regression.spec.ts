import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { GrothVk } from './vk.js';

const VALID_DELTA = { x_c0: '12043754404802191763554326994664886008979042643626290185762540825416902247219', x_c1: '1668323501672964604911431804142266013250380587483576094566949227275849579036', y_c0: '13740680757317479711909903993315946540841369848973133181051452051592786724563', y_c1: '7710631539206257456743780535472368339139328733484942210876916214502466455394' };
const VALID_GAMMA = { x_c0: '10857046999023057135944570762232829481370756359578518086990519993285655852781', x_c1: '11559732032986387107991004021392285783925812861821192530917403151452391805634', y_c0: '8495653923123431417604973247489272438418190587263600148770280649306958101930', y_c1: '4082367875863433681332203403145435568316851327593401208105741076214120093531' };
const VALID_ALPHA_BETA = { g00: '5697245924082314955838557878331368209814247075300951521701254589084804234970', g01: '6607404321972637550020783611836551818248636342709305900123466355480118576099', g10: '3670608949875518863244021916950733644062078743044974108285053440592297066931', g11: '541250262476899488042926921352922562849943764605667374596011538907110731629', g20: '18124534578366443052930374136100844352060568779165176942539622400742155990163', g21: '254425962675264208268606525222145870537081446419126819669512313449894617711', h00: '14682601387374107597061811864806746474418747695496995459538035046909465405682', h01: '380626998809465124537308088395106769155276843034064955773603619257287977827', h10: '20937581287674855219025710764445572864809573889072173538957685817558553170744', h11: '1875554049818610060118039934136718085309900630088668968527777353177281637676', h20: '10677133934211244973062689418678002923080465282453292613142034282094753864563', h21: '5217526782465309563115572197406844083015292505138779767346232600336410380272' };
const VALID_W27 = { g00: '0', g01: '0', g10: '0', g11: '0', g20: '8204864362109909869166472767738877274689483185363591877943943203703805152849', g21: '17912368812864921115467448876996876278487602260484145953989158612875588124088', h00: '0', h01: '0', h10: '0', h11: '0', h20: '0', h21: '0' };

const IC0 = { x: '8446592859352799428420270221449902464741693648963397251242447530457567083492', y: '1064796367193003797175961162477173481551615790032213185848276823815288302804' };
const IC1 = { x: '3179835575189816632597428042194253779818690147323192973511715175294048485951', y: '20895841676865356752879376687052266198216014795822152491318012491767775979074' };
const IC2 = { x: '5332723250224941161709478398807683311971555792614491788690328996478511465287', y: '21199491073419440416471372042641226693637837098357067793586556692319371762571' };
const IC3 = { x: '12457994489566736295787256452575216703923664299075106359829199968023158780583', y: '19706766271952591897761291684837117091856807401404423804318744964752784280790' };

const BASE_VK = { alpha_beta: VALID_ALPHA_BETA, delta: VALID_DELTA, gamma: VALID_GAMMA, w27: VALID_W27 };

const paths: string[] = [];

function tmp(obj: object): string {
  const path = join(tmpdir(), `adcd3_vk_${Date.now()}_${Math.random()}.json`);
  writeFileSync(path, JSON.stringify(obj));
  paths.push(path);
  return path;
}

afterAll(() => paths.forEach(p => unlinkSync(p)));

describe('regression_adcd3_ic_contiguity', () => {

  describe('valid - contiguous ic sequences', () => {
    test('ic0 only (zero public inputs) parses successfully', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0 }))).not.toThrow();
    });

    test('ic0 ic1 (one public input) parses successfully', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, ic1: IC1 }))).not.toThrow();
    });

    test('ic0 ic1 ic2 (two public inputs) parses successfully', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, ic1: IC1, ic2: IC2 }))).not.toThrow();
    });

    test('ic0 through ic3 (three public inputs) parses successfully', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, ic1: IC1, ic2: IC2, ic3: IC3 }))).not.toThrow();
    });
  });

  describe('invalid - non-contiguous ic sequences', () => {
    test('ic0 and ic2 with missing ic1 throws contiguous error', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, ic2: IC2 }))).toThrow(/ic1.*contiguous/);
    });

    test('ic0 ic1 ic3 with missing ic2 throws contiguous error', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, ic1: IC1, ic3: IC3 }))).toThrow(/ic2.*contiguous/);
    });

    test('ic1 present without ic0 throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic1: IC1 }))).toThrow();
    });

    test('ic2 ic3 without ic0 ic1 throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic2: IC2, ic3: IC3 }))).toThrow();
    });
  });

  describe('invalid - missing required fields', () => {
    test('no ic points at all throws', () => {
      expect(() => GrothVk.parse(tmp(BASE_VK))).toThrow();
    });

    test('missing alpha_beta throws', () => {
      const { alpha_beta: _, ...noAlphaBeta } = BASE_VK;
      expect(() => GrothVk.parse(tmp({ ...noAlphaBeta, ic0: IC0 }))).toThrow();
    });

    test('missing delta throws', () => {
      const { delta: _, ...noDelta } = BASE_VK;
      expect(() => GrothVk.parse(tmp({ ...noDelta, ic0: IC0 }))).toThrow();
    });

    test('missing gamma throws', () => {
      const { gamma: _, ...noGamma } = BASE_VK;
      expect(() => GrothVk.parse(tmp({ ...noGamma, ic0: IC0 }))).toThrow();
    });

    test('missing w27 throws', () => {
      const { w27: _, ...noW27 } = BASE_VK;
      expect(() => GrothVk.parse(tmp({ ...noW27, ic0: IC0 }))).toThrow();
    });

    test('empty object throws', () => {
      expect(() => GrothVk.parse(tmp({}))).toThrow();
    });
  });

  describe('invalid - wrong field types', () => {
    test('ic0.x as number throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: { x: 123, y: IC0.y } }))).toThrow();
    });

    test('ic0.y missing throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: { x: IC0.x } }))).toThrow();
    });

    test('delta.x_c0 as number throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, delta: { ...VALID_DELTA, x_c0: 123 } }))).toThrow();
    });

    test('alpha_beta field as number throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, alpha_beta: { ...VALID_ALPHA_BETA, g00: 123 } }))).toThrow();
    });
  });

  describe('invalid - unknown fields', () => {
    test('unknown top-level field throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, unknownField: 'foo' }))).toThrow();
    });

    test('unknown field inside ic0 throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: { ...IC0, extra: 'bad' } }))).toThrow();
    });

    test('unknown field inside delta throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, delta: { ...VALID_DELTA, extra: 'bad' } }))).toThrow();
    });

    test('unknown field inside gamma throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, gamma: { ...VALID_GAMMA, extra: 'bad' } }))).toThrow();
    });

    test('unknown field inside alpha_beta throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, alpha_beta: { ...VALID_ALPHA_BETA, extra: 'bad' } }))).toThrow();
    });

    test('unknown field inside w27 throws', () => {
      expect(() => GrothVk.parse(tmp({ ...BASE_VK, ic0: IC0, w27: { ...VALID_W27, extra: 'bad' } }))).toThrow();
    });
  });
});
