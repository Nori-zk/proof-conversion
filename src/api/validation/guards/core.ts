// ============================================================================
// CORE TYPES & REGISTRY
// ============================================================================

/**
 * Type predicate function that validates a value and narrows its type.
 *
 * Returns true if the value matches type T, allowing TypeScript to narrow
 * the type in the calling scope. This is the foundation for all type guard validators.
 *
 * @template T - The type to validate and narrow to
 * @param val - The value to validate
 * @returns Type predicate indicating whether val is of type T
 *
 * @example
 * const isString: ValidatorFn<string> = (val): val is string => typeof val === 'string';
 * if (isString(value)) {
 *   // value is narrowed to type: string
 * }
 */
export type ValidatorFn<T = unknown> = (val: unknown) => val is T;

/**
 * Metadata associated with a registered type guard validator.
 * Includes validator name, optional inner validators for composite types,
 * and optional constraint data for bounded types.
 *
 * @template Options - The constraint type (never if no constraints)
 */
export type GuardMeta<Options = never> = {
  /** Display name of the validator (without "is" prefix) */
  name: string;
  /** Optional inner validator for composite types (arrays, objects) */
  inner?: ValidatorFn<unknown>;
} & ([Options] extends [never]
  ? { constraint?: never; printConstraint?: never; printDiagnosis?: never }
  : {
      /** Constraint data (e.g., min/max bounds) */
      constraint: Options;
      /** Function to format constraint for display */
      printConstraint: (data: Options) => string;
      /** Function to generate diagnostic message for failed validation */
      printDiagnosis: (data: Options, val: unknown) => string;
    });

/**
 * Internal storage type that can hold both constrained and unconstrained metadata.
 * Used by the guard registry to store metadata for all registered validators.
 */
type GuardMetaStorage = {
  name: string;
  inner?: ValidatorFn<unknown>;
  constraint?: unknown;
  printConstraint?: (data: unknown) => string;
  printDiagnosis?: (data: unknown, val: unknown) => string;
};

/**
 * Global registry mapping validator functions to their metadata.
 * Used by diagnostic and display functions to provide detailed error messages.
 */
const GUARD_REGISTRY = new Map<ValidatorFn<unknown>, GuardMetaStorage>();

/**
 * Retrieves metadata for a registered validator function.
 *
 * @template T - The validator's return type
 * @template O - The constraint type (defaults to never)
 * @param fn - The validator function to look up
 * @returns The validator's metadata, or undefined if not registered
 */
export const getMeta = <T, O = never>(
  fn: ValidatorFn<T>
): GuardMeta<O> | undefined =>
  GUARD_REGISTRY.get(fn as ValidatorFn<unknown>) as GuardMeta<O> | undefined;

// ============================================================================
// GUARD - Overloads for with/without constraints
// ============================================================================

/**
 * Registers a type guard validator function with metadata for diagnostic purposes.
 * This is the foundation for creating all type guard validators in the system.
 *
 * Two overloads:
 * 1. Simple guards (no constraints) - for primitives and simple structural types
 * 2. Constrained guards - for bounded types with validation constraints
 *
 * The function must be named (not anonymous) so the name can be extracted for diagnostics.
 *
 * @template T - The type the guard validates
 * @param fn - The validator function with type predicate
 * @param meta - Optional metadata (name, inner validators)
 * @returns The same validator function, now registered in the guard registry
 *
 * @example
 * // Simple guard
 * const isString = guard(function isString(val: unknown): val is string {
 *   return typeof val === 'string';
 * });
 */
export function guard<T>(
  fn: ValidatorFn<T>,
  meta?: {
    name?: string;
    inner?: ValidatorFn<unknown>;
  }
): ValidatorFn<T>;

/**
 * Registers a constrained type guard validator with diagnostic metadata.
 *
 * @template T - The type the guard validates
 * @template Options - The constraint type
 * @param fn - The validator function with type predicate
 * @param meta - Metadata including constraint, display, and diagnostic functions
 * @returns The same validator function, now registered in the guard registry
 *
 * @example
 * // Constrained guard
 * const isBounded = guard<number, { min: number }>(
 *   function isBounded(val: unknown): val is number {
 *     return typeof val === 'number' && val >= 0;
 *   },
 *   {
 *     constraint: { min: 0 },
 *     printConstraint: (c) => `(>=${c.min})`,
 *     printDiagnosis: (c, val) => `got ${val}, expected >= ${c.min}`
 *   }
 * );
 */
