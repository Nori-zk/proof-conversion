# 18/5/26 - Audit B1114: Disabled layer1 subtrees unconstrained, allowing forgery of SP1 PLONK public inputs

## Finding (verbatim)

Finding b1114: `layer1` does not constrain disabled subtrees to act as identity, allowing forgery of the SP1 PLONK public inputs

The layer1 circuit allows to skip verification of one or both of the two proofs, which is needed because the SP1 Plonk verifier has 24 steps, which is not a power of two. The subtreeVkDigest commits to which proofs where skipped and this is exposed upwards, so if this is pinned at the top, then an attacker can't change where proof verification is skipped. However, the standard SP1 Plonk path will have layer1 proofs 0 through 11 with both proofs verified (verifyLeft = verifyRight = True), while proofs 12 through 15 will have both proofs skipped (verifyLeft = verifyRight = False).

If a proof is skipped, there is no constraint linking the output of that proof to the input. For the mentioned layer1 proofs 12 through 15 for SP1 Plonk, this means the rightOut public output will be choosable arbitrarily by the prover.

As the dummy proofs come after the real ones, this means that going up the tree, the attacker can ultimately choose the top level rightOut arbitrarily.

In the SP1 Plonk case, that rightOut is interpreted as the Poseidon hash of the pi0 and pi1 of the underlying Plonk proof, containing the hash of the vkey identifying the user program (e.g. helios) and the digest of the public values that program exposed during its run. These can thus be modified arbitrarily by the attacker.

The attacker can thus use some arbitrary correct SP1 Plonk proof for any program, then change the first public value to the expected nori-bridge-header related value, and the second public value to one reflecting a fake update that allows them to mint illegitimately.

To fix this, you must constrain that piLeft.publicInput is equal to piLeft.publicOutput if verifyLeft is false, and analogously for piRight.

## Response

The finding is acknowledged. The vulnerability is isolated to the SP1 PLONK path. The Groth16 path uses 16 base zkps (a power of two), so all layer1 nodes have both sides verified and the issue does not apply. The `layer1` circuit (`src/compressor/layer1node.ts`) uses `verifyIf` for conditional verification, but when verification is skipped the proof's `publicInput` and `publicOutput` are completely unconstrained - the prover can supply arbitrary values via dummy `DynamicProof` instances. The higher-layer `node` circuit (`src/compressor/compressor.ts`) always calls `.verify()` unconditionally and is not affected.

