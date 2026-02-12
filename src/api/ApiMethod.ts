import { ComputationalPlanExecutor } from '../compute/executor.js';
import { SchemaNode } from './validation/guards/index.js';

/**
 * Overload 1: ApiMethod with positional argument support (supportsArgs = true).
 *
 * Returns a decorator that adds a `fromArgs` function for converting ordered arguments into the input object.
 *
 * @param schema - Validation schema defining expected input structure
 * @param supportsArgs - Must be true for this overload
 * @param keys - Ordered array of input keys (must match schema keys in same order)
 * @returns Decorator that enhances API methods with schema and fromArgs converter
 *
 * @example
 * const decorator = ApiMethod(
 *   { proof: isProof, vk: isVK, publicInputs: isInputs },
 *   true,
 *   ['proof', 'vk', 'publicInputs'] as const
 * );
 *
 * const convert = decorator(async (executor, input) => {
 *   return { result: input.proof };
 * });
 *
 * // Convert positional args to input object
 * const input = convert.fromArgs(proofData, vkData, inputsData);
 * await convert(executor, input);
 */
export function ApiMethod<
  TInput,
  Schema extends { [K in keyof TInput]: SchemaNode },
  TKeys extends readonly (keyof TInput)[]
>(
  schema: Schema,
  supportsArgs: true,
  keys: TKeys
): <F extends (executor: ComputationalPlanExecutor, input: TInput) => Promise<object>>(
  fn: F
) => F & {
  fromArgs: ((...args: { [I in keyof TKeys]: TInput[TKeys[I] & keyof TInput] }) => TInput) & { keys: TKeys };
  schema: Schema;
};

/**
 * Overload 2: ApiMethod without argument support (supportsArgs = false).
 *
 * Returns a decorator that only attaches the schema, with fromArgs set to false.
 *
 * @param schema - Validation schema defining expected input structure
 * @param supportsArgs - Must be false for this overload
 * @param keys - Unused (should be undefined)
 * @returns Decorator that enhances API methods with schema only
 *
 * @example
 * const decorator = ApiMethod(
 *   { config: isConfig, options: isOptions },
 *   false
 * );
 *
 * const process = decorator(async (executor, input) => {
 *   return { result: input.config };
 * });
 *
 * // Must use object form, no fromArgs
 * await process(executor, { config: configData, options: optionsData });
 * console.log(process.fromArgs); // false
 */
export function ApiMethod<TInput, Schema extends { [K in keyof TInput]: SchemaNode }>(
  schema: Schema,
  supportsArgs: false,
  keys?: undefined
): <F extends (executor: ComputationalPlanExecutor, input: TInput) => Promise<object>>(
  fn: F
) => F & {
  fromArgs: false;
  schema: Schema;
};

/**
 * Implementation of ApiMethod that handles both overloads.
 *
 * Performs runtime validation when supportsArgs is true to ensure:
 * 1. keys parameter is provided
 * 2. keys array length matches schema keys length
 * 3. keys array elements match schema keys in the same order
 *
 * Creates a fromArgs function (when supportsArgs is true) that:
 * - Takes positional arguments in the order specified by keys
 * - Converts them to the typed input object
 * - Throws if any argument is undefined
 * - Includes a `keys` property with the key order
 *
 * @internal
 */
export function ApiMethod<
  TInput,
  Schema extends { [K in keyof TInput]: SchemaNode },
  TKeys extends readonly (keyof TInput)[] = readonly (keyof TInput)[]
>(
  schema: Schema,
  supportsArgs: boolean,
  keys?: TKeys
) {
  // Runtime validation: ensure keys match schema order when supportsArgs is true
  if (supportsArgs === true) {
    if (!keys) {
      throw new Error('keys parameter is required when supportsArgs is true');
    }

    const schemaKeysOrdered = Object.keys(schema);
    const keysArray = Array.from(keys as readonly (keyof TInput)[]);

    // Check length matches
    if (keysArray.length !== schemaKeysOrdered.length) {
      throw new Error(
        `Keys length mismatch: keys has ${keysArray.length} elements but schema has ${schemaKeysOrdered.length} keys`
      );
    }

    // Check each key matches in order
    for (let i = 0; i < keysArray.length; i++) {
      if (String(keysArray[i]) !== schemaKeysOrdered[i]) {
        throw new Error(
          `Key order mismatch at index ${i}: expected "${schemaKeysOrdered[i]}" but got "${String(keysArray[i])}". ` +
          `Keys must be in the same order as schema keys: [${schemaKeysOrdered.join(', ')}]`
        );
      }
    }
  }

  const schemaKeys = (supportsArgs ? keys : Object.keys(schema)) as (keyof TInput)[];

  // Args type as a proper tuple based on the ordered TKeys
  type Args = { [I in keyof TKeys]: TInput[TKeys[I] & keyof TInput] };

  // Type for fromArgs - can be function or false
  type FromArgsType = ((...args: Args) => TInput) | false;

  const fromArgs = (supportsArgs === false
    ? false
    : Object.assign(
        (...args: unknown[]) => {
          const input = {} as TInput;
          schemaKeys.forEach((k, i) => {
            const v = args[i];
            if (v === undefined)
              throw new Error(`Argument for "${String(k)}" is undefined`);
            input[k] = v as TInput[keyof TInput];
          });
          return input;
        },
        { keys: keys as readonly (keyof TInput)[] }
      )
  ) as FromArgsType;

  return function <
    F extends (
      executor: ComputationalPlanExecutor,
      input: TInput
    ) => Promise<object>,
  >(fn: F): F & { fromArgs: FromArgsType, schema: typeof schema } {
    return Object.assign(fn, { fromArgs, schema });
  };
}
