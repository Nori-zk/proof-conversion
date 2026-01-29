import { ProofInputValidationError } from './ProofInputValidationError.js';
import { diagnose, type ValidatorFn } from './guards/core.js';

// ============================================================================
// SCHEMA TYPES
// ============================================================================

export type { ValidatorFn };

export interface SchemaObject {
  [key: string]: SchemaNode;
}

export type SchemaNode =
  | string
  | number
  | boolean
  | null
  | ValidatorFn
  | SchemaObject;

type InferSchemaType<S> = S extends (val: unknown) => val is infer T
  ? T
  : S extends object
    ? { [K in keyof S]: InferSchemaType<S[K]> }
    : S;

// ============================================================================
// ASSERT EXACT STRUCTURE - With diagnose for error messages
// ============================================================================

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

    if (typeof rule === 'function') {
      // Enhanced: Use diagnose for registered guards to get detailed error messages
      const diagnosticErrors = diagnose(rule, value, key);
      if (diagnosticErrors.length > 0) {
        // diagnose returns errors with full path, extract just the messages
        errors.push(
          ...diagnosticErrors.map((err) => {
            // Remove the path prefix since we're already in context
            return err.replace(new RegExp(`^${key}:\\s*`), `"${key}" `);
          })
        );
      }
    } else if (typeof rule === 'object' && rule !== null) {
      try {
        assertExactStructure(value, rule, key);
      } catch (e: unknown) {
        if (e instanceof ProofInputValidationError) {
          errors.push(
            e.message.replace(`${key} validation failed:\n- `, `in "${key}": `)
          );
        }
      }
    } else {
      // Exact value comparison for primitives (string, number, boolean, null)
      if (value !== rule) {
        errors.push(
          `"${key}" must be exactly ${JSON.stringify(rule)}, got ${JSON.stringify(value)}`
        );
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
