// ============================================================================
// CORE TYPES & REGISTRY
// ============================================================================

export type ValidatorFn<T = unknown> = (val: unknown) => val is T;

// Constraint-based metadata with optional constraint data
export type GuardMeta<Options = never> = {
  name: string;
  inner?: ValidatorFn<unknown>;
} & ([Options] extends [never]
  ? { constraint?: never; printType?: never; printDiagnosis?: never }
  : {
      constraint: Options;
      printType: (data: Options) => string;
      printDiagnosis: (data: Options, val: unknown) => string;
    });

// Internal storage type that can hold both constrained and unconstrained metadata
type GuardMetaStorage = {
  name: string;
  inner?: ValidatorFn<unknown>;
  constraint?: unknown;
  printType?: (data: unknown) => string;
  printDiagnosis?: (data: unknown, val: unknown) => string;
};

const GUARD_REGISTRY = new Map<ValidatorFn<unknown>, GuardMetaStorage>();

export const getMeta = <T, O = never>(
  fn: ValidatorFn<T>
): GuardMeta<O> | undefined =>
  GUARD_REGISTRY.get(fn as ValidatorFn<unknown>) as GuardMeta<O> | undefined;

// ============================================================================
// GUARD - Overloads for with/without constraints
// ============================================================================

// Overload 1: No constraints (primitives and objects)
export function guard<T>(
  fn: ValidatorFn<T>,
  meta?: {
    name?: string;
    inner?: ValidatorFn<unknown>;
  }
): ValidatorFn<T>;

// Overload 2: With constraints (bounded types)
export function guard<T, Options>(
  fn: ValidatorFn<T>,
  meta: {
    name?: string;
    inner?: ValidatorFn<unknown>;
    constraint: Options;
    printType: (data: Options) => string;
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
    printType?: (data: Options) => string;
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
    entry.printType = meta.printType as (data: unknown) => string;
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

export const getFullTypeName = <T>(fn: ValidatorFn<T>): string => {
  const meta = getMeta<T, unknown>(fn);
  if (!meta) return 'unknown';

  let display = meta.name;
  if (meta.printType && meta.constraint !== undefined) {
    display += meta.printType(meta.constraint);
  }
  if (meta.inner) {
    display += `<${getFullTypeName(meta.inner)}>`;
  }
  return display;
};

// ============================================================================
// IDENTIFICATION - Scans registry to identify value type
// ============================================================================

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

export type SchemaNode =
  | string
  | number
  | boolean
  | null
  | ValidatorFn
  | { [key: string]: SchemaNode };

export type SchemaDescription =
  | string
  | number
  | boolean
  | null
  | { [key: string]: SchemaDescription };

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
  }

  return errors;
};
