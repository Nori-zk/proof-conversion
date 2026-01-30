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
  context: string,
  pathPrefix: string = ''
): asserts obj is InferSchemaType<S> {
  const errors: string[] = [];

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    const path = pathPrefix || 'root';
    throw new ProofInputValidationError(`${path}: must be an object`);
  }

  const castObj = obj as Record<string, unknown>;
  const actualKeys = Object.keys(castObj);

  // Schemas at this level must be objects to have keys
  const castSchema = schema as Record<string, SchemaNode>;
  const expectedKeys = Object.keys(castSchema);

  for (const key of expectedKeys) {
    // Build path using bracket notation for consistency: root["key"]
    const currentPath = pathPrefix ? `${pathPrefix}["${key}"]` : key;

    if (!(key in castObj)) {
      errors.push(`${currentPath}: missing required key`);
      continue;
    }

    const rule = castSchema[key];
    const value = castObj[key];

    if (typeof rule === 'function') {
      // Use diagnose for registered guards - it already provides full path with consistent notation
      const diagnosticErrors = diagnose(rule, value, currentPath);
      if (diagnosticErrors.length > 0) {
        errors.push(...diagnosticErrors);
      }
    } else if (typeof rule === 'object' && rule !== null) {
      // Recursively validate nested objects, passing down the path
      try {
        assertExactStructure(value, rule, context, currentPath);
      } catch (e: unknown) {
        if (e instanceof ProofInputValidationError) {
          // Extract error lines (skip the context header line)
          const lines = e.message.split('\n');
          const errorLines = lines.filter(line => line.trim() && !line.includes('validation failed:'));
          errors.push(...errorLines);
        }
      }
    } else {
      // Exact value comparison for primitives (string, number, boolean, null)
      if (value !== rule) {
        errors.push(
          `${currentPath}: must be exactly ${JSON.stringify(rule)}, got ${JSON.stringify(value)}`
        );
      }
    }
  }

  for (const key of actualKeys) {
    if (!(key in castSchema)) {
      const currentPath = pathPrefix ? `${pathPrefix}["${key}"]` : key;
      errors.push(`${currentPath}: unexpected extra key`);
    }
  }

  if (errors.length > 0) {
    throw new ProofInputValidationError(
      `${context} validation failed:\n${errors.join('\n')}`
    );
  }
}