export function guard<T, Options>(
  fn: ValidatorFn<T>,
  meta: {
    name?: string;
    inner?: ValidatorFn<unknown>;
    constraint: Options;
    printConstraint: (data: Options) => string;
    printDiagnosis: (data: Options, val: unknown) => string;
  }
): ValidatorFn<T>;

// Implementation
export function guard<T, Options = never>(
  fn: ValidatorFn<T>,
  meta?: {
    name?: string;
    inner?: ValidatorFn<unknown>;
    constraint?: Options;
    printConstraint?: (data: Options) => string;
    printDiagnosis?: (data: Options, val: unknown) => string;
  }
): ValidatorFn<T> {
  if (!fn.name || fn.name === 'anonymous') {
    throw new TypeError(`Named function required: ${String(fn).slice(0, 50)}`);
  }

  const entry: GuardMetaStorage = {
    name: (meta?.name || fn.name).replace(/^is/, ''),
  };

  if (meta?.inner) {
    entry.inner = meta.inner;
  }

  if (meta?.constraint !== undefined) {
    entry.constraint = meta.constraint as unknown;
    entry.printConstraint = meta.printConstraint as (data: unknown) => string;
    entry.printDiagnosis = meta.printDiagnosis as (
      data: unknown,
      val: unknown
    ) => string;
  }

  GUARD_REGISTRY.set(fn as ValidatorFn<unknown>, entry);
  return fn;
}

// ============================================================================
// TYPE DISPLAY
// ============================================================================

/**
 * Generates a human-readable type name for a validator function.
 * Includes constraints and nested types in the output.
 *
 * @template T - The validator's return type
 * @param fn - The validator function
 * @returns A formatted string representing the full type (e.g., "Array<String>", "Number(0..255)")
 *
 * @example
 * getFullTypeName(isString) // "String"
 * getFullTypeName(isUint8) // "Number(0..255)"
 * getFullTypeName(isStringArray) // "Array<String>"
 */
export const getFullTypeName = <T>(fn: ValidatorFn<T>): string => {
  const meta = getMeta<T, unknown>(fn);
  if (!meta) return 'unknown';

  let display = meta.name;
  if (meta.printConstraint && meta.constraint !== undefined) {
    display += meta.printConstraint(meta.constraint);
  }
  if (meta.inner) {
    display += `<${getFullTypeName(meta.inner)}>`;
  }
  return display;
};

// ============================================================================
// IDENTIFICATION - Scans registry to identify value type
// ============================================================================

/**
 * Identifies the runtime type of a value using registered validators.
 * Returns a human-readable string describing the value's type structure.
 *
 * For primitives, tries to match against registered validators.
 * For arrays and objects, recursively identifies nested structure.
 *
 * @param val - The value to identify
 * @returns A string describing the value's type (e.g., "string", "[number, string]", "{x: string, y: number}")
 *
 * @example
 * identify("hello") // "string"
 * identify([1, 2, 3]) // "[number, number, number]"
 * identify({ x: "a", y: 5 }) // "{x: string, y: number}"
 */
export const identify = (val: unknown): string => {
  // Try to identify using registered validators (primitives only, no constraints)
  for (const [validator, meta] of GUARD_REGISTRY) {
    if (!meta.inner && !meta.constraint && validator(val)) {
      return meta.name;
    }
  }

  // Recurse into arrays to show element types
  if (Array.isArray(val)) {
    const elementTypes = val.map((elem) => identify(elem));
    return `[${elementTypes.join(', ')}]`;
  }

  // Recurse into objects to show property types
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const constructorName = obj.constructor?.name;
    if (constructorName && constructorName !== 'Object') {
      return constructorName;
    }
    const propTypes = Object.entries(obj)
      .map(([key, value]) => `${key}: ${identify(value)}`)
      .join(', ');
    return `{${propTypes}}`;
  }

  // Special cases last
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';

  // Final fallback for primitives
  return typeof val;
};

// ============================================================================
// DESCRIBE SCHEMA - Recursively describe expected schema structure
// ============================================================================

/**
 * Schema definition node - can be a literal, validator, or nested object.
 * Used to define expected structure for validation.
 */
export type SchemaNode =
  | string
  | number
  | boolean
  | null
  | ValidatorFn
  | { [key: string]: SchemaNode };

/**
 * Schema definition for object validation.
 * Maps property names to their expected types (validators, literals, or nested objects).
 * This is the object-specific variant of SchemaNode.
 */
export interface SchemaObject {
  [key: string]: SchemaNode;
}

