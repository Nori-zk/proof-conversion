import { guard, type ValidatorFn } from './core.js';
import type { AccumulatorRange, ExtractLength } from './types.js';

// ============================================================================
// PRIMITIVE GUARDS - No constraints, just type checking
// ============================================================================

/**
 * Type guard validator that checks if a value is undefined.
 * Returns a ValidatorFn that narrows the type to `undefined` on success.
 *
 * @returns ValidatorFn<undefined> - Validator function with type predicate
 *
 * @example
 * const validator = isUndefined;
 * if (validator(value)) {
 *   // value is narrowed to type: undefined
 * }
 */
export const isUndefined = guard(function isUndefined(
  val: unknown
): val is undefined {
  return val === undefined;
});

/**
 * Type guard validator that checks if a value is null.
 * Returns a ValidatorFn that narrows the type to `null` on success.
 *
 * @returns ValidatorFn<null> - Validator function with type predicate
 *
 * @example
 * const validator = isNull;
 * if (validator(value)) {
 *   // value is narrowed to type: null
 * }
 */
export const isNull = guard(function isNull(val: unknown): val is null {
  return val === null;
});

/**
 * Type guard validator that checks if a value is a string.
 * Returns a ValidatorFn that narrows the type to `string` on success.
 *
 * @returns ValidatorFn<string> - Validator function with type predicate
 *
 * @example
 * const validator = isString;
 * if (validator(value)) {
 *   // value is narrowed to type: string
 *   const length = value.length;
 * }
 */
export const isString = guard(function isString(val: unknown): val is string {
  return typeof val === 'string';
});

/**
 * Type guard validator that checks if a value is a number.
 * Returns a ValidatorFn that narrows the type to `number` on success.
 *
 * @returns ValidatorFn<number> - Validator function with type predicate
 *
 * @example
 * const validator = isNumber;
 * if (validator(value)) {
 *   // value is narrowed to type: number
 *   const doubled = value * 2;
 * }
 */
export const isNumber = guard(function isNumber(val: unknown): val is number {
  return typeof val === 'number';
});

/**
 * Type guard validator that checks if a value is a boolean.
 * Returns a ValidatorFn that narrows the type to `boolean` on success.
 *
 * @returns ValidatorFn<boolean> - Validator function with type predicate
 *
 * @example
 * const validator = isBoolean;
 * if (validator(value)) {
 *   // value is narrowed to type: boolean
 *   const negated = !value;
 * }
 */
export const isBoolean = guard(function isBoolean(
  val: unknown
): val is boolean {
  return typeof val === 'boolean';
});

// ============================================================================
// BOUNDED NUMBER - With constraints
// ============================================================================

/**
 * Constraints for bounded number validation.
 * At least one of min or max should be specified for meaningful bounds.
 */
export interface NumberConstraints {
  /** Minimum allowed value (inclusive) */
  min?: number;
  /** Maximum allowed value (inclusive) */
  max?: number;
}

/**
 * Factory function that creates a type guard validator for bounded numbers.
 * Returns a ValidatorFn that narrows the type to `number` and validates range constraints.
 *
 * The returned validator checks that a value is a number and optionally within specified bounds.
 * Provides detailed diagnostic messages for validation failures.
 *
 * @param constraint - Min/max bounds for the number
 * @returns ValidatorFn<number> - Validator function with type predicate and constraint info
 *
 * @example
 * const isPositive = isBoundedNumber({ min: 0 });
 * const isPercentage = isBoundedNumber({ min: 0, max: 100 });
 *
 * if (isPositive(value)) {
 *   // value is narrowed to type: number (and >= 0 at runtime)
 * }
 */
export const isBoundedNumber = (
  constraint: NumberConstraints
): ValidatorFn<number> =>
  guard<number, NumberConstraints>(
    function isBoundedNumber(val: unknown): val is number {
      if (typeof val !== 'number') return false;
      if (constraint.min !== undefined && val < constraint.min) return false;
      if (constraint.max !== undefined && val > constraint.max) return false;
      return true;
    },
    {
      constraint,
      printConstraint: (c) => `(${c.min ?? '-∞'}..${c.max ?? '∞'})`,
      printDiagnosis: (c, val) => {
        if (typeof val !== 'number')
          return `got ${val === null ? 'null' : Array.isArray(val) ? `Array[${val.length}]` : typeof val}`;
        if (c.min !== undefined && val < c.min)
          return `got ${val} which is below minimum ${c.min}`;
        if (c.max !== undefined && val > c.max)
          return `got ${val} which exceeds maximum ${c.max}`;
        return `got ${val}`;
      },
    }
  );

/**
 * Type guard validator for uint8 (unsigned 8-bit integer).
 * Returns a ValidatorFn that narrows the type to `number` and validates 0..255 range.
 *
 * @returns ValidatorFn<number> - Validator function for numbers in range [0, 255]
 *
 * @example
 * const validator = isUint8;
 * if (validator(value)) {
 *   // value is narrowed to type: number (and 0..255 at runtime)
 * }
 */
export const isUint8 = isBoundedNumber({ min: 0, max: 255 });

// ============================================================================
// BOUNDED NUMBER UNION - With type-level literal unions
// ============================================================================

/**
 * Helper type to generate union of literal numbers from Min to Max.
 *
 * @example
 * NumberRange<0, 3> = 0 | 1 | 2 | 3
 */
type NumberRange<Min extends number, Max extends number> = ExtractLength<
  AccumulatorRange<Min, Max, unknown>
>;

/**
 * Creates a number validator with type-level literal unions for small ranges.
 *
 * Returns a union of exact number literals: `0 | 1 | 2 | ... | Max`.
 * Only use for small ranges (< 10) to avoid TypeScript issues.
 *
 * @example
 * const isSmallNumber = isBoundedNumberUnion({ min: 0, max: 3 });
 * // Returns: (val: unknown) => val is 0 | 1 | 2 | 3
 */
export const isBoundedNumberUnion = <Min extends number, Max extends number>(
  options: { min: Min; max?: Max } | { min?: Min; max: Max }
): ValidatorFn<NumberRange<Min, Max>> =>
  guard<NumberRange<Min, Max>, { min?: number; max?: number }>(
    function isBoundedNumberUnion(val: unknown): val is NumberRange<Min, Max> {
      if (typeof val !== 'number') return false;
      if (options.min !== undefined && val < options.min) return false;
      if (options.max !== undefined && val > options.max) return false;
      return true;
    },
    {
      constraint: options,
      printConstraint: (c) => `(${c.min ?? '-∞'}..${c.max ?? '∞'})`,
      printDiagnosis: (c, val) => {
        if (typeof val !== 'number')
          return `got ${val === null ? 'null' : Array.isArray(val) ? `Array[${val.length}]` : typeof val}`;
        if (c.min !== undefined && val < c.min)
          return `got ${val} which is below minimum ${c.min}`;
        if (c.max !== undefined && val > c.max)
          return `got ${val} which exceeds maximum ${c.max}`;
        return `got ${val}`;
      },
    }
  );
