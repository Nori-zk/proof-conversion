import { assertExactStructure } from './validation.js';
import { describeSchema } from './core.js';
import {
  isString,
  isBoundedNumber,
  isBoundedNumberUnion,
} from './primitives.js';
import {
  isArray,
  isArrayOfLength,
  isArrayOfBoundedLength,
  isStringArrayOfLength,
} from './arrays.js';
import {
  isAffinePoint2d,
  isComplexAffinePoint2d,
  isProjectivePoint,
  isComplexProjectivePoint,
} from './crypto.js';

// ============================================================================
// SNARKJS GROTH16 SCHEMA (from snarkjs/schema.ts)
// ============================================================================

const snarkjsGroth16ProofSchema = {
  protocol: 'groth16' as const,
  curve: 'bn128' as const,
  pi_a: isProjectivePoint,
  pi_b: isComplexProjectivePoint,
  pi_c: isProjectivePoint,
};

const snarkjsGroth16VKSchema = {
  protocol: 'groth16' as const,
  curve: 'bn128' as const,
  nPublic: isBoundedNumberUnion({ min: 0, max: 6 }),
  vk_alpha_1: isProjectivePoint,
  vk_beta_2: isComplexProjectivePoint,
  vk_gamma_2: isComplexProjectivePoint,
  vk_delta_2: isComplexProjectivePoint,
  vk_alphabeta_12: isArrayOfLength(isComplexProjectivePoint, 2),
  IC: isArrayOfBoundedLength(isProjectivePoint, {
    minLength: 0,
    maxLength: 7,
  }),
};

const snarkjsGroth16PublicInputsSchema = isStringArrayOfLength(6);

const snarkjsGroth16InputSchema = {
  proof: snarkjsGroth16ProofSchema,
  vk: snarkjsGroth16VKSchema,
  publicInputs: snarkjsGroth16PublicInputsSchema,
};

// ============================================================================
// RISC0 GROTH16 SCHEMA (from risc0/schema.ts)
// ============================================================================

const risc0Groth16ProofSchema = {
  negA: isAffinePoint2d,
  B: isComplexAffinePoint2d,
  C: isAffinePoint2d,
  pi1: isString,
  pi2: isString,
  pi3: isString,
  pi4: isString,
  pi5: isString,
};

const risc0Groth16VkSchema = {
  alpha: isAffinePoint2d,
  beta: isComplexAffinePoint2d,
  gamma: isComplexAffinePoint2d,
  delta: isComplexAffinePoint2d,
  ic0: isAffinePoint2d,
  ic1: isAffinePoint2d,
  ic2: isAffinePoint2d,
  ic3: isAffinePoint2d,
  ic4: isAffinePoint2d,
  ic5: isAffinePoint2d,
};

const risc0Groth16ObjInputSchema = {
  risc0_proof: risc0Groth16ProofSchema,
  raw_vk: risc0Groth16VkSchema,
};

// ============================================================================
// TESTS
// ============================================================================

