import type {
  AffinePoint2d,
  ComplexAffinePoint2d,
  Field12,
  ProjectivePoint,
  ComplexProjectivePoint,
} from '@nori-zk/proof-conversion-utils';
import { guard } from './core.js';
import { isString } from './primitives.js';

// ============================================================================
// OBJECT/STRUCTURE GUARDS - For cryptographic types
// ============================================================================

/**
 * Type guard validator for G1 affine points (2D with x, y coordinates).
 * Returns a ValidatorFn that narrows the type to `AffinePoint2d` on success.
 *
 * Validates objects with structure: `{ x: string, y: string }`
 *
 * @returns ValidatorFn<AffinePoint2d> - Validator function with type predicate
 *
 * @example
 * const validator = isAffinePoint2d;
 * if (validator(value)) {
 *   // value is narrowed to type: AffinePoint2d
 *   const x = value.x; // string
 * }
 */
export const isAffinePoint2d = guard(function isAffinePoint2d(
  val: unknown
): val is AffinePoint2d {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return 'x' in obj && 'y' in obj && isString(obj.x) && isString(obj.y);
});

/**
 * Type guard validator for G2 affine points (2D with complex coordinates).
 * Returns a ValidatorFn that narrows the type to `ComplexAffinePoint2d` on success.
 *
 * Validates objects with structure: `{ x_c0: string, x_c1: string, y_c0: string, y_c1: string }`
 *
 * @returns ValidatorFn<ComplexAffinePoint2d> - Validator function with type predicate
 *
 * @example
 * const validator = isComplexAffinePoint2d;
 * if (validator(value)) {
 *   // value is narrowed to type: ComplexAffinePoint2d
 *   const x0 = value.x_c0; // string
 * }
 */
export const isComplexAffinePoint2d = guard(function isComplexAffinePoint2d(
  val: unknown
): val is ComplexAffinePoint2d {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return (
    'x_c0' in obj &&
    'x_c1' in obj &&
    'y_c0' in obj &&
    'y_c1' in obj &&
    isString(obj.x_c0) &&
    isString(obj.x_c1) &&
    isString(obj.y_c0) &&
    isString(obj.y_c1)
  );
});

/**
 * Type guard validator for Fq12 field elements (12 string components).
 * Returns a ValidatorFn that narrows the type to `Field12` on success.
 *
 * Validates objects with 12 string fields: g00, g01, g10, g11, g20, g21, h00, h01, h10, h11, h20, h21
 *
 * @returns ValidatorFn<Field12> - Validator function with type predicate
 *
 * @example
 * const validator = isField12;
 * if (validator(value)) {
 *   // value is narrowed to type: Field12
 *   const g00 = value.g00; // string
 * }
 */
export const isField12 = guard(function isField12(
  val: unknown
): val is Field12 {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  const keys = [
    'g00',
    'g01',
    'g10',
    'g11',
    'g20',
    'g21',
    'h00',
    'h01',
    'h10',
    'h11',
    'h20',
    'h21',
  ];
  return keys.every((key) => key in obj && isString(obj[key]));
});

/**
 * Type guard validator for G1 projective points: [x, y, z] where each is a string.
 * Returns a ValidatorFn that narrows the type to `ProjectivePoint` on success.
 *
 * Note: Uses explicit type predicate to match imported `ProjectivePoint` type exactly.
 * Cannot use `isArrayOfLength(isString, 3)` because that would return `[string, string, string]`
 * instead of the imported `ProjectivePoint` type.
 *
 * @returns ValidatorFn<ProjectivePoint> - Validator function with type predicate
 *
 * @example
 * const validator = isProjectivePoint;
 * if (validator(value)) {
 *   // value is narrowed to type: ProjectivePoint
 *   const [x, y, z] = value; // all strings
 * }
 */
export const isProjectivePoint = guard(function isProjectivePoint(
  val: unknown
): val is ProjectivePoint {
  return (
    Array.isArray(val) &&
    val.length === 3 &&
    val.every((v) => typeof v === 'string')
  );
});

/**
 * Type guard validator for G2 projective points: [[x_c0, x_c1], [y_c0, y_c1], [z_c0, z_c1]].
 * Returns a ValidatorFn that narrows the type to `ComplexProjectivePoint` on success.
 *
 * Note: Uses explicit type predicate to match imported `ComplexProjectivePoint` type exactly.
 * Cannot compose from primitives because TypeScript would infer structural type instead.
 *
 * @returns ValidatorFn<ComplexProjectivePoint> - Validator function with type predicate
 *
 * @example
 * const validator = isComplexProjectivePoint;
 * if (validator(value)) {
 *   // value is narrowed to type: ComplexProjectivePoint
 *   const [[x_c0, x_c1], [y_c0, y_c1], [z_c0, z_c1]] = value; // all strings
 * }
 */
export const isComplexProjectivePoint = guard(function isComplexProjectivePoint(
  val: unknown
): val is ComplexProjectivePoint {
  return (
    Array.isArray(val) &&
    val.length === 3 &&
    val.every(
      (sv) =>
        Array.isArray(sv) &&
        sv.length === 2 &&
        sv.every((v) => typeof v === 'string')
    )
  );
});
