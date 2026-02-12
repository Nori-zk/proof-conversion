# 03-02-2026

This PR integrates contributions from 0x471 enabling new proof format conversions (snarkjs and sp1 groth16), with comprehensive improvements to error handling, type safety, validation, and codebase quality across both TypeScript and Rust components.

# Major

- Removed logger from package exports and extracted logging functionality to separate npm package esm-iso-logger for better modularity
- Renamed Rust crate from pairing-utils to proof-conversion-utils to better reflect its broader scope beyond pairing operations.
- Removed custom SP1 type from TypeScript exports in favour of directly using the Rust type 'SP1ProofWithPublicValues' generated via Tsify, eliminating type duplication
- Renamed API/CLI methods from 'sp1ToPlonk' and 'risc0ToGroth16' to 'sp1Plonk' and 'risc0Groth16' for more concise naming that better reflects the proof system source format
- Renamed InvertedPromise to DeferredPromise for clearer naming convention
- Moved o1js from direct dependency to peer dependency, requiring downstream projects to provide their own o1js version, resolving version conflicts and improving package compatibility

# Feature

- Integrated Tsify to create type-safe WASM interface for proof-conversion-utils, automatically generating TypeScript type definitions from Rust structs (SnarkjsProof, SnarkjsVK, ProjectivePoint, ComplexProjectivePoint, etc.) and deduplicating previously mirrored types in the TypeScript library, ensuring type consistency between Rust and TypeScript at compile time.
- Used TypeScript utility types (Omit, Required) to derive proof format-specific types (Risc0Groth16Vk, Risc0Groth16Proof, etc.) from Tsify-generated O1js types, maintaining a single source of truth for groth16 structures while allowing format-specific field exclusions (e.g., excluding 'ic6' and 'alpha_beta' fields for risc0 verification keys).
- Integrated work from https://github.com/0x471 (snarkjs and sp1 groth16 proof conversion) - added improvements such that the work is wasm compatible, handles errors gracefully and was suitably factorised for exposure via the wasm interface. Added ArkworksGroth16 bundle format with verify logic as an intermediate representation for proof conversions.
- Added schema-based validation system with registry of composable type guards, diagnose function for type inspection of unknown objects that fail guards, and assertExactStructure function that validates unknown objects against schemas and narrows their TypeScript type on success (using assertion signatures). Includes guards for primitives (isString, isNumber), arrays (isArrayOfLength, isArrayOfBoundedLength), and cryptographic structures (isProjectivePoint, isComplexProjectivePoint). Validates exact structure matches, recursively checks nested objects, rejects unexpected keys, and provides detailed error messages with bracket path notation (e.g., `root["proof"]["pi_a"]["x"]`) for precise error localisation
- Integrated the validation system into the CLI and API methods with schema definitions for snarkjs, sp1, and risc0 proof formats, providing type-safe runtime validation with detailed diagnostic error messages
- Added Sp1Groth16ComputationalPlan and SnarkjsGroth16ComputationalPlan with corresponding schemas, API methods (using the ApiMethod decorator), and  CLI commands for converting SP1 and snarkjs proofs to o1js format
- Added safe(Result) panic-free curve validation functions (is_on_g1_curve_safe, is_on_g2_curve_safe) that manually check BN254 curve equations without panicking in WASM
- Added comprehensive documentation for both proof-conversion (main package README with updated CLI usage, API examples, and architecture overview) and proof-conversion-utils (Rust crate documentation with detailed module descriptions, type conversions, curve validation functions, WASM interface usage, and proof format specifications for SnarkJS, SP1, Risc0, gnark, o1js, and Arkworks formats)
- Added Rust tests for new proof format conversions including SnarkJS to O1jsGroth16 conversion, VK validation with public input count mismatch, direct proof/VK conversions, serialisation tests, and SP1 Groth16 conversions to verify proper handling of proof structures, verification keys, and public inputs.
- Exposed proof-conversion-utils WASM functions via TypeScript exports in camelCase (convertSnarkjsGroth16ToO1js, convertSp1Groth16ToO1js, computeAuxWitness, computePairing) for direct consumption by downstream TypeScript/JavaScript projects.