describe('Guard System - Schema Validation', () => {
  describe('SnarkJS Groth16 Proof', () => {
    it('should validate a correct proof', () => {
      const validProof = {
        protocol: 'groth16',
        curve: 'bn128',
        pi_a: ['1', '2', '3'],
        pi_b: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        pi_c: ['7', '8', '9'],
      };

      expect(() => {
        assertExactStructure(validProof, snarkjsGroth16ProofSchema, 'proof');
      }).not.toThrow();
    });

    it('should reject proof with wrong protocol', () => {
      const invalidProof = {
        protocol: 'plonk', // Wrong!
        curve: 'bn128',
        pi_a: ['1', '2', '3'],
        pi_b: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        pi_c: ['7', '8', '9'],
      };

      try {
        assertExactStructure(invalidProof, snarkjsGroth16ProofSchema, 'proof');
        fail('Should have thrown an error');
      } catch (e) {
        console.error('\n Wrong protocol error:\n', (e as Error).message);
        expect((e as Error).message).toMatch(/"protocol" must be exactly "groth16"/);
      }
    });

    it('should reject proof with invalid pi_a length', () => {
      const invalidProof = {
        protocol: 'groth16',
        curve: 'bn128',
        pi_a: ['1', '2'], // Should be 3 elements!
        pi_b: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        pi_c: ['7', '8', '9'],
      };

      expect(() => {
        assertExactStructure(invalidProof, snarkjsGroth16ProofSchema, 'proof');
      }).toThrow();
    });

    it('should reject proof with non-string element in pi_a', () => {
      const invalidProof = {
        protocol: 'groth16',
        curve: 'bn128',
        pi_a: ['1', 2, '3'], // Element 1 is a number!
        pi_b: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        pi_c: ['7', '8', '9'],
      };

      expect(() => {
        assertExactStructure(invalidProof, snarkjsGroth16ProofSchema, 'proof');
      }).toThrow(/pi_a.*expected.*ProjectivePoint/);
    });
  });

  describe('SnarkJS Groth16 Verification Key', () => {
    it('should validate a correct VK', () => {
      const validVK = {
        protocol: 'groth16',
        curve: 'bn128',
        nPublic: 3,
        vk_alpha_1: ['1', '2', '3'],
        vk_beta_2: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        vk_gamma_2: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        vk_delta_2: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        vk_alphabeta_12: [
          [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          [
            ['7', '8'],
            ['9', '10'],
            ['11', '12'],
          ],
        ],
        IC: [
          ['1', '2', '3'],
          ['4', '5', '6'],
        ],
      };

      expect(() => {
        assertExactStructure(validVK, snarkjsGroth16VKSchema, 'vk');
      }).not.toThrow();
    });

    it('should reject VK with nPublic out of range', () => {
      const invalidVK = {
        protocol: 'groth16',
        curve: 'bn128',
        nPublic: 10, // Max is 6!
        vk_alpha_1: ['1', '2', '3'],
        vk_beta_2: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        vk_gamma_2: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        vk_delta_2: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        vk_alphabeta_12: [
          [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          [
            ['7', '8'],
            ['9', '10'],
            ['11', '12'],
          ],
        ],
        IC: [],
      };

      try {
        assertExactStructure(invalidVK, snarkjsGroth16VKSchema, 'vk');
        fail('Should have thrown an error');
      } catch (e) {
        console.error('\n nPublic out of range error:\n', (e as Error).message);
        expect((e as Error).message).toMatch(/"nPublic".*BoundedNumberUnion.*exceeds maximum 6/);
      }
    });

    it('should reject VK with IC exceeding maxLength', () => {
      const invalidVK = {
        protocol: 'groth16',
        curve: 'bn128',
        nPublic: 3,
        vk_alpha_1: ['1', '2', '3'],
        vk_beta_2: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        vk_gamma_2: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        vk_delta_2: [
          ['1', '2'],
          ['3', '4'],
          ['5', '6'],
        ],
        vk_alphabeta_12: [
          [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          [
            ['7', '8'],
            ['9', '10'],
            ['11', '12'],
          ],
        ],
        IC: [
          // 8 elements - exceeds maxLength of 7!
          ['1', '2', '3'],
          ['1', '2', '3'],
          ['1', '2', '3'],
          ['1', '2', '3'],
          ['1', '2', '3'],
          ['1', '2', '3'],
          ['1', '2', '3'],
          ['1', '2', '3'],
        ],
      };

      expect(() => {
        assertExactStructure(invalidVK, snarkjsGroth16VKSchema, 'vk');
      }).toThrow(/IC.*exceeding maximum 7/);
    });
  });

  describe('RISC0 Groth16 Input', () => {
    it('should validate a correct input', () => {
      const validInput = {
        risc0_proof: {
          negA: { x: '1', y: '2' },
          B: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          C: { x: '5', y: '6' },
          pi1: '1',
          pi2: '2',
          pi3: '3',
          pi4: '4',
          pi5: '5',
        },
        raw_vk: {
          alpha: { x: '1', y: '2' },
          beta: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          gamma: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          delta: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          ic0: { x: '1', y: '2' },
          ic1: { x: '1', y: '2' },
          ic2: { x: '1', y: '2' },
          ic3: { x: '1', y: '2' },
          ic4: { x: '1', y: '2' },
          ic5: { x: '1', y: '2' },
        },
      };

      expect(() => {
        assertExactStructure(validInput, risc0Groth16ObjInputSchema, 'input');
      }).not.toThrow();
    });

    it('should reject input with missing field', () => {
      const invalidInput = {
        risc0_proof: {
          negA: { x: '1', y: '2' },
          B: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          C: { x: '5', y: '6' },
          pi1: '1',
          pi2: '2',
          pi3: '3',
          pi4: '4',
          // Missing pi5!
        },
        raw_vk: {
          alpha: { x: '1', y: '2' },
          beta: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          gamma: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          delta: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          ic0: { x: '1', y: '2' },
          ic1: { x: '1', y: '2' },
          ic2: { x: '1', y: '2' },
          ic3: { x: '1', y: '2' },
          ic4: { x: '1', y: '2' },
          ic5: { x: '1', y: '2' },
        },
      };

      try {
        assertExactStructure(invalidInput, risc0Groth16ObjInputSchema, 'input');
        fail('Should have thrown an error');
      } catch (e) {
        console.error('\n Missing field error:\n', (e as Error).message);
        expect((e as Error).message).toMatch(/missing required key.*"pi5"/);
      }
    });

    it('should reject input with multiple deep errors simultaneously', () => {
      const invalidInput = {
        risc0_proof: {
          negA: { x: 123, y: 2 }, // x should be string! y should be string!
          B: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          C: { x: '5', y: '6' },
          pi1: '1',
          pi2: '2',
          pi3: 333, // Should be string!
          pi4: '4',
          pi5: '5',
        },
        raw_vk: {
          alpha: { x: '1', y: '2' },
          beta: { x_c0: '1', x_c1: '2', y_c0: '3', y_c1: '4' },
          gamma: { x_c0: 999, x_c1: '2', y_c0: '3', y_c1: false }, // x_c0 should be string! y_c1 should be string!
          delta: { x_c0: null, x_c1: '2', y_c0: '3', y_c1: 777 }, // x_c0 should be string! y_c1 should be string!
          ic0: { x: '1', y: '2' },
          ic1: { x: '1', y: '2' },
          ic2: { x: '1', y: '2' },
          ic3: { x: '1', y: '2' },
          ic4: { x: '1', y: '2' },
          ic5: { x: '1', y: '2' },
        },
      };

      try {
        assertExactStructure(invalidInput, risc0Groth16ObjInputSchema, 'input');
        fail('Should have thrown an error');
      } catch (e) {
        console.error('\n Multiple deep errors simultaneously:\n', (e as Error).message);
        const errorMsg = (e as Error).message;

        // Should report ALL errors with type structures shown
        expect(errorMsg).toMatch(/"negA".*expected.*AffinePoint2d.*got.*\{x: Number, y: Number\}/);
        expect(errorMsg).toMatch(/"pi3".*expected.*String.*got.*Number/);
        expect(errorMsg).toMatch(/"gamma".*expected.*ComplexAffinePoint2d.*got.*\{x_c0: Number.*y_c1: Boolean\}/);
        expect(errorMsg).toMatch(/"delta".*expected.*ComplexAffinePoint2d.*got.*\{x_c0: Null.*y_c1: Number\}/);
      }
    });
  });

  describe('SnarkJS Groth16 Full Input', () => {
    it('should print schema description', () => {
      const description = describeSchema(snarkjsGroth16InputSchema);
      console.log('\nSnarkJS Groth16 Input Schema:\n', JSON.stringify(description, null, 2));
      expect(description).toHaveProperty('proof');
      expect(description).toHaveProperty('vk');
      expect(description).toHaveProperty('publicInputs');
    });

    it('should validate a complete valid input', () => {
      const validInput = {
        proof: {
          protocol: 'groth16',
          curve: 'bn128',
          pi_a: ['1', '2', '3'],
          pi_b: [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          pi_c: ['7', '8', '9'],
        },
        vk: {
          protocol: 'groth16',
          curve: 'bn128',
          nPublic: 3,
          vk_alpha_1: ['1', '2', '3'],
          vk_beta_2: [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          vk_gamma_2: [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          vk_delta_2: [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          vk_alphabeta_12: [
            [
              ['1', '2'],
              ['3', '4'],
              ['5', '6'],
            ],
            [
              ['7', '8'],
              ['9', '10'],
              ['11', '12'],
            ],
          ],
          IC: [
            ['1', '2', '3'],
            ['4', '5', '6'],
          ],
        },
        publicInputs: ['1', '2', '3', '4', '5', '6'],
      };

      expect(() => {
        assertExactStructure(validInput, snarkjsGroth16InputSchema, 'input');
      }).not.toThrow();
    });

    it('should reject input with invalid proof and vk simultaneously', () => {
      const invalidInput = {
        proof: {
          protocol: 'plonk', // Wrong!
          curve: 'bn128',
          pi_a: ['1', '2'], // Wrong length!
          pi_b: [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          pi_c: ['7', '8', '9'],
        },
        vk: {
          protocol: 'groth16',
          curve: 'bn128',
          nPublic: 10, // Out of range!
          vk_alpha_1: ['1', '2', '3'],
          vk_beta_2: [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          vk_gamma_2: [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          vk_delta_2: [
            ['1', '2'],
            ['3', '4'],
            ['5', '6'],
          ],
          vk_alphabeta_12: [
            [
              ['1', '2'],
              ['3', '4'],
              ['5', '6'],
            ],
            [
              ['7', '8'],
              ['9', '10'],
              ['11', '12'],
            ],
          ],
          IC: [],
        },
        publicInputs: ['1', '2', '3'], // Wrong length!
      };

      try {
        assertExactStructure(invalidInput, snarkjsGroth16InputSchema, 'input');
        fail('Should have thrown an error');
      } catch (e) {
        console.error('\n Multiple section errors:\n', (e as Error).message);
        const errorMsg = (e as Error).message;

        // Should report errors in proof, vk, and publicInputs
        expect(errorMsg).toMatch(/in "proof".*protocol.*must be exactly "groth16"/);
        expect(errorMsg).toMatch(/pi_a.*expected.*ProjectivePoint/);
        expect(errorMsg).toMatch(/in "vk".*nPublic.*exceeds maximum 6/);
        expect(errorMsg).toMatch(/publicInputs.*expected.*ArrayOfLength/);
      }
    });
  });

  describe('Nested Arrays with Bounds', () => {
    it('should collect multiple errors across deeply nested arrays', () => {
      const schema = {
        points: isArrayOfBoundedLength(
          isArrayOfLength(isBoundedNumber({ min: 0, max: 100 }), 3),
          { minLength: 1, maxLength: 5 }
        ),
        matrix: isArray(
          isArray(isArrayOfLength(isBoundedNumber({ min: -50, max: 50 }), 2))
        ),
      };

      const invalidData = {
        points: [
          [10, 20, 30], // Valid
          [40, 105, 60], // 105 exceeds max!
          [-5, 50, 200], // -5 below min, 200 exceeds max!
          [25, 35], // Wrong length! Should be 3
        ],
        matrix: [
          [[10, 20], [30, 40]], // Valid
          [[99, -60], [25, 35]], // 99 exceeds max, -60 below min!
          [[15, 25, 35]], // Inner array wrong length! Should be 2
        ],
      };

      try {
        assertExactStructure(invalidData, schema, 'test');
        fail('Should have thrown an error');
      } catch (e) {
        console.error('\n Multiple deep nested array errors:\n', (e as Error).message);
        const errorMsg = (e as Error).message;

        // Should report ALL errors with full paths
        expect(errorMsg).toMatch(/points\[1\].*105.*exceeds maximum 100/);
        expect(errorMsg).toMatch(/points\[2\].*-5.*below minimum 0/);
        expect(errorMsg).toMatch(/points\[2\].*200.*exceeds maximum 100/);
        expect(errorMsg).toMatch(/points\[3\].*length 2.*expected exactly 3/);
        expect(errorMsg).toMatch(/matrix\[1\]\[0\].*99.*exceeds maximum 50/);
        expect(errorMsg).toMatch(/matrix\[1\]\[0\].*-60.*below minimum -50/);
        expect(errorMsg).toMatch(/matrix\[2\]\[0\].*length 3.*expected exactly 2/);
      }
    });
  });
});