/**
 * Infers the TypeScript type from a schema definition.
 * Recursively extracts types from validators and nested objects.
 *
 * @template S - The schema to infer from
 * @returns The inferred TypeScript type
 *
 * @example
 * const schema = { name: isString, age: isNumber };
 * type Person = InferSchemaType<typeof schema>; // { name: string; age: number }
 */
export type InferSchemaType<S> = S extends (val: unknown) => val is infer T
  ? T
  : S extends object
    ? { [K in keyof S]: InferSchemaType<S[K]> }
    : S;

/**
 * Human-readable schema description - the output of describeSchema.
 * Mirrors SchemaNode structure but with validators converted to type names.
 */
export type SchemaDescription =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SchemaDescription };

/**
 * Recursively converts a schema definition into a human-readable description.
 * Replaces validator functions with their type names while preserving structure.
 *
 * @param schema - The schema definition to describe
 * @returns A human-readable description of the schema structure
 *
 * @example
 * describeSchema({ x: isString, y: isNumber })
 * // Returns: { x: "String", y: "Number" }
 *
 * describeSchema({ items: isStringArray })
 * // Returns: { items: "Array<String>" }
 */
export const describeSchema = (schema: SchemaNode): SchemaDescription => {
  // Literal primitives
  if (typeof schema === 'string') return schema;
  if (typeof schema === 'number') return schema;
  if (typeof schema === 'boolean') return schema;
  if (schema === null) return null;

  // Validator function
  if (typeof schema === 'function') {
    return getFullTypeName(schema);
  }

  // Nested object schema
  if (typeof schema === 'object') {
    const result: { [key: string]: SchemaDescription } = {};
    for (const [key, value] of Object.entries(schema)) {
      result[key] = describeSchema(value);
    }
    return result;
  }

  return 'unknown';
};

// ============================================================================
// DIAGNOSE - Recursive with bespoke diagnostics and preserved path
// ============================================================================

/**
 * Recursively validates a value and collects detailed error messages.
 * Provides path-aware diagnostics showing exactly where and why validation failed.
 *
 * The function:
 * 1. Validates the value using the provided validator
 * 2. If validation fails, adds a detailed error message with path
 * 3. If validation passes but the type has inner validators (array/object elements),
 *    recursively validates nested values
 * 4. Returns all collected errors with proper indentation and context
 *
 * @template T - The expected type
 * @param fn - The validator function to use
 * @param val - The value to validate
 * @param path - The current path for error reporting (default: "value")
 * @param errors - Accumulated error messages (internal use)
 * @returns Array of error messages (empty if validation succeeds)
 *
 * @example
 * const validator = isArrayOfLength(isUint8, 3);
 * const errors = diagnose(validator, [1, 2, 300]);
 * // Returns: [
 * //   "value should have type Array[3]<Number(0..255)>",
 * //   "  value[2]: expected Number(0..255), got 300 which exceeds maximum 255"
 * // ]
 */
export const diagnose = <T>(
  fn: ValidatorFn<T>,
  val: unknown,
  path: string = 'value',
  errors: string[] = []
): string[] => {
  const meta = getMeta<T, unknown>(fn);

  // Check constraint (guard function checks type + bounds, not inner elements)
  if (!fn(val)) {
    // Constraint failed - add error with path information
    if (meta?.printDiagnosis && meta.constraint !== undefined) {
      errors.push(
        `${path}: expected ${getFullTypeName(fn)}, ${meta.printDiagnosis(meta.constraint, val)}`
      );
    } else {
      errors.push(
        `${path}: expected ${getFullTypeName(fn) || 'valid value'}, got ${identify(val)}`
      );
    }
    // Don't recurse if constraint failed
    return errors;
  }

  // Constraint passed - recurse into inner elements and collect all errors
  if (meta?.inner) {
    const elementErrorsBefore = errors.length;

    if (Array.isArray(val)) {
      // Recurse into array elements
      for (let i = 0; i < val.length; i++) {
        diagnose(meta.inner, val[i], `${path}[${i}]`, errors);
      }
    } else if (val && typeof val === 'object') {
      // Recurse into object properties (Object.entries works for both arrays and objects)
      for (const [key, value] of Object.entries(val)) {
        diagnose(meta.inner, value, `${path}.${key}`, errors);
      }
    }

    // If elements had errors, prepend parent type context and indent child errors
    if (errors.length > elementErrorsBefore) {
      // Indent all element errors
      for (let i = elementErrorsBefore; i < errors.length; i++) {
        errors[i] = `  ${errors[i]}`;
      }
      // Prepend parent type context
      errors.splice(
        elementErrorsBefore,
        0,
        `${path} should have type ${getFullTypeName(fn)}`
      );
    }
  }

  return errors;
};
