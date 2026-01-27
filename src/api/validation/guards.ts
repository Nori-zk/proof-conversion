import type {
  AffinePoint2d,
  ComplexAffinePoint2d,
  Field12,
  ProjectivePoint,
  ComplexProjectivePoint,
} from '@nori-zk/proof-conversion-pairing-utils';
import type { ValidatorFn } from './validation.js';

// Array helper guards ==================================================

/**
 * Creates a variable-length array validator.
 *
 * @example
 * const isStringArray = isArray(isString);
 * // Returns: (val: unknown) => val is string[]
 */
export const isArray = <T>(
  validatorFn: ValidatorFn<T>
): ValidatorFn<T[]> => {
  return (val: unknown): val is T[] =>
    Array.isArray(val) && val.every(validatorFn);
};

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
 * Creates a fixed-length array validator that returns a tuple type.
 *
 * @example
 * const isStringTriple = isArrayOfLength(isString, 3);
 * // Returns: (val: unknown) => val is [string, string, string]
 */
export const isArrayOfLength = <T, N extends number>(
  validatorFn: ValidatorFn<T>,
  len: N
) => {
  return (val: unknown): val is Tuple<T, N> =>
    Array.isArray(val) && val.length === len && val.every(validatorFn);
};

/**
 * Generic base type for building range unions.
 *
 * Recursively builds an accumulator from 0 to Max, including in result from Min to Max.
 * Used as the foundation for both `TupleUnion` and `NumberRange`.
 *
 * @returns Tuple<Elem, Min> | Tuple<Elem, Min+1> | ... | Tuple<Elem, Max>
 */
type AccumulatorRange<
  Min extends number,
  Max extends number,
  Elem,
  Acc extends Elem[] = [],
  Result = never
> = Acc['length'] extends Max
  ? Result | Acc
  : Acc['length'] extends number
    ? number extends Acc['length']
      ? never
      : (Min extends 0
          ? AccumulatorRange<Min, Max, Elem, [...Acc, Elem], Result | Acc>
          : Acc['length'] extends Min
            ? AccumulatorRange<Min, Max, Elem, [...Acc, Elem], Result | Acc>
            : Result extends never
              ? AccumulatorRange<Min, Max, Elem, [...Acc, Elem], never>
              : AccumulatorRange<Min, Max, Elem, [...Acc, Elem], Result | Acc>)
    : never;

/**
 * Helper type to create tuple unions for constrained arrays.
 *
 * @example
 * TupleUnion<string, 1, 3> = [string] | [string, string] | [string, string, string]
 */
type TupleUnion<T, Min extends number, Max extends number> =
  AccumulatorRange<Min, Max, T>;

/**
 * Creates an array validator with length constraints and union of tuple types.
 *
 * The return type is a union of all valid tuple lengths from minLength to maxLength.
 *
 * @example
 * const isSmallStringArray = isConstrainedArray(isString, { minLength: 1, maxLength: 3 });
 * // Returns: (val: unknown) => val is [string] | [string, string] | [string, string, string]
 */
export const isConstrainedArray = <
  T,
  Min extends number,
  Max extends number
>(
  validatorFn: ValidatorFn<T>,
  options:
    | { minLength: Min; maxLength?: Max }
    | { minLength?: Min; maxLength: Max }
): ValidatorFn<TupleUnion<T, Min, Max>> => {
  return (val: unknown): val is TupleUnion<T, Min, Max> => {
    if (!Array.isArray(val)) return false;
    if (options.minLength !== undefined && val.length < options.minLength)
      return false;
    if (options.maxLength !== undefined && val.length > options.maxLength)
      return false;
    return val.every(validatorFn);
  };
};

// Primitive guards =========================================================

/** Basic string type guard */
export const isString = (val: unknown): val is string =>
  typeof val === 'string';

/** Basic number type guard */
export const isNumber = (val: unknown): val is number =>
  typeof val === 'number';

/**
 * Creates a number validator with runtime min/max constraints.
 *
 * Returns a simple `number` type without literal type unions.
 * For small ranges with literal type unions, use `isConstrainedSmallNumber`.
 */
export const isConstrainedNumber =
  (
    options:
      | { min: number; max?: number }
      | { min?: number; max: number }
  ): ValidatorFn<number> =>
  (val: unknown): val is number => {
    if (typeof val !== 'number') return false;
    if (options.min !== undefined && val < options.min) return false;
    if (options.max !== undefined && val > options.max) return false;
    return true;
  };

