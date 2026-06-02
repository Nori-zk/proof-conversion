import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { detectInputCountFromProof } from './proof.js';

const VALID_NEG_A = { x: '16465199099708604290698553000024942000051030364759839088954586362243760185403', y: '17690359568564825813235988832215237195831246832056909949821693820324615702030' };
const VALID_B = { x_c0: '20076621026680381759767634077167710158570125456580059736389163589252903861997', x_c1: '8939596936503745624468413156089285325774309438533412822132357238045755689387', y_c0: '111879341840300391556371653123940615424189534247854096298516707026393487948', y_c1: '7719123513247232282802073769919057076444760653726977674407327771459600820251' };
const VALID_C = { x: '10184405014965771627427034456113644883671783030647002464387923536809721376302', y: '3331725942843591742687069662771052794291623321043694393039994836222102831251' };

const BASE_PROOF = { negA: VALID_NEG_A, B: VALID_B, C: VALID_C };

const paths: string[] = [];

function tmp(obj: object): string {
  const path = join(tmpdir(), `adcd3_${Date.now()}_${Math.random()}.json`);
  writeFileSync(path, JSON.stringify(obj));
  paths.push(path);
  return path;
}

afterAll(() => paths.forEach(p => unlinkSync(p)));

describe('regression_adcd3_pi_contiguity', () => {

  describe('valid - contiguous pi sequences', () => {
    test('zero pi inputs (minimum) returns 0', () => {
      expect(detectInputCountFromProof(tmp(BASE_PROOF))).toBe(0);
    });

    test('pi1 only returns 1', () => {
      expect(detectInputCountFromProof(tmp({ ...BASE_PROOF, pi1: '1' }))).toBe(1);
    });

    test('pi1 pi2 returns 2', () => {
      expect(detectInputCountFromProof(tmp({ ...BASE_PROOF, pi1: '1', pi2: '2' }))).toBe(2);
    });

    test('pi1 through pi3 returns 3', () => {
      expect(detectInputCountFromProof(tmp({ ...BASE_PROOF, pi1: '1', pi2: '2', pi3: '3' }))).toBe(3);
    });

    test('pi1 through pi6 (maximum) returns 6', () => {
      expect(detectInputCountFromProof(tmp({ ...BASE_PROOF, pi1: '1', pi2: '2', pi3: '3', pi4: '4', pi5: '5', pi6: '6' }))).toBe(6);
    });
  });

  describe('invalid - non-contiguous pi sequences', () => {
    test('pi2 present without pi1 throws contiguous error', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, pi2: '2' }))).toThrow(/pi1.*contiguous/);
    });

    test('pi1 and pi3 with missing pi2 throws contiguous error', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, pi1: '1', pi3: '3' }))).toThrow(/pi2.*contiguous/);
    });

    test('pi1 pi2 pi4 with missing pi3 throws contiguous error', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, pi1: '1', pi2: '2', pi4: '4' }))).toThrow(/pi3.*contiguous/);
    });

    test('pi3 through pi6 with missing pi1 pi2 throws contiguous error', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, pi3: '3', pi4: '4', pi5: '5', pi6: '6' }))).toThrow(/pi1.*contiguous/);
    });
  });

  describe('invalid - schema violations', () => {
    test('missing negA throws', () => {
      const { negA: _, ...noNegA } = BASE_PROOF;
      expect(() => detectInputCountFromProof(tmp(noNegA))).toThrow();
    });

    test('missing B throws', () => {
      const { B: _, ...noB } = BASE_PROOF;
      expect(() => detectInputCountFromProof(tmp(noB))).toThrow();
    });

    test('missing C throws', () => {
      const { C: _, ...noC } = BASE_PROOF;
      expect(() => detectInputCountFromProof(tmp(noC))).toThrow();
    });

    test('negA.x as number instead of string throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, negA: { x: 123, y: '0' } }))).toThrow();
    });

    test('negA.y missing throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, negA: { x: '0' } }))).toThrow();
    });

    test('B missing x_c0 throws', () => {
      const { x_c0: _, ...bNoXc0 } = VALID_B;
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, B: bNoXc0 }))).toThrow();
    });

    test('pi1 as number instead of string throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, pi1: 123 }))).toThrow();
    });

    test('pi1 as null throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, pi1: null }))).toThrow();
    });

    test('empty object throws', () => {
      expect(() => detectInputCountFromProof(tmp({}))).toThrow();
    });
  });

  describe('invalid - unknown fields', () => {
    test('unknown top-level field throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, unknownField: 'foo' }))).toThrow();
    });

    test('pi7 (beyond maximum) throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, pi1: '1', pi7: '7' }))).toThrow();
    });

    test('pi0 throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, pi0: '0' }))).toThrow();
    });

    test('unknown field inside negA throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, negA: { ...VALID_NEG_A, extra: 'bad' } }))).toThrow();
    });

    test('unknown field inside C throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, C: { ...VALID_C, extra: 'bad' } }))).toThrow();
    });

    test('unknown field inside B throws', () => {
      expect(() => detectInputCountFromProof(tmp({ ...BASE_PROOF, B: { ...VALID_B, extra: 'bad' } }))).toThrow();
    });
  });
});
