import { ProofInputValidationError } from './ProofInputValidationError.js';

export type ValidatorFn<T = unknown> = (val: unknown) => val is T;

export interface SchemaObject {
  [key: string]: SchemaNode;
}

type SchemaNode =
  | boolean
  | null
  | ValidatorFn
  | SchemaObject;

type InferSchemaType<S> =
  S extends (val: unknown) => val is infer T
    ? T
    : S extends null
      ? null
      : S extends boolean
        ? boolean
        : S extends object
          ? { [K in keyof S]: InferSchemaType<S[K]> }
          : never;

export function assertExactStructure<S extends SchemaObject>(
  obj: unknown,
  schema: S,
  context: string
): asserts obj is InferSchemaType<S> {
  const errors: string[] = [];

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    throw new ProofInputValidationError(`${context} must be an object.`);
  }

  const castObj = obj as Record<string, unknown>;
  const actualKeys = Object.keys(castObj);

  // Schemas at this level must be objects to have keys
  const castSchema = schema as Record<string, SchemaNode>;
  const expectedKeys = Object.keys(castSchema);

  for (const key of expectedKeys) {
    if (!(key in castObj)) {
      errors.push(`missing required key: "${key}"`);
      continue;
    }

    const rule = castSchema[key];
    const value = castObj[key];

    if (rule === null) {
      if (value !== null) errors.push(`"${key}" must be null`);
    } else if (typeof rule === 'function') {
      if (!rule(value)) errors.push(`"${key}" failed type/length validation`);
    } else if (typeof rule === 'object') {
      try {
        assertExactStructure(value, rule, key);
      } catch (e: unknown) {
        if (e instanceof ProofInputValidationError) {
          errors.push(
            e.message.replace(`${key} validation failed:\n- `, `in "${key}": `)
          );
        }
      }
    }
  }

  for (const key of actualKeys) {
    if (!(key in castSchema)) {
      errors.push(`unexpected extra key: "${key}"`);
    }
  }

  if (errors.length > 0) {
    throw new ProofInputValidationError(
      `${context} validation failed:\n- ${errors.join('\n- ')}`
    );
  }
}