The codebase originated from [o1js-blobstream](https://github.com/geometers/o1js-blobstream) which was built for Groth16 with a power-of-two number of circuits. When the PLONK path was added (24 steps, padded to 32), the same power-of-two padding approach was reused without adding identity constraints for the disabled subtrees.

## Discussion

The original author of the compressor (from o1js-blobstream) confirmed the issue and noted there is fundamentally no need for powers of two - it was done for easier implementation at the time. The Groth16 path happened to have a power-of-two count and was never exposed. When PLONK was added the padding was reused without considering that unconstrained dummy proofs at layer1 would allow the prover to choose arbitrary public outputs that propagate up the tree.

The `node` circuit at layers 2-5 always verifies unconditionally, so the vulnerability window is limited to layer1 dummy pairs (indices 12-15 in the standard SP1 PLONK configuration). The `subtreeVkDigest` Poseidon chain commits to which VKs were used (or `NOTHING_UP_MY_SLEEVE` for skipped sides), but this only prevents an attacker from changing *which* proofs are skipped - it does not constrain the *values* flowing through disabled subtrees.

### Commit 1 - Test exposure of the missing identity constraint

- **Regression tests** (`src/compressor/b1114_regression.spec.ts`): added `both sides disabled must reject non-identity dummy proofs`, `left disabled must reject piLeft.publicInput != piLeft.publicOutput`, and `right disabled must reject piRight.publicInput != piRight.publicOutput`. Each test compiles the `layer1` ZkProgram, creates dummy `ZkpProofLeft`/`ZkpProofRight` with attacker-chosen public IO values (A=111, M=222, C=333), attempts to produce a layer1 proof with one or both sides disabled (`verifyLeft`/`verifyRight` = `Bool(false)`), and expects proof generation to be rejected. On unpatched code proof generation succeeds when it should not, causing all three tests to fail.
- **Jest runner** (`package.json`): added `test:jest` script using `--experimental-vm-modules` for o1js ESM compatibility.

Run: `npm run test:jest -- src/compressor/b1114_regression.spec.ts`

Results:

- Regression tests: 3 fail, 0 pass. All three tests resolve instead of rejecting, confirming that `layer1.compute` accepts non-identity dummy proofs and the vulnerability is present.

### Commit 2 - Fix applied

- **`src/compressor/layer1node.ts`**: added two identity constraints after `verifyIf` calls (lines 49-55). `piLeft.publicInput.equals(piLeft.publicOutput).or(verifyLeft).assertTrue()` and the analogous constraint for the right side. When a side is verified (`verify* = true`), the `.or` passes unconditionally. When a side is disabled (`verify* = false`), the prover must supply `publicInput == publicOutput`, forcing the disabled subtree to act as identity.

Results:

- Regression tests: 3 pass, 0 fail. `layer1.compute` now rejects non-identity dummy proofs at proof generation time with a constraint unsatisfied error.

# 16-04-2026

SP1 v6.0.1 → v6.1.0 emergency upgrade

SP1 shipped an emergency release v6.1.0. The verifying keys were regenerated (new `groth16_vk.bin` / `plonk_vk.bin` / `verifier_vks.bin`) and the PLONK VK binary layout changed in `crates/verifier/src/plonk/converter.rs`: SRS padding grew by 4 bytes (`33788` → `33792`) and `num_commitment_constraint_indexes` is now a `u32` (4 bytes) instead of a `u64` (8 bytes). Our PLONK VK extractor mirrored the old layout and had to be patched. Versioned artifact filenames were also moved to the full `vMAJOR.MINOR.PATCH` form so the name reflects which SP1 release produced the bytes.

## proof-conversion-utils (pairing-utils)

### Changed

- **`pairing-utils/Cargo.toml`**: `sp1-sdk` and `sp1-verifier` bumped from `6.0.1` to `6.1.0`
- **`pairing-utils/src/bin/save_plonk_vk_json.rs`**: PLONK VK layout updated for v6.1.0 — SRS padding `33788` → `33792`; `num_commitment_constraint_indexes` read as `u32` (4 bytes) instead of `u64` (8 bytes); output path renamed from `plonk_vk_v6.0.0.json` to `plonk_vk_sp1_v6.1.0.json`
- **`pairing-utils/src/bin/save_sp1_groth16_bin.rs`**: Output path renamed from `sp1_v6_groth16_vk.bin` to `sp1_v6.1.0_groth16_vk.bin`
- **`pairing-utils/src/gnark.rs`**: `GROTH16_VK_6_0_0_BYTES` renamed to `GROTH16_VK_6_1_0_BYTES`; `include_bytes!` path updated to `sp1_v6.1.0_groth16_vk.bin`
- **`pairing-utils/src/bin/convert_from_sp1_groth16.rs`**: `GROTH16_VK_6_0_0_BYTES` renamed to `GROTH16_VK_6_1_0_BYTES`; `include_bytes!` path and console logging updated to v6.1.0
- **`pairing-utils/src/arkworks.rs`**: Constant usage, import, doc comments, and error messages updated from v6.0.0 to v6.1.0
- **`pairing-utils/src/wasm.rs`**: Doc comments updated from v6.0.0 to v6.1.0 VK references
- **`pairing-utils/src/sp1.rs`**: `bytes()` doc URL pin updated from `sp1/blob/v6.0.1/...` to `sp1/blob/v6.1.0/...`
- **`pairing-utils/README.NPM.md`**: v6.0.0 VK references updated to v6.1.0 throughout

### Added

- **`pairing-utils/sp1_v6.1.0_groth16_vk.bin`**: Regenerated SP1 v6.1.0 Groth16 verification key binary (492 bytes, differs from v6.0.1 bytes); produced by `save_sp1_groth16_bin`, consumed by `gnark.rs` at compile time
- **`src/plonk/plonk_vk_sp1_v6.1.0.json`**: Regenerated v6.1.0 PLONK verification key; produced by the patched `save_plonk_vk_json` against the new v6.1.0 VK bytes and new binary layout

---

## PLONK

### Changed

- **`src/plonk/vk.ts`**: JSON import switched from `./plonk_vk_v6.0.0.json` to `./plonk_vk_sp1_v6.1.0.json`

---

## Example proofs

Regenerated example proofs against SP1 v6.1.0.

### Changed

- **`pairing-utils/src/arkworks.rs`**: test fixture path updated from `sp1_groth16_obj_v6.json` to `sp1_groth16_obj_v6.1.0.json`
- **`pairing-utils/src/sp1.rs`**: test fixture path updated from `sp1_groth16_obj_v6.json` to `sp1_groth16_obj_v6.1.0.json`
- **`README.md`**: CLI examples for `sp1Plonk` and `sp1Groth16` updated to reference `sp1_plonk_obj_v6.1.0.json` and `sp1_groth16_obj_v6.1.0.json`

### Added

- **`example-proofs/sp1_plonk_obj_v6.1.0.json`**: regenerated SP1 v6.1.0 PLONK proof object
- **`example-proofs/sp1_groth16_obj_v6.1.0.json`**: regenerated SP1 v6.1.0 Groth16 proof object

### Removed

- **`example-proofs/sp1_plonk_obj_v6.json`** and **`example-proofs/sp1_groth16_obj_v6.json`**: superseded by the v6.1.0 regenerations above

---

# 24-02-2026

SP1 v6 PLONK and Groth16 Support

## proof-conversion-utils (pairing-utils)

The Rust crate is the source of truth for SP1 VK artifacts and proof byte parsing. All TypeScript changes in the PLONK and Groth16 sections below depend on outputs produced here.

### Changed

- **`pairing-utils/Cargo.toml`**: `sp1-sdk` bumped from `5.0.0` to `6.0.1`; `sp1-verifier = "6.0.1"` added as a non-wasm dependency (provides `PLONK_VK_BYTES` and `GROTH16_VK_BYTES` for the new VK extraction binaries); `save_sp1_groth16_bin` and `save_plonk_vk_json` registered as new `[[bin]]` targets
- **`pairing-utils/src/sp1.rs`**: `public_inputs` array size updated from `[String; 2]` to `[String; 5]` for both `Groth16Bn254Proof` and `PlonkBn254Proof`; added `Sp1PlonkVk` struct (serialisable, all field elements as decimal strings) consumed by `save_plonk_vk_json`; `bytes()` doc updated to describe v5 vs v6 `encoded_proof` layout difference (v6 prepends a 96-byte gnark calldata prefix before the proof points)
- **`pairing-utils/src/gnark.rs`**: `GROTH16_VK_5_0_0_BYTES` renamed to `GROTH16_VK_6_0_0_BYTES`; embedded binary updated to `sp1_v6_groth16_vk.bin`
- **`pairing-utils/src/arkworks.rs`**: Switched from `encoded_proof` with 4-byte skip to `raw_proof` for proof byte extraction; v6 `encoded_proof` has a 96-byte calldata prefix so `raw_proof` (which starts directly with A, B, C points) is used instead; VK updated to v6; test updated to use `sp1_groth16_obj_v6.json` and assert 5 public inputs
- **`pairing-utils/src/o1js.rs`**: Same `encoded_proof` to `raw_proof` switch as `arkworks.rs`
- **`pairing-utils/src/wasm.rs`**: Doc comments updated from v5.0.0 to v6.0.0 VK references
- **`pairing-utils/src/bin/convert_from_sp1_groth16.rs`**: VK constant updated from `GROTH16_VK_5_0_0_BYTES` to `GROTH16_VK_6_0_0_BYTES`

### Added

- **`pairing-utils/sp1_v6_groth16_vk.bin`**: Embedded SP1 v6.0.0 Groth16 verification key binary; produced by `save_sp1_groth16_bin`, consumed by `gnark.rs` at compile time
- **`pairing-utils/src/bin/save_sp1_groth16_bin.rs`**: New binary; extracts and writes `sp1_v6_groth16_vk.bin` from `sp1_verifier::GROTH16_VK_BYTES`
- **`pairing-utils/src/bin/save_plonk_vk_json.rs`**: New binary; parses `sp1_verifier::PLONK_VK_BYTES`, decompresses all G1 points, derives `omega_pow_i` and `omega_pow_i_div_n`, and writes `src/plonk/plonk_vk_v6.0.0.json` (consumed by `src/plonk/vk.ts`)
- **`pairing-utils/README.md`**: Added "Updating vks after an SP1 upgrade" section documenting the `save_plonk_vk_json` / `save_sp1_groth16_bin` workflow for future SP1 upgrades

---

## PLONK

SP1 v6 changed the PLONK proof format in two ways: (1) `encoded_proof` gained a 96-byte prefix `[exit_code(32B)][vk_root(32B)][proof_nonce(32B)]` before the gnark proof bytes; (2) `public_inputs` expanded from 2 to 5: `[sp1_vkey_hash, committed_values_digest, exit_code, vk_root, proof_nonce]`.

### Changed

- **`src/api/sp1/schema.ts`**: `public_inputs` array length validation updated from 2 to 5; `Sp1PlonkInputTransformed` extended with `pi2`, `pi3`, `pi4` fields (`exit_code`, `vk_root`, `proof_nonce` from `public_inputs[2..4]`)
- **`src/plonk/proof.ts`**: Removed `slice(10)` that skipped the v5 4-byte vkey-hash prefix from `encoded_proof`; v6 caller strips the 96-byte SP1 prefix upstream and passes the gnark proof directly
- **`src/plonk/vk.ts`**: Replaced hardcoded v5 constants with JSON-driven construction; reads from `src/plonk/plonk_vk_v6.0.0.json` (produced by `pairing-utils/src/bin/save_plonk_vk_json.rs`) via `Sp1PlonkVkJson` type; `pub_inputs` updated from 2 to 5; domain size, omega, all curve points, and Lagrange values updated to v6
- **`src/plonk/state.ts`**: `StateUntilPairing` struct, `StateUntilPairingType`, `deepClone()`, and `empty()` extended with `pi2`, `pi3`, `pi4` fields; invalidates `sp1_plonk_cache`
- **`src/plonk/fiat-shamir/index.ts`**: `squeezeGamma` extended to accept all 5 PIs; VK moved to end of argument list per pre-existing convention
- **`src/plonk/recursion/zkp0.ts`**: `squeezeGamma` call site updated; all 5 PIs passed, VK last
- **`src/plonk/recursion/zkp3.ts`**: `pi_contribution` now receives all 5 PIs `[pi0..pi4]`
- **`src/plonk/recursion/witness_tracker.ts`**: `squeezeGamma` call site updated; all 5 PIs passed, VK last
- **`src/plonk/recursion/prove_zkps.ts`**: `pi2`/`pi3`/`pi4` read from `args[6..8]`; `auxWtnsPath`, `workDir`, `cacheDir` shifted by 3
- **`src/plonk/piop/piop.ts`**: `piop()` and `squeezeGamma` call updated; all 5 PIs passed, VK last
- **`src/plonk/verifier.ts`**: `verify()` and `computeMlo()` signatures extended with `pi2`, `pi3`, `pi4`
- **`src/plonk/get_mlo.ts`**: `getMlo()` signature extended with `pi2`, `pi3`, `pi4`
- **`src/plonk/serialize_mlo.ts`**: `pi2`/`pi3`/`pi4` read from `args[6..8]`
- **`src/plonk/e2e_verify.ts`**: `pi2`/`pi3`/`pi4` read from `args[5..7]`; `auxWtnsPath` shifted to `args[8]`
- **`src/compute/plans/sp1/plonk.ts`**: `encodedProof` now strips the 96-byte SP1 prefix (`slice(192)` hex chars); `pi2`/`pi3`/`pi4` threaded through state and all downstream calls
- **`src/blobstream/sp1_to_env.ts`**: `encoded_proof` stripped of 96-byte prefix; `PI2`/`PI3`/`PI4` emitted to env from `public_inputs[2..4]`
- **`scripts/get_aux_witness_plonk.sh`**: `$PI2 $PI3 $PI4` appended to `serialize_mlo.js` invocation
- **`scripts/e2e_verify_plonk.sh`**: `$PI2 $PI3 $PI4` appended before `$AUX_WITNESS_RELATIVE_PATH`
- **`scripts/plonk_tree.sh`**: `$PI2 $PI3 $PI4` added to `prove_zkps.js` invocation; exported in parallel env
- **`package.json`**: Fixed duplicate `piop/e2e_test.js` in `test:e2e`; replaced second instance with `piop/e2e_playground.js`; `@nori-zk/proof-conversion-utils` switched from published `0.5.3` to local `file:./pairing-utils/pkg` (until we are ready for release)

### Added

- **`src/plonk/plonk_vk_v6.0.0.json`**: New v6 PLONK verification key; produced by `pairing-utils/src/bin/save_plonk_vk_json.rs`; 5 public inputs, domain size 2^25, updated omega, all circuit selector and commitment points
- **`src/plonk/vk_5.0.0.ts`**: v5 VK preserved as a standalone file for reference

### Fixed

- **`src/plonk/e2e_test.ts`**, **`src/plonk/piop/e2e_test.ts`**, **`src/plonk/piop/e2e_playground.ts`**: Replaced v5 test data with real v6 values from example-proofs and `.conversion-cache`; removed all `@ts-ignore` suppressions; added `pi2`/`pi3`/`pi4` constants and `Provable.witness` calls

---

## Groth16

SP1 v6 changed the Groth16 `encoded_proof` layout; a 96-byte gnark on-chain calldata prefix is now prepended before the proof points. `raw_proof` (unchanged layout, starts directly with A, B, C) is used instead. Additionally `public_inputs` expanded from 2 to 5, requiring zero-scalar guards since `ForeignCurve.scale()` asserts non-zero in o1js.

### Changed

- **`src/groth/compute_pi.ts`**: Zero-scalar guard added; skips `icPoint.scale(pis[i])` when `pis[i] === 0n` (mirrors SP1's own `prepare_inputs`; `ForeignCurve.scale()` asserts non-zero)
- **`src/groth/recursion/zkp14.ts`**, **`src/groth/recursion/zkp15.ts`**: Zero-scalar guard added in provable context; replaces zero with dummy scalar `1` via `Provable.if`, then conditionally keeps `acc` unchanged when original was zero
- **`src/groth/witness_tracker.ts`**: Zero-scalar guard added; skips scale for zero PI entries (non-provable context, same logic as `compute_pi.ts`)
- **`src/groth/proof.ts`**: Minor: extracted `json[key]` to `val` to avoid double-indexing
- **`example-proofs/`**: `sp1_groth16_obj_v5.json` and `sp1_plonk_obj_v5.json` removed; `sp1_groth16_obj_v6.json` and `sp1_plonk_obj_v6.json` added

### Fixed

- **`README.md`**: Example proof filenames updated from `v5` to `v6` in `sp1Plonk` and `sp1Groth16` CLI examples
- **`pairing-utils/README.NPM.md`**: VK references updated from v5.0.0 to v6.0.0 throughout

---

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