/** Extract length from tuple type (distributes over unions) */
type ExtractLength<T> = T extends readonly unknown[] ? T['length'] : never;

/**
 * Helper type to generate union of literal numbers from Min to Max.
 *
 * @example
 * NumberRange<0, 3> = 0 | 1 | 2 | 3
 */
type NumberRange<Min extends number, Max extends number> =
  ExtractLength<AccumulatorRange<Min, Max, unknown>>;

/**
 * Creates a number validator with type-level literal unions for small ranges.
 *
 * Returns a union of exact number literals: `0 | 1 | 2 | ... | Max`.
 * Only use for small ranges (< 10) to avoid TypeScript performance issues.
 *
 * @example
 * const isSmallNumber = isConstrainedSmallNumber({ min: 0, max: 3 });
 * // Returns: (val: unknown) => val is 0 | 1 | 2 | 3
 */
export const isConstrainedSmallNumber = <
  Min extends number,
  Max extends number
>(
  options:
    | { min: Min; max?: Max }
    | { min?: Min; max: Max }
): ValidatorFn<NumberRange<Min, Max>> => {
  return (val: unknown): val is NumberRange<Min, Max> => {
    if (typeof val !== 'number') return false;
    if (options.min !== undefined && val < options.min) return false;
    if (options.max !== undefined && val > options.max) return false;
    return true;
  };
};

/** Validates uint8 values (0-255) - used by `isUint8Array` */
const isUint8 = isConstrainedNumber({ min: 0, max: 255 });

// Object guards ========================================================

/** Validates G1 affine point (2D with x, y coordinates) */
export const isAffinePoint2d = (val: unknown): val is AffinePoint2d => {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return 'x' in obj && 'y' in obj && isString(obj.x) && isString(obj.y);
};

/** Validates G2 affine point (2D with complex coordinates: x_c0, x_c1, y_c0, y_c1) */
export const isComplexAffinePoint2d = (
  val: unknown
): val is ComplexAffinePoint2d => {
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
};

/** Validates Fq12 field element (12 string components: g00-g21, h00-h21) */
export const isField12 = (val: unknown): val is Field12 => {
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
};

// Array guards =========================================================

/** Validates fixed-length array of uint8 values (0-255) */
export const isUint8Array = <N extends number>(len: N) =>
  isArrayOfLength(isUint8, len);

/** Validates variable-length array of numbers */
export const isNumberArray = isArray(isNumber);

/** Validates fixed-length array of strings */
export const isStringArray = <N extends number>(len: N) =>
  isArrayOfLength(isString, len);

/**
 * Validates G1 projective point: [x, y, z] where each is a string.
 *
 * Note: Uses explicit type predicate to match imported `ProjectivePoint` type exactly.
 * Cannot use `isStringArray(3)` because that would return `[string, string, string]`
 * instead of the imported `ProjectivePoint` type.
 */
export const isProjectivePoint = (val: unknown): val is ProjectivePoint =>
  Array.isArray(val) &&
  val.length === 3 &&
  val.every((v) => typeof v === 'string');

/**
 * Validates G2 projective point: [[x_c0, x_c1], [y_c0, y_c1], [z_c0, z_c1]].
 *
 * Note: Uses explicit type predicate to match imported `ComplexProjectivePoint` type exactly.
 * Cannot compose from primitives because TypeScript would infer structural type instead.
 */
export const isComplexProjectivePoint = (
  val: unknown
): val is ComplexProjectivePoint =>
  Array.isArray(val) &&
  val.length === 3 &&
  val.every(
    (sv) =>
      Array.isArray(sv) &&
      sv.length === 2 &&
      sv.every((v) => typeof v === 'string')
  );

// Modifier guards ======================================================

/**
 * Creates a validator that accepts either the validated type or `undefined`.
 *
 * Useful for optional fields in schemas.
 *
 * @example
 * const isOptionalString = isOptionalField(isString);
 * // Returns: (val: unknown) => val is string | undefined
 */
export function isOptionalField<T>(
  validatorFunction: ValidatorFn<T>
): ValidatorFn<T | undefined> {
  return function (val: unknown): val is T | undefined {
    return val === undefined ? true : validatorFunction(val);
  };
}
