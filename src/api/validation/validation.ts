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

export function assertExactStructure(
  obj: unknown,
  schema: SchemaNode,
  context: string
): void {
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
