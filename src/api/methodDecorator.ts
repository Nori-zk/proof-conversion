import { ComputationalPlanExecutor } from '../compute/executor.js';
import { SchemaNode } from './validation/validation.js';

// Overload for supportsArgs = true
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

// Overload for supportsArgs = false
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

// Implementation
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