# Fix

- Refactored ApiMethod decorator to utilise new schema-based validation system and removed fromObject transformation method, aligning API method input types directly with computational plan input types for improved type safety and simpler data flow
- Added missing 'precompute' scripts to package.json for generating precomputed values required by the proof conversion pipeline (tower field operations, pairing computations, and recursion parameters)
- Refactored API-specific folders by organising proof format handlers into dedicated directories (src/api/snarkjs/, src/api/sp1/, src/api/risc0/) with co-located schemas, types, and method implementations for improved discoverability and maintainability
- Improved naming conventions across TypeScript codebase for consistency (camelCase for functions/variables, PascalCase for types/classes, descriptive names for proof format types like SP1ProofWithPublicValuesGroth16NoTee, Risc0Groth16Input, SnarkjsGroth16Input)
- Improved proof-conversion-utils Rust documentation with clearer module-level descriptions, enhanced function/type documentation with examples, improved error documentation for TryFrom implementations, and better explanation of coordinate systems (projective vs affine) and curve point representations
- Improved the style of code in proof-conversion-utils (Rust) to make it more idiomatic by implementing TryFrom traits for type conversions instead of ad-hoc conversion functions, using proper error propagation with Result types and ? operator throughout instead of unwrap/expect, extracting duplicated parsing logic into reusable methods (e.g., Field12::to_fq12()), adding comprehensive documentation with doc comments explaining coordinate systems and field structures, and making struct fields public where appropriate for WASM interface integration.
- Fixed proof-conversion-utils (Rust) wasm interface to use Results to permit JSErrors rather than panicking the runtime on every minor issue. Comprehensive panic elimination includes: removed all `.unwrap()` calls in conversion paths, added gnark error types (InvalidProofLength, InvalidVKLength), made assert_o1js_mlo and compute_aux_witness return Results, added safe point-at-infinity checks.
- Standardised error message notation in proof-conversion-utils (Rust) to use `->` arrows for building localised error context chains that trace failures through nested type conversions (e.g., `O1jsGroth16 -> SnarkjsVK/SnarkjsProof: proof: O1jsProof -> SnarkjsProof: pi_a: ProjectivePoint -> G1Affine: x: not a valid Fq`), pinpointing the exact conversion step and field where errors occur for improved debuggability.
- Migrated ESLint to v9 flat config format (Replace .eslintrc.cjs with eslint.config.js)
- Added stronger ESLint rules including stricter type checking, enforcement, unused variable detection, consistent import ordering, and additional code quality rules
- Fixed over 100 linting issues including unused variables, missing type annotations, inconsistent imports, improper error handling, and code style violations
- Removed all TypeScript 'any' types (solving no-explicit-any issues) from the codebase by adding proper type annotations, creating explicit type definitions for previously untyped objects, and using generics where appropriate to maintain type safety throughout
- Fixed Prettier configuration (holding off on project-wide application until post-merge to minimise line change noise in this PR)
- Completed NPM security audit and addressed all vulnerabilities by updating dependencies to patched versions and pinning most dependencies to exact versions (removing ^ and ~ ranges) to mitigate supply chain attacks and ensure reproducible builds
- Removed unused imports throughout the codebase across both TypeScript and Rust files, cleaning up dependency graphs and reducing bundle size

# Included PRS

- https://github.com/Nori-zk/proof-conversion/pull/9
- https://github.com/Nori-zk/proof-conversion/pull/11
- https://github.com/Nori-zk/proof-conversion/pull/13

# Outstanding

- Find a replacement for Gadgets.SHA256, Hash.SHA2_256 does not expose the necessary internals.
