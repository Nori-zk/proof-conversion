import { ComputationalPlanExecutor } from '../compute/executor.js';

export function ApiMethod<
  TInput,
  TKeys extends readonly (keyof TInput)[] | false = false,
  TObject extends object = any
>(
  keys: TKeys,
  fromObject: (obj: TObject) => TInput,
  objMetadata: readonly (keyof TObject)[]
) {
  // Args type only if keys is not false
  type Args = TKeys extends readonly (keyof TInput)[]
    ? { [I in keyof TKeys]: TInput[TKeys[I] & keyof TInput] }
    : never;

  // Build from args or false (disabled)
  const fromArgs = (() => {
    if (keys === false)
      return false as TKeys extends readonly (keyof TInput)[]
        ? (...args: Args) => TInput
        : false;

    return ((...args: any[]) => {
      // runtime guard
      if (!Array.isArray(keys))
        throw new Error('keys must be an array when args-mode enabled');

      if (args.length !== keys.length) {
        throw new Error(
          `Expected ${keys.length} arguments, but got ${args.length}`
        );
      }

      const input = {} as TInput;
      keys.forEach((k, i) => {
        const v = args[i];
        if (v === undefined)
          throw new Error(`Argument for "${String(k)}" is undefined`);
        // safe assignment: key is keyof TInput by constraint
        (input as any)[k] = v;
      });

      return input;
    }) as TKeys extends readonly (keyof TInput)[]
      ? (...args: Args) => TInput
      : false;
  })();

  // fromObject with validation against objMetadata
  const fromObj = (obj: TObject): TInput => {
    for (const k of objMetadata) {
      if (!(k in obj))
        throw new Error(`Object is missing expected key "${String(k)}"`);
    }
    return fromObject(obj);
  };

  return function <
    F extends (
      executor: ComputationalPlanExecutor,
      input: TInput
    ) => Promise<any>
  >(
    fn: F
  ): F & {
    fromArgs: TKeys extends readonly (keyof TInput)[]
      ? (...args: Args) => TInput
      : false;
    fromObject: (obj: TObject) => TInput;
    argsMetadata: TKeys;
    objMetadata: readonly (keyof TObject)[];
  } {
    return Object.assign(fn, {
      fromArgs,
      fromObject: fromObj,
      argsMetadata: keys,
      objMetadata,
    });
  };
}
