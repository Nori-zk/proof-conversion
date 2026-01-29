import { guard, type ValidatorFn } from './core.js';
import type { AccumulatorRange, ExtractLength } from './types.js';

// ============================================================================
// PRIMITIVE GUARDS - No constraints, just type checking
// ============================================================================

export const isUndefined = guard(function isUndefined(
  val: unknown
): val is undefined {
  return val === undefined;
});

export const isNull = guard(function isNull(val: unknown): val is null {
  return val === null;
});

export const isString = guard(function isString(val: unknown): val is string {
  return typeof val === 'string';
});

export const isNumber = guard(function isNumber(val: unknown): val is number {
  return typeof val === 'number';
});

export const isBoolean = guard(function isBoolean(
  val: unknown
): val is boolean {
  return typeof val === 'boolean';
});

// ============================================================================
// BOUNDED NUMBER - With constraints
// ============================================================================

export interface NumberConstraints {
  min?: number;
  max?: number;
}

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
      printType: (c) => `(${c.min ?? '-∞'}..${c.max ?? '∞'})`,
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

// Helper for uint8 validation
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
      printType: (c) => `(${c.min ?? '-∞'}..${c.max ?? '∞'})`,
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
