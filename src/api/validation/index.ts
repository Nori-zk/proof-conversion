/**
 * Core validation utilities and type guard system.
 *
 * Exports validation functions, error types, and all type guard validators.
 * Platform-specific validation (risc0, snarkjs, sp1) must be imported separately.
 */

export * from './guards/index.js';
export * from './validation.js';
export * from './ValidationError.js';
