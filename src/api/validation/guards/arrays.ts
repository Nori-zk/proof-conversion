import { guard, type ValidatorFn } from './core.js';
import type { AccumulatorRange } from './types.js';
import { isString, isNumber, isUint8 } from './primitives.js';

// ============================================================================
// TUPLE TYPES - For precise array length typing
// ============================================================================

/**
 * Recursively builds a fixed-length tuple type.
 *
 * @example
 * Tuple<string, 3> = [string, string, string]
 */
type Tuple<T, N extends number, Acc extends T[] = []> = Acc['length'] extends N
  ? Acc
  : Tuple<T, N, [...Acc, T]>;

/**
 * Helper type to create tuple unions for constrained arrays.
 *
 * @example
 * TupleUnion<string, 1, 3> = [string] | [string, string] | [string, string, string]
 */
type TupleUnion<T, Min extends number, Max extends number> = AccumulatorRange<
  Min,
  Max,
  T
>;

// ============================================================================
// ARRAY GUARDS
// ============================================================================

/**
 * Creates a variable-length array validator.
 * NOTE: The guard function checks only that it's an array, NOT the elements.
 * Element validation is handled by the diagnose function.
 *
 * @example
 * const isStringArray = isArray(isString);
 * // Returns: (val: unknown) => val is string[]
 */
export const isArray = <T>(inner: ValidatorFn<T>): ValidatorFn<T[]> =>
  guard<T[]>(
    function isArray(val: unknown): val is T[] {
      return Array.isArray(val);
    },
    { inner: inner as ValidatorFn<unknown> }
  );

// ============================================================================
// FIXED LENGTH ARRAY
// ============================================================================

/**
 * Constraint metadata for fixed-length array validation.
 */
export interface FixedLengthConstraint {
  /** The exact required length of the array */
  length: number;
}

/**
 * Creates a fixed-length array validator that returns a tuple type.
 * NOTE: The guard function checks only array type and length, NOT the elements.
 *
 * @example
 * const isStringTriple = isArrayOfLength(isString, 3);
 * // Returns: (val: unknown) => val is [string, string, string]
 */
export const isArrayOfLength = <T, N extends number>(
  inner: ValidatorFn<T>,
  len: N
): ValidatorFn<Tuple<T, N>> =>
  guard<Tuple<T, N>, FixedLengthConstraint>(
    function isArrayOfLength(val: unknown): val is Tuple<T, N> {
      if (!Array.isArray(val)) return false;
      if (val.length !== len) return false;
      return true;
    },
    {
      inner: inner as ValidatorFn<unknown>,
      constraint: { length: len },
      printConstraint: (c) => `[${c.length}]`,
      printDiagnosis: (c, val) => {
        if (!Array.isArray(val)) return `got ${typeof val}`;
        return `got array of length ${val.length}, expected exactly ${c.length}`;
      },
    }
  );

// ============================================================================
// BOUNDED LENGTH ARRAY
// ============================================================================

/**
 * Constraint metadata for bounded-length array validation.
 * At least one of minLength or maxLength should be specified for meaningful bounds.
 */
export interface ArrayConstraints {
  /** Minimum allowed array length (inclusive) */
  minLength?: number;
  /** Maximum allowed array length (inclusive) */
  maxLength?: number;
}

/**
 * Creates an array validator with length constraints and union of tuple types.
 * NOTE: The guard function checks only array type and length, NOT the elements.
 *
 * The return type is a union of all valid tuple lengths from minLength to maxLength.
 *
 * @example
 * const isSmallStringArray = isArrayOfBoundedLength(isString, { minLength: 1, maxLength: 3 });
 * // Returns: (val: unknown) => val is [string] | [string, string] | [string, string, string]
 */
export const isArrayOfBoundedLength = <
  T,
  Min extends number,
  Max extends number,
>(
  inner: ValidatorFn<T>,
  options:
    | { minLength: Min; maxLength?: Max }
    | { minLength?: Min; maxLength: Max }
): ValidatorFn<TupleUnion<T, Min, Max>> =>
  guard<TupleUnion<T, Min, Max>, ArrayConstraints>(
    function isArrayOfBoundedLength(
      val: unknown
    ): val is TupleUnion<T, Min, Max> {
      if (!Array.isArray(val)) return false;
      if (options.minLength !== undefined && val.length < options.minLength)
        return false;
      if (options.maxLength !== undefined && val.length > options.maxLength)
        return false;
      return true;
    },
    {
      inner: inner as ValidatorFn<unknown>,
      constraint: options,
      printConstraint: (c) => `[${c.minLength ?? 0}..${c.maxLength ?? '∞'}]`,
      printDiagnosis: (c, val) => {
        if (!Array.isArray(val)) return `got ${typeof val}`;
        const len = val.length;
        if (c.minLength !== undefined && len < c.minLength)
          return `got array of length ${len}, below minimum ${c.minLength}`;
        if (c.maxLength !== undefined && len > c.maxLength)
          return `got array of length ${len}, exceeding maximum ${c.maxLength}`;
        return `got array of length ${len}`;
      },
    }
  );

// ============================================================================
// HELPER GUARDS - Common array combinations for convenience
// ============================================================================

/**
 * Type guard validator for variable-length arrays of numbers.
 * Returns a ValidatorFn that narrows the type to `number[]` on success.
 *
 * @returns ValidatorFn<number[]> - Validator function with type predicate
 */
export const isNumberArray = isArray(isNumber);

/**
 * Type guard validator for variable-length arrays of strings.
 * Returns a ValidatorFn that narrows the type to `string[]` on success.
 *
 * @returns ValidatorFn<string[]> - Validator function with type predicate
 */
export const isStringArray = isArray(isString);

/**
 * Factory function that creates a type guard validator for fixed-length string arrays.
 * Returns a ValidatorFn that narrows the type to a tuple of strings with exact length.
 *
 * @param len - The exact required length
 * @returns ValidatorFn<[string, string, ...]> - Validator function with tuple type predicate
 *
 * @example
 * const isTriplet = isStringArrayOfLength(3);
 * // Returns: (val: unknown) => val is [string, string, string]
 */
export const isStringArrayOfLength = <N extends number>(len: N) =>
  isArrayOfLength(isString, len);

/**
 * Factory function that creates a type guard validator for fixed-length uint8 arrays.
 * Returns a ValidatorFn that narrows the type to a tuple of numbers (0-255) with exact length.
 *
 * @param len - The exact required length
 * @returns ValidatorFn<[number, number, ...]> - Validator function with tuple type predicate
 *
 * @example
 * const isRGBTriple = isUint8Array(3);
 * // Returns: (val: unknown) => val is [number, number, number]
 */
export const isUint8Array = <N extends number>(len: N) =>
  isArrayOfLength(isUint8, len);
