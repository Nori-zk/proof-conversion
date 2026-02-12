import { guard, type ValidatorFn } from './core.js';

// ============================================================================
// MODIFIER GUARDS - Wrapper functions that modify validator behavior
// ============================================================================

/**
 * Factory function that creates a type guard validator for optional fields.
 * Returns a ValidatorFn that narrows the type to `T | undefined` on success.
 *
 * The returned validator accepts either the validated type T or `undefined`.
 * Useful for optional fields in schemas.
 *
 * @param validatorFunction - The validator for the non-undefined case
 * @returns ValidatorFn<T | undefined> - Validator function with union type predicate
 *
 * @example
 * const isOptionalString = isOptionalField(isString);
 * // Returns: (val: unknown) => val is string | undefined
 *
 * if (isOptionalString(value)) {
 *   // value is narrowed to type: string | undefined
 * }
 */
export function isOptionalField<T>(
  validatorFunction: ValidatorFn<T>
): ValidatorFn<T | undefined> {
  return guard(function isOptionalField(val: unknown): val is T | undefined {
    return val === undefined ? true : validatorFunction(val);
  });
}
