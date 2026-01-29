// ============================================================================
// COMMON TYPE UTILITIES - Shared infrastructure for range-based types
// ============================================================================

/**
 * Generic base type for building range unions.
 *
 * Recursively builds an accumulator from 0 to Max, including in result from Min to Max.
 * Used as the foundation for both `TupleUnion` (arrays) and `NumberRange` (primitives).
 *
 * @returns Tuple<Elem, Min> | Tuple<Elem, Min+1> | ... | Tuple<Elem, Max>
 */
export type AccumulatorRange<
  Min extends number,
  Max extends number,
  Elem,
  Acc extends Elem[] = [],
  Result = never
> = Acc['length'] extends Max
  ? Result | Acc
  : Acc['length'] extends number
    ? number extends Acc['length']
      ? never
      : (Min extends 0
          ? AccumulatorRange<Min, Max, Elem, [...Acc, Elem], Result | Acc>
          : Acc['length'] extends Min
            ? AccumulatorRange<Min, Max, Elem, [...Acc, Elem], Result | Acc>
            : Result extends never
              ? AccumulatorRange<Min, Max, Elem, [...Acc, Elem], never>
              : AccumulatorRange<Min, Max, Elem, [...Acc, Elem], Result | Acc>)
    : never;

/** Extract length from tuple type (distributes over unions) */
export type ExtractLength<T> = T extends readonly unknown[] ? T['length'] : never;
