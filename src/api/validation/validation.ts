import { ValidationError } from './ValidationError.js';
import {
  diagnose,
  type SchemaNode,
  type SchemaObject,
  type InferSchemaType,
} from './guards/index.js';

// ============================================================================
// ASSERT EXACT STRUCTURE - With diagnose for error messages
// ============================================================================

/**
 * Validates that an object exactly matches a schema definition.
 * Uses TypeScript assertion signature to narrow the type on success.
 *
 * This function:
 * 1. Checks that the value is an object (not array, null, or primitive)
 * 2. Validates all required keys are present
 * 3. Validates all values match their schema rules (validators or literals)
 * 4. Rejects any unexpected extra keys
 * 5. Recursively validates nested objects
 *
 * For validator functions (ValidatorFn), uses the diagnose function to provide
 * detailed path-aware error messages. For literal values, checks exact equality.
 *
 * @template S - The schema object type
 * @param obj - The value to validate
 * @param schema - The schema definition (object with validators, literals, or nested schemas)
 * @param context - Human-readable context for error messages (e.g., "Groth16 proof")
 * @param pathPrefix - Internal parameter for recursive path tracking
 * @throws {ValidationError} If validation fails, with detailed error messages
 *
 * @example
 * const schema = {
 *   name: isString,
 *   age: isNumber,
 *   role: "admin" // literal value
 * };
 *
 * assertExactStructure(data, schema, "User");
 * // After this line, data is narrowed to: { name: string; age: number; role: "admin" }
 */
export function assertExactStructure<S extends SchemaObject>(
  obj: unknown,
  schema: S,
  context: string,
  pathPrefix: string = ''
): asserts obj is InferSchemaType<S> {
  const errors: string[] = [];

  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    const path = pathPrefix || 'root';
    throw new ValidationError(`${path}: must be an object`);
  }

  const castObj = obj as Record<string, unknown>;
  const actualKeys = Object.keys(castObj);

  // Schemas at this level must be objects to have keys
  const castSchema = schema as Record<string, SchemaNode>;
  const expectedKeys = Object.keys(castSchema);

  for (const key of expectedKeys) {
    // Build path using bracket notation for consistency: root["key"]
    const currentPath = pathPrefix ? `${pathPrefix}["${key}"]` : key;

    const rule = castSchema[key];

    if (!(key in castObj)) {
      if (typeof rule === 'function' && rule(undefined)) continue;
      errors.push(`${currentPath}: missing required key`);
      continue;
    }
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
        if (e instanceof ValidationError) {
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
    throw new ValidationError(
      `${context} validation failed:\n${errors.join('\n')}`
    );
  }
}
