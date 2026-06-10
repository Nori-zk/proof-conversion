import { isOptionalField } from "./modifiers.js";
import { isString } from "./primitives.js";

/**
 * Type guard validator for optional strings.
 * Returns a ValidatorFn that narrows the type to `string | undefined` on success.
 *
 * @returns ValidatorFn<string | undefined> - Validator function for string or undefined values
 *
 * @example
 * const validator = isOptionalString;
 * if (validator(value)) {
 *   // value is narrowed to type: string | undefined
 * }
 */
export const isOptionalString = isOptionalField(isString);