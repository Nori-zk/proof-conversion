import type {
  AffinePoint2d,
  ComplexAffinePoint2d,
  Field12,
  ProjectivePoint,
  ComplexProjectivePoint,
} from '@nori-zk/proof-conversion-pairing-utils';
import type { ValidatorFn } from './validation.js';

type Tuple<T, N extends number, Acc extends T[] = []> = Acc['length'] extends N
  ? Acc
  : Tuple<T, N, [...Acc, T]>;

export const isStringArray =
  <N extends number>(len: N) =>
  (val: unknown): val is Tuple<string, N> =>
    Array.isArray(val) &&
    val.length === len &&
    val.every((v) => typeof v === 'string');

export const isString = (val: unknown): val is string =>
  typeof val === 'string';

export const isNumber = (val: unknown): val is number =>
  typeof val === 'number';

// Generic array validator that preserves type inference
export const isArray = <T>(
  validatorFn: ValidatorFn<T>
): ValidatorFn<T[]> => {
  return (val: unknown): val is T[] =>
    Array.isArray(val) && val.every(validatorFn);
};

// Generic array-of-length validator that preserves tuple type inference
export const isArrayOfLength = <T, N extends number>(
  validatorFn: ValidatorFn<T>,
  len: N
) => {
  return (val: unknown): val is Tuple<T, N> =>
    Array.isArray(val) && val.length === len && val.every(validatorFn);
};

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

// Generic base type for building range unions
// Recursively builds accumulator from 0 to Max, including in result from Min to Max
// Returns: Tuple<Elem, Min> | Tuple<Elem, Min+1> | ... | Tuple<Elem, Max>
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

// Extract length from tuple type (distributes over unions)
type ExtractLength<T> = T extends readonly unknown[] ? T['length'] : never;

// Helper type to generate union of literal numbers from Min to Max
// e.g., NumberRange<0, 3> = 0 | 1 | 2 | 3
type NumberRange<Min extends number, Max extends number> =
  ExtractLength<AccumulatorRange<Min, Max, unknown>>;

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

// Helper type to create tuple unions for constrained arrays
// Generates: Tuple<T, Min> | Tuple<T, Min+1> | ... | Tuple<T, Max>
type TupleUnion<T, Min extends number, Max extends number> =
  AccumulatorRange<Min, Max, T>;

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

const isUint8 = isConstrainedNumber({ min: 0, max: 255 });

export const isUint8Array = <N extends number>(len: N) =>
  isArrayOfLength(isUint8, len);

export const isNumberArray = isArray(isNumber);

export const isAffinePoint2d = (val: unknown): val is AffinePoint2d => {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return 'x' in obj && 'y' in obj && isString(obj.x) && isString(obj.y);
};

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

export const isProjectivePoint = (val: unknown): val is ProjectivePoint =>
  Array.isArray(val) &&
  val.length === 3 &&
  val.every((v) => typeof v === 'string');

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

export function isOptionalField<T>(
  validatorFunction: ValidatorFn<T>
): ValidatorFn<T | undefined> {
  return function (val: unknown): val is T | undefined {
    return val === undefined ? true : validatorFunction(val);
  };
}
