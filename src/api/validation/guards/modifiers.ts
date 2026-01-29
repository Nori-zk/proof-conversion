import { guard, type ValidatorFn } from './core.js';

// ============================================================================
// MODIFIER GUARDS - Wrapper functions that modify validator behavior
// ============================================================================

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
  return guard(function isOptionalField(val: unknown): val is T | undefined {
    return val === undefined ? true : validatorFunction(val);
  });
}
