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

/** Validates G1 affine point (2D with x, y coordinates) */
export const isAffinePoint2d = guard(function isAffinePoint2d(
  val: unknown
): val is AffinePoint2d {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return 'x' in obj && 'y' in obj && isString(obj.x) && isString(obj.y);
});

/** Validates G2 affine point (2D with complex coordinates: x_c0, x_c1, y_c0, y_c1) */
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

/** Validates Fq12 field element (12 string components: g00-g21, h00-h21) */
export const isField12 = guard(function isField12(val: unknown): val is Field12 {
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
 * Validates G1 projective point: [x, y, z] where each is a string.
 *
 * Note: Uses explicit type predicate to match imported `ProjectivePoint` type exactly.
 * Cannot use `isArrayOfLength(isString, 3)` because that would return `[string, string, string]`
 * instead of the imported `ProjectivePoint` type.
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
 * Validates G2 projective point: [[x_c0, x_c1], [y_c0, y_c1], [z_c0, z_c1]].
 *
 * Note: Uses explicit type predicate to match imported `ComplexProjectivePoint` type exactly.
 * Cannot compose from primitives because TypeScript would infer structural type instead.
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
