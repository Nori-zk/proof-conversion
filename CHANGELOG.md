# 23/06/26 - Audit e68c5: G2Line.evaluate_g1 is dead code and does not implement the correct evaluation of the line function on G1

## Finding e68c5 (verbatim)

The G2Line struct encodes a line on the twisted BN254 curve. To evaluate the corresponding line function on a point on G1, the twist-isomorphism must be taken into account, which is done correctly in the function psi. The same struct also exposes a method evaluate_g1 that takes a G1Affine and returns an Fp2:

```
evaluate_g1(p: G1Affine): Fp2 {
  let t = this.lambda.mul_by_fp(p.x);
  t = t.neg();
  t = t.add(this.neg_mu);
  return t.add_fp(p.y);
}
```

This method does not implement a meaningful evaluation of the line function on G1.

### Impact

The function is not used in the audited code. Future code edits could mistakenly use this function to compute the evaluation of the G2-line function on G1, which would be incorrect.

### Recommendations

Delete G2Line.evaluate_g1.

## Response

Acknowledged. `evaluate_g1` has zero call sites in the codebase. The method naively substitutes G1 coordinates into the G2 line equation without applying the twist isomorphism, which `psi` handles correctly via `AffineCache`'s `xp_prime` and `yp_prime`. Leaving it in place risks incorrect use in future edits.

### Commit - Fix applied

- **`src/lines/index.ts`**: removed `evaluate_g1` method from `G2Line` class.

---

# 23/06/26 - Audit b8891: AffineCache constructor assigns yp_prime twice

## Finding b8891 (verbatim)

The constructor of AffineCache (src/lines/precompute.ts:13) assigns this.yp_prime twice:

```
constructor(p: G1Affine) {
  this.xp_neg = p.x.neg().assertCanonical();
  this.yp_prime = p.y.inv().assertCanonical();
  this.yp_prime = Provable.witness(FpC.provable, () =>
    p.y.inv().assertCanonical()
  );
  this.yp_prime.mul(p.y).assertEquals(FpC.from(1n));
  this.xp_prime = this.xp_neg.mul(this.yp_prime).assertCanonical();
}
```

The first assignment, this.yp_prime = p.y.inv().assertCanonical(), is immediately overwritten by the second assignment from Provable.witness(...). The intended initializer is the second one: it witnesses the inverse outside the constraint system and then constrains it back via this.yp_prime.mul(p.y).assertEquals(FpC.from(1n)), which is the cheaper way to assert an inverse than building it through FpC.inv() directly.

### Impact

The constructed AffineCache value is the same with or without the redundant first assignment, so soundness and completeness are unaffected. The cost is an unnecessary FpC.inv() + assertCanonical() per AffineCache construction.

### Recommendations

Delete the first assignment.

## Response

Acknowledged. The first assignment on line 15 computes `p.y.inv().assertCanonical()` and is immediately overwritten by the `Provable.witness` path on lines 16-18. The witnessed inverse is then properly constrained by the `mul(p.y).assertEquals(1n)` check on line 19. The first assignment is dead code that produces unnecessary `FpC.inv()` + `assertCanonical()` gates whose output is discarded.

AffineCache is constructed at 30 call sites across Groth16 (zkp0-zkp6, accumulate_lines: 3 per site for negA, C, PI) and PLONK (zkp13-zkp16, accumulate_lines: 2 per site for A, negB), so the wasted gates are multiplied across the full recursion pipeline.

### Commit - Fix applied

- **`src/lines/precompute.ts`**: removed redundant first assignment `this.yp_prime = p.y.inv().assertCanonical()` on line 15.

---

# 16/06/26 - Audit 10b08 extended: Parallel implementations of shared utilities across Groth16 and Plonk components

## Finding 10b08 extended (verbatim)

Parallel implementations of shared utilities across Groth16 and Plonk components

In addition to ArrayListHasher, we identified two more instances of this pattern:
- AuXWitness and AuXWitnessType in src/aux_witness.ts (used by Groth) and src/plonk/aux_witness.ts (used by Plonk)
- LineParser in src/line_parser.ts (used by Groth) and src/plonk/recursion/line_parser.ts (used by Plonk)

We will not include the full implementation code in this message. Reading the files makes it clear that these can be consolidated into single implementations.

- For AuXWitness, the Plonk version is straightforwardly reusable; parse has simply been renamed to loadFromPath.
- For LineParser, the Groth16 recursive circuit (src/groth/recursion/zkp*.ts) already demonstrates a pattern that works equally well for Plonk:

```
const delta_lines = LineParser.parse(BEGIN, END, VK.delta_lines);
const gamma_lines = LineParser.parse(BEGIN, END, VK.gamma_lines);
```

We recommend consolidating these two implementations along with ArrayListHasher into single shared implementations.

## Response (10b08 extended)

Acknowledged. Both duplications follow the same pattern as ArrayListHasher, which was already consolidated under finding 10b08.

- AuXWitness: the Plonk version (src/plonk/aux_witness.ts) is a strict superset of the Groth version (src/aux_witness.ts). The only API difference is the method name: `parse` (Groth) vs `loadFromPath` (Plonk). The Plonk version additionally provides `loadFromJSON`. The struct definition and all field types are identical.
- LineParser: the Groth version (src/line_parser.ts) is a stateless utility with `static parse(from, to, lines)` and `static frobenius_lines(lines)`. The Plonk version (src/plonk/recursion/line_parser.ts) is a stateful class that bundles JSON loading with the same slicing logic. The core function `ateCntSlice` is identical. The Plonk version also duplicates its JSON loading with src/plonk/recursion/witness_tracker.ts, which independently loads the same g2_lines.json and tau_lines.json at module scope.

### Commit - Fix applied

- **`src/aux_witness.ts`**: replaced with the Plonk superset version (moved from src/plonk/aux_witness.ts). Exports `loadFromPath` (renamed from Groth's `parse`) and `loadFromJSON`. Import path for towers/fp12 updated to reflect new location.
- **`src/plonk/aux_witness.ts`**: removed, moved up to src/aux_witness.ts.
- **`src/groth/e2e_test.ts`**, **`src/groth/recursion/prove_zkps.ts`**, **`src/groth/ec50d_regression.spec.ts`**: Groth call sites renamed from `.parse()` to `.loadFromPath()`.
- **`src/plonk/verifier.ts`**, **`src/plonk/e2e_test.ts`**, **`src/plonk/e2e_verify.ts`**, **`src/plonk/recursion/prove_zkps.ts`**: Plonk import paths repointed from `./aux_witness.js` or `../aux_witness.js` to `../aux_witness.js` or `../../aux_witness.js`.
- **`src/plonk/mm_loop/load_lines.ts`**: new file, single location for loading and parsing g2_lines.json and tau_lines.json into G2Line arrays.
- **`src/plonk/recursion/line_parser.ts`**: removed, replaced by shared src/line_parser.ts and src/plonk/mm_loop/load_lines.ts.
- **`src/plonk/recursion/witness_tracker.ts`**: removed duplicate JSON loading, imports g2_lines and tau_lines from ../mm_loop/load_lines.js.
- **`src/plonk/recursion/zkp13.ts`**, **`zkp14.ts`**, **`zkp15.ts`**, **`zkp16.ts`**: switched from Plonk's stateful LineParser to shared stateless LineParser from src/line_parser.ts, line data imported from ../mm_loop/load_lines.js. Frobenius calls in zkp16 updated to use `LineParser.frobenius_lines()`.

---

# 09/06/26 - Audit 10b08 and 0dd9c: ArrayListHasher duplicated and hash length not validated

## Finding 10b08 (verbatim)

ArrayListHasher duplicated between Groth16 and Plonk components

We found two ArrayListHasher implementations with identical behavior: one in src/array_list_hasher.ts and the other in src/kzg/structs.ts.

src/array_list_hasher.ts:
```
class ArrayListHasher {
  static n: number;

  static empty(): Field {
    const a = new Array(this.n).fill(Field(0n));
    return Poseidon.hashPacked(Provable.Array(Field, this.n), a);
  }

  static hash(arr: Array<Field>): Field {
    return Poseidon.hashPacked(Provable.Array(Field, this.n), arr);
  }

  static open(
    lhs: Array<Field>,
    opening: Array<Fp12>,
    rhs: Array<Field>
  ): Field {
    const opening_hashes: Field[] = opening.map((x) =>
      Poseidon.hashPacked(Fp12, x)
    );

    let arr: Field[] = [];
    arr = arr.concat(lhs);
    arr = arr.concat(opening_hashes);
    arr = arr.concat(rhs);

    return this.hash(arr);
  }
}

ArrayListHasher.n = ATE_LOOP_COUNT.length;
```

src/kzg/structs.ts:
```
class ArrayListHasher {
  static n: number;

  static empty(): Field {
    const a = new Array(this.n).fill(Field(0n));
    return Poseidon.hashPacked(Provable.Array(Field, ATE_LOOP_COUNT.length), a);
  }

  static hash(arr: Array<Field>): Field {
    return Poseidon.hashPacked(
      Provable.Array(Field, ATE_LOOP_COUNT.length),
      arr
    );
  }

  static open(
    lhs: Array<Field>,
    opening: Array<Fp12>,
    rhs: Array<Field>
  ): Field {
    const opening_hashes: Field[] = opening.map((x) =>
      Poseidon.hashPacked(Fp12, x)
    );

    let arr: Field[] = [];
    arr = arr.concat(lhs);
    arr = arr.concat(opening_hashes);
    arr = arr.concat(rhs);

    return this.hash(arr);
  }
}

ArrayListHasher.n = ATE_LOOP_COUNT.length;
```

The former is used by the Groth16 component (src/groth) and the latter by the Plonk component (src/plonk). We see no reason to maintain them separately, and recommend consolidating them into a single implementation.

## Response (10b08)

Acknowledged. Both classes are functionally identical. `n` is set to `ATE_LOOP_COUNT.length` on both, so the hardcoded variant in `kzg/structs.ts` produces the same results.

## Finding 0dd9c (verbatim)

`ArrayListHasher::hash` does not validate array length

ArrayListHasher::hash is defined as follows:
```
  static hash(arr: Array<Field>): Field {
    return Poseidon.hashPacked(Provable.Array(Field, this.n), arr);
  }
```
From the code, one might expect that the hash is computed over exactly this.n elements of arr. However, Poseidon::hashPacked consumes the actual length of arr rather than this.n.

Poseidon::hashPacked is defined as:
```
  hashPacked<T>(type: WithProvable<Hashable<T>>, value: T) {
    let input = ProvableType.get(type).toInput(value);
    let packed = packToFields(input);
    return Poseidon.hash(packed);
  },
```
Provable.Array(Field, this.n) is a call to provableArray, which returns a provable type object with length = this.n captured in its closure. Most methods on this object, such as check and sizeInFields, use length. However, toInput does not:
```
    toInput(array) {
      if (!('toInput' in type)) {
        throw Error('circuitArray.toInput: element type has no toInput method');
      }
      return array.reduce(
        (curr, value) => HashInput.append(curr, type.toInput(value)),
        HashInput.empty
      );
    },
```
Since hashPacked only calls toInput internally, this.n has no effect on the resulting hash. Therefore, arr.length === this.n should be asserted before calling hashPacked. Given that hashPacked takes a type that includes the expected array length, it would be natural for it to validate that arr matches that length. This could be considered a potential upstream issue in o1js.

## Response (0dd9c)

Acknowledged. The observation about `Provable.Array`'s `toInput` is correct: it iterates the actual array elements via `.reduce()`, ignoring the declared `n`. `hashPacked` calls `toInput` without calling `check()`, so no length validation occurs at the hashing step.

In current usage, the length is structurally enforced at every call site: inside ZkProgram circuits, `lines_hashes` is declared as `Provable.Array(Field, ATE_LOOP_COUNT.length)` in `privateInputs` and `fromFields` reconstructs exactly that many elements before the method body runs; in the witness trackers, the array is constructed as `new Array(ATE_LOOP_COUNT.length).fill(Field(0n))` and modified in-place; in `open()`, the three input arrays are `Provable.Array`-declared with sizes summing to 65. A wrong-length array cannot reach `hash()` through any current call path, and if one side drifted the `assertEquals` between the witness tracker digest and the circuit digest would catch it. The risk is limited to future refactors where a clear error at the assertion point is preferable to a cryptic `Field.assertEquals` failure downstream.

### Commit 1 - Regression test for 0dd9c

- **Regression test** (`src/0dd9c_regression.spec.ts`): added `hash with fewer than n elements must throw`, `hash with more than n elements must throw`, and `hash with exactly n elements must not throw`. The first two tests call `ArrayListHasher.hash()` with arrays of length `n - 1` and `n + 1` respectively and expect an error to be thrown. The third test confirms that an array of exactly `n` elements (65) hashes without error.

Run: `npm run test:jest -- src/0dd9c_regression.spec.ts`

Results:

- Regression tests: 2 fail, 1 pass. The wrong-length arrays do not throw on unpatched code, confirming that `hash()` silently hashes whatever it receives regardless of the declared `n`.

### Commit 2 - Fix applied

- **`src/array_list_hasher.ts`**: added `arr.length !== this.n` assertion at the top of `hash()`, throwing with expected and actual lengths if the array size does not match. Since `empty()` and `open()` both route through `hash()`, one assertion covers all three methods.
- **`src/kzg/structs.ts`**: removed duplicate `ArrayListHasher` class (10b08), replaced with import and re-export from `src/array_list_hasher.ts`. All Plonk imports (`from '../../kzg/structs.js'`) continue working without changes. Unused imports (`Poseidon`, `Provable`, `ATE_LOOP_COUNT`) removed.

Run: `npm run test:jest -- src/0dd9c_regression.spec.ts`

Results:

- Regression tests: 3 pass, 0 fail. `ArrayListHasher.hash()` now rejects wrong-length arrays with a descriptive error.

# 02/06/26 - Audit adcd3: Groth16 proof and VK parsers do not validate that piN and icN keys are contiguous

## Finding (verbatim)

Finding adcd3: Groth16 proof parser does not validate that `piN` keys are sequential

src/groth/proof.ts assumes that public inputs in the proof JSON are stored under contiguous keys pi1 through pi{n}. The input count is detected as follows:

```typescript
export function detectInputCountFromProof(path: string): number {
  const json: O1jsProof = JSON.parse(fs.readFileSync(path, 'utf-8'));
  let count = 0;
  for (let i = 1; i <= 6; i++) {
    if (json[`pi${i}` as PiKey]) count++;
  }
  return count;
}
```

The proof is then parsed using the detected inputCount:

```typescript
      const publicInputs: FrC[] = [];
      for (let i = 1; i <= inputCount; i++) {
        const key = `pi${i}` as PiKey;
        const val = json[key];
        if (val) {
          publicInputs.push(FrC.from(val));
        }
      }
      // ...
      return new ProofClass({
        // ...
        pis: publicInputs,
      });
```

Although pis is defined as Provable.Array(FrC.provable, inputCount) and expects exactly inputCount elements, a shorter array can be passed if some piN keys are absent. When this struct is later consumed by Provable.witness, it throws: Error: Expected array of length 3, got 0. This shouldn't have happened and indicates an internal bug.

This is not exploitable, and in practice the piN values produced by the computing plan are always sequential, so the impact is limited. We are flagging this as a code maturity concern: we recommend adding a simple validation step to verify that the detected keys are strictly sequential before proceeding with parsing.

## Response

The finding is acknowledged. In the course of addressing it, scope was expanded to cover `GrothVk.parse` (`src/groth/vk.ts`) which has the same class of issue for `icN` keys - the VK parser collects whatever `ic0` to `ic6` keys are present without checking contiguity, and a FIXME comment in the code (`// FIXME CHECKME what if we have skipped some??`) confirms this was already known. Both parsers will be fixed together: `assertExactStructure` added for schema validation and an explicit contiguity check for sequential key ordering.

In the course of writing tests, three further bugs were identified in the validation layer:

- `isAffinePoint2d` (`src/api/validation/guards/crypto.ts`): used `'x' in obj && 'y' in obj` without checking key count, so `{ x: '1', y: '2', extra: 'bad' }` passed validation.
- `isComplexAffinePoint2d` (`src/api/validation/guards/crypto.ts`): same issue - checked for presence of the four expected keys but not exclusivity.
- `isField12` (`src/api/validation/guards/crypto.ts`): same issue - checked all 12 keys were present but did not reject objects with additional keys.
- `assertExactStructure` (`src/api/validation/validation.ts`): treated all schema keys as required, so optional fields (wrapped with `isOptionalField`) could not be absent from the validated object - this was required to support optional `piN` and `icN` fields in the proof and VK schemas.

All four will be fixed in commit 2 alongside the parser fixes.

### Commit 1 - Regression tests exposing missing contiguity and exact-shape validation

- **Regression tests** (`src/groth/adcd3_regression.spec.ts`): 24 tests covering `detectInputCountFromProof` - valid contiguous sequences (0 through 6 inputs), non-contiguous sequences (gaps at various positions), schema violations (missing/wrong-type fields), and unknown fields (pi0, pi7, extra keys on top-level and nested objects including negA, C, B). On unpatched code 19 fail, 5 pass.
- **Regression tests** (`src/groth/adcd3_vk_regression.spec.ts`): 24 tests covering `GrothVk.parse` - valid contiguous ic sequences (ic0 through ic3), non-contiguous sequences, missing required fields, wrong field types, and unknown fields (top-level and nested: ic0, delta, gamma, alpha_beta, w27). On unpatched code 10 fail, 14 pass.

Run: `npm run test:jest -- src/groth/adcd3_regression.spec.ts`
Run: `npm run test:jest -- src/groth/adcd3_vk_regression.spec.ts`

Results:

- Proof regression tests: 19 fail, 5 pass. Contiguity, schema, optional-field, and exact-shape checks all absent.
- VK regression tests: 10 fail, 14 pass. Contiguity, optional-field, and exact-shape checks absent; basic missing-field checks already present in current code.

### Commit 2 - Fix applied

- **`src/groth/proof.ts`**: `detectInputCountFromProof` updated with `assertExactStructure` schema validation and explicit `piN` contiguity check. `isO1jsProof` schema defined using `isAffinePoint2d`, `isComplexAffinePoint2d`, and `isOptionalString`.
- **`src/groth/vk.ts`**: `GrothVk.parse` updated with `assertExactStructure` schema validation and explicit `icN` contiguity check. `isGrothVk` schema defined using `isAffinePoint2d`, `isComplexAffinePoint2d`, `isField12`, and `isOptionalAffinePoint2d`. FIXME comment removed.
- **`src/api/validation/validation.ts`**: `assertExactStructure` patched to treat missing keys as valid when the schema validator accepts `undefined`, enabling optional field support.
- **`src/api/validation/guards/crypto.ts`**: `isAffinePoint2d` and `isComplexAffinePoint2d` updated to check exact key count in addition to key presence. `isField12` updated to check `Object.keys(obj).length === 12`. `isOptionalAffinePoint2d` added.
- **`src/api/validation/guards/strings.ts`**: New file. `isOptionalString` defined here with docstring.
- **`src/api/validation/guards/index.ts`**: `strings.ts` added to exports.

Results:

- Proof regression tests: 24 pass, 0 fail.
- VK regression tests: 24 pass, 0 fail.
- Existing validation tests (`src/api/validation/guards/test.spec.ts`): 14 pass, 0 fail.

---

# 26/5/26 - Audit EC50D: Missing on-curve and subgroup checks in Groth16 and PLONK recursion verifiers

## Finding (verbatim)

Finding ec50d: Groth recursion verifier is missing on-curve and subgroup checks

The 16-segments zkp that verifies the groth16 proof does not validate that the proof points are on curve, and, for the G2 points, in the relevant subgroup.

I have attached a more detailed description including an explanation how I verified that there are no (explicit or implicit) on-curve checks for the negA -point (others are analogous) and how this can be exploited

### Missing on-curve and subgroup checks in the Groth16 recursion verifier

The Groth16 verifier circuit (the sequence of recursion proofs `zkp0`, ..., `zkp15` under `src/groth/recursion/`) operates over two groups on the BN254 curve:

- G1 is the full group E(Fp), which for BN254 has prime order r. On-curve membership is therefore equivalent to subgroup membership: a single on-curve check is sufficient.
- G2 is the order-r subgroup of E'(Fp2) (the sextic twist of the original curve used by the BN254 pairing). The full group E'(Fp2) has cofactor much larger than 1, so on-curve membership does not imply order-r membership. Both an on-curve check and a subgroup-membership check are therefore required.

The verifier consumes three prover-controlled proof points: `negA` and `C` on G1, and `B` on G2. These enter the verifier via `parseProof` in `src/groth/proof.ts`:

```ts
// proof-conversion/src/groth/proof.ts
const negA = new G1Affine({
  x: FpC.from(json.negA.x),
  y: FpC.from(json.negA.y),
});

const C = new G1Affine({
  x: FpC.from(json.C.x),
  y: FpC.from(json.C.y),
});

const B = new G2Affine({
  x: new Fp2({ c0: FpC.from(json.B.x_c0), c1: FpC.from(json.B.x_c1) }),
  y: new Fp2({ c0: FpC.from(json.B.y_c0), c1: FpC.from(json.B.y_c1) }),
});
```

The `G1Affine` and `G2Affine` types are plain `Struct`s over the field coordinates, with no curve relation enforced:

```ts
// proof-conversion/src/ec/index.ts
class G1Affine extends Struct({ x: FpA.provable, y: FpA.provable }) {}

// proof-conversion/src/ec/g2.ts
class G2Affine extends Struct({ x: Fp2, y: Fp2 }) {}
```

The only constraint applied to the parsed coordinates is canonicality (`< p`). The curve equation `y^2 = x^3 + 3` (for `negA`, `C`) and its Fp2 twist analogue (for `B`) are never asserted, and no order-r subgroup-membership test is performed on `B`. The missing checks are therefore: on-curve for `negA` and `C`, and both on-curve and subgroup-membership for `B`.

These checks are also not enforced indirectly anywhere else in the verifier. The pre-pairing constraints `b_line.assert_is_tangent` / `b_line.assert_is_line` (`src/lines/index.ts:106,119`) enforce only line identities (y - lambda*x + neg_mu = 0 and 2*lambda*y = 3x^2), which hold for any pair (x, y) whose coordinates were used to derive lambda and neg_mu off-circuit via the same formulas, regardless of whether (x, y) lies on the curve. Inside the per-stage circuits, the proof points flow through `AffineCache` (`src/lines/precompute.ts`), which requires only that the point's y coordinate be non-zero (via `yp_prime * y = 1`). Across `zkp0`, ..., `zkp12`, every constraint on the proof points can be satisfied for any off-curve pair of canonical field elements. The only remaining assertion is the final pairing equality `f.assert_equals(Fp12.one())` at `src/groth/recursion/zkp13.ts:50` (mirrored off-circuit at `src/groth/witness_tracker.ts:323`) -- a check on the pairing relation, not on curve or subgroup membership of the inputs.

To confirm the absence of these checks end-to-end, we constructed a PoC that (a) tampers `negA.y` to `(negA.y + 1) mod p` before the proof is parsed and (b) gates out the final pairing equality `f.assert_equals(Fp12.one())` (both the in-circuit assertion at `zkp13.ts:50` and the off-circuit sanity check at `witness_tracker.ts:323`), then runs the full recursion pipeline `zkp0`, ..., `zkp15` against the example fixtures at `src/groth/example_jsons/`. The full patch is:

```diff
--- a/src/groth/recursion/prove_zkps.ts
+++ b/src/groth/recursion/prove_zkps.ts
@@ -28,7 +28,43 @@ import { VK } from '../vk_from_env.js';

 const args = process.argv;

-const proof = parseProof(VK, args[3]);
+// POC_OFFCURVE_NEGA: when set, rewrite the proof JSON to use an off-curve negA
+// (y' = y + 1 mod p). This demonstrates that no on-curve check rejects the
+// point through any of the pre-final checks. The 'final' pairing assertion
+// (zkp13 + witness_tracker.zkp13) must be disabled separately for the demo.
+const BN254_P =
+  21888242871839275222246405745257275088696311157297823662689037894645226208583n;
+let proofPathForParse = args[3];
+if (process.env.POC_OFFCURVE_NEGA === '1') {
+  const origJson = JSON.parse(fs.readFileSync(args[3], 'utf-8'));
+  const xBig = BigInt(origJson.negA.x);
+  const yBig = BigInt(origJson.negA.y);
+  let yNewBig = (yBig + 1n) % BN254_P;
+  if (yNewBig === 0n) yNewBig = (yBig + 2n) % BN254_P;
+  const lhs = (yNewBig * yNewBig) % BN254_P;
+  const rhs = (((xBig * xBig) % BN254_P) * xBig + 3n) % BN254_P;
+  const onCurve = lhs === rhs;
+  console.log('[POC_OFFCURVE_NEGA] original negA.y =', yBig.toString());
+  console.log('[POC_OFFCURVE_NEGA] tampered negA.y =', yNewBig.toString());
+  console.log(
+    '[POC_OFFCURVE_NEGA] does tampered (x,y) satisfy y^2 = x^3 + 3 (mod p)?',
+    onCurve
+  );
+  if (onCurve) {
+    throw new Error(
+      'POC sanity check: tampered point is still on the curve; pick a different offset'
+    );
+  }
+  origJson.negA.y = yNewBig.toString();
+  proofPathForParse = `${args[3]}.poc_offcurve.json`;
+  fs.writeFileSync(proofPathForParse, JSON.stringify(origJson), 'utf-8');
+  console.log(
+    '[POC_OFFCURVE_NEGA] wrote tampered proof JSON to',
+    proofPathForParse
+  );
+}
+
+const proof = parseProof(VK, proofPathForParse);
 const auxWitness = AuXWitness.parse(args[4]);
 const workDir = args[5];
 const cacheDir = args[6];
--- a/src/groth/recursion/zkp13.ts
+++ b/src/groth/recursion/zkp13.ts
@@ -47,7 +47,11 @@ const zkp13 = ZkProgram({
         );
         f = f.mul(shift);

-        f.assert_equals(Fp12.one());
+        // POC_OFFCURVE_NEGA: skip the final pairing assertion when the PoC
+        // env flag is set, since a generic off-curve negA makes f != 1
+        if (process.env.POC_OFFCURVE_NEGA !== '1') {
+          f.assert_equals(Fp12.one());
+        }

         acc.state.f = f;

--- a/src/groth/witness_tracker.ts
+++ b/src/groth/witness_tracker.ts
@@ -320,7 +320,11 @@ class WitnessTracker {
       [Fp12.one(), w27, w27_sq]
     );
     f = f.mul(shift);
-    f.assert_equals(Fp12.one());
+    // POC_OFFCURVE_NEGA: skip the off-circuit pairing sanity check when the
+    // PoC env flag is set, since a generic off-curve negA makes f != 1
+    if (process.env.POC_OFFCURVE_NEGA !== '1') {
+      f.assert_equals(Fp12.one());
+    }

     this.acc.state.f = f;
     return this.acc.deepClone();
```

Running the pipeline with `POC_OFFCURVE_NEGA=1`, every stage produces a valid proof:

```
[POC_OFFCURVE_NEGA] does tampered (x,y) satisfy y^2 = x^3 + 3 (mod p)? false
valid zkp0?:  true
valid zkp1?:  true
valid zkp2?:  true
valid zkp3?:  true
valid zkp4?:  true
valid zkp5?:  true
valid zkp6?:  true
valid zkp7?:  true
valid zkp8?:  true
valid zkp9?:  true
valid zkp10?:  true
valid zkp11?:  true
valid zkp12?:  true
valid zkp13?:  true
valid zkp14?:  true
valid zkp15?:  true
```

The same PoC structure straightforwardly extends to tampering `C` and `B`. For `B`, the `b_lines` (line coefficients) are computed off-circuit in `parseProof` via `computeLineCoeffs(B)` (`src/lines/coeffs.ts`); recomputing them from the tampered `B` keeps the line constraints `assert_is_tangent` / `assert_is_line` satisfied throughout the Miller loop, by construction.

#### Impact

The Groth16 verifier is the trust anchor for one of the two SNARK families consumed by the Nori bridge (the other being PLONK; see `src/plonk/`). For example, the SP1 Groth16 path produces a final Mina proof whose `rightOut` field is consumed by `NoriTokenBridge.ethVerify` on the Mina side to authorize state-root and deposit-root updates. A break of the Groth16 verifier therefore allows an attacker to forge arbitrary public values into the bridge's accepted state, with the same end-state consequences as documented in finding b1114.

The missing on-curve / subgroup checks weaken the verifier's soundness in the following ways:

- Pairing-equation soundness depends on `B` being in G2, not just on `B` being on the twisted curve. The Groth16 pairing identity is a statement about the order-r bilinear pairing; off-subgroup inputs do not produce a meaningful equality, and the soundness argument fails. The Miller loop the circuit computes is designed so that its output equals 1 exactly when the pairing identity holds on inputs from G2; for a `B` on the twisted curve but outside G2, the same Miller loop evaluates to a different multi-curve relation, and the final `f.assert_equals(Fp12.one())` no longer carries the intended meaning. This is practically exploitable: the cofactor of G2 in the twisted curve has small prime factors, so points of small order outside G2 are easy to construct and combine with a valid `B` to drive the Miller-loop output into a regime where the final equality can be satisfied without honoring the pairing identity.
- Off-curve inputs produce values in the larger group E'(Fp2) (or even outside it). All of the verifier's per-stage constraints -- tangent/secant line identities, Frobenius identities, the residue-witness consistency relations -- are formal polynomial relations that hold over the full coordinate field, not over the curve. The single remaining soundness barrier is therefore the final pairing equality `f.assert_equals(Fp12.one())`. Whether a malicious prover can satisfy that final equality with a forged residue witness on off-curve or off-subgroup inputs is a question entirely about the residue-witness construction; nothing in the circuit forces them to play on the intended group.

#### Recommendations

Add explicit on-curve and (for `B`) subgroup-membership constraints to the proof inputs of the Groth16 verifier circuit, applied inside the ZkProgram of `zkp0` (or wherever each point is first used in-circuit) so that the constraint becomes part of the verifier's constraint system rather than an off-circuit sanity check.

Concretely:

- `negA` and `C` (in G1): add an in-circuit assertion that the point satisfies the BN254 curve equation. Since G1 has prime order, an on-curve check alone is sufficient. The o1js `ForeignCurve` class already provides an `assertOnCurve()` method, so the simplest implementation is to either reroute `G1Affine` through the existing `bn254` curve type in `src/ec/g1.ts`, or to add an equivalent assertion directly on the `G1Affine` coordinates.
- `B` (in G2): add both an on-curve check (the curve equation of the twisted curve, using the twist parameters already in `src/towers/precomputed.ts`) and a subgroup-membership check. The standard efficient construction is the Frobenius-based subgroup test of Dai et al., which decides membership using only the Frobenius endomorphism and a small number of point operations; the Frobenius primitive itself is already implemented as `G2Affine.frobenius()` and `G2Affine.negative_frobenius()` in `src/ec/g2.ts`. Implementing this check requires non-trivial circuit logic but does not require any new primitives.

## Response

We agree with the auditor's findings that all three Groth16 prover-supplied proof points (negA, C on G1; B on G2) enter the recursion circuit as raw field coordinates with no curve equation or subgroup membership enforced in-circuit. After discussion with the o1js-blobstream author, we extended the scope to include the PLONK path, which has the same class of vulnerability on its 10 prover-supplied G1 points.

## Discussion

The o1js-blobstream author provided a four-step framework for G2 subgroup checking that leverages the existing Miller loop:

> During the BN254 optimal-ate Miller loop, we are not only accumulating the F_{p^{12}} Miller value; we also have a curve-point accumulator (T). The main loop computes the short scalar part, roughly [6u+2]Q, and then the final correction steps add/subtract Frobenius images of Q. So at the end, T is checking an endomorphism relation of the form
>
> [6u+2]Q + pi(Q) - pi^2(Q) + pi^3(Q) = O
>
> up to the exact sign/convention used by the implementation.
>
> On G_2[r], Frobenius acts like scalar multiplication by the corresponding Frobenius eigenvalue, so this endomorphism relation is zero modulo r. Therefore, for a valid r-torsion point, the final point accumulator should end at infinity.
>
> So for an untrusted G_2 proof element, the subgroup-check logic can be:
>
> 1. check the point is on the correct twist curve,
> 2. check it is not infinity,
> 3. run the Miller loop including the Frobenius correction steps,
> 4. check that the final curve-point accumulator (T) is infinity.
>
> This serves the same purpose as checking [r]Q = O, but it is cheaper because the large scalar contribution is represented using Frobenius maps and it's already implicit inside the miller loop that we anyway do.

Our read on these four points:

1. Check the point is on the correct twist curve.
   - Not done. B is prover-supplied, need y^2 = x^3 + b_twist asserted in-circuit. 209 rows, zkp6 is at 47,322 (fits).

2. Check it is not infinity.
   - Not needed. Affine coordinates cannot encode infinity, therefore neither can a malicious actor.

3. Run the Miller loop including the Frobenius correction steps.
   - Already done. zkp0-zkp6, T tracked alongside f, Frobenius corrections applied at end of zkp6.

4. Check that the final curve-point accumulator (T) is infinity.
   - Not done but not hard. T and the Frobenius corrections already exist in zkp6, the code just discards T without checking it. The last operation is assert_is_line(T, pi_2_B) with no subsequent addition. Fix is to advance T past pi_2_B, compute pi_3_B = frobenius(pi^2(B)), and assert T = -pi_3_B (same x, negated y).

None of this is needed for PLONK as the G2 points (g2, tau) are hardcoded VK constants precomputed into JSON at build time.

For G1, BN254 G1 has prime order r, so on-curve implies subgroup membership. One assertOnCurve() call per point (125 rows each via bn254 createForeignCurve) is sufficient. This applies to both the Groth16 path (negA, C, PI) and the PLONK path (l_com, r_com, o_com, qcp_0_wire, grand_product, h0, h1, h2, batch_opening_at_zeta, batch_opening_at_zeta_omega).

### Commit 1 - Regression tests exposing missing on-curve and subgroup checks

- **Groth16 regression tests** (`src/groth/ec50d_regression.spec.ts`): 5 tests covering all Groth16 prover-supplied proof points. Three G1 on-curve tests parse a real proof from `src/groth/example_jsons/`, tamper the y coordinate of a single point (+1 mod p, verified off-curve), construct a WitnessTracker, and expect proof generation via the real ZkProgram to be rejected. One G2 on-curve test tampers B.y.c0 and expects zkp6 to reject. One combined G2 subgroup test exercises the endomorphism identity from steps 3-4 above: the Miller loop's T accumulator evaluates [6u+2]B + pi(B) - pi^2(B) + pi^3(B); for B in G2[r] this equals O (T reaches infinity), for B outside G2[r] it does not. The test constructs a point on E'(Fp2) outside G2[r] via Fp2 Tonelli-Shanks and expects zkp6 to reject it, then runs valid proof B through zkp6 and expects acceptance. Both assertions are in one test so it fails on every broken state: missing check (bad B accepted), wrong endomorphism relation (valid B rejected), or correct check (both pass). Tests: `zkp0 must reject off-curve negA`, `zkp0 must reject off-curve C`, `zkp0 must reject off-curve PI`, `zkp6 must reject off-curve B` (G2 on-curve check), `zkp6 subgroup check must reject bad B and accept valid B`.
- **PLONK regression tests** (`src/plonk/ec50d_regression.spec.ts`): 10 tests covering all PLONK prover-supplied G1 points. Each test constructs a real Accumulator from a hardcoded hex proof, tampers the y coordinate of a single point (+1 mod p, verified off-curve), and expects proof generation via PLONK zkp0 to be rejected. Tests: `zkp0 must reject off-curve l_com`, `zkp0 must reject off-curve r_com`, `zkp0 must reject off-curve o_com`, `zkp0 must reject off-curve qcp_0_wire`, `zkp0 must reject off-curve grand_product`, `zkp0 must reject off-curve h0`, `zkp0 must reject off-curve h1`, `zkp0 must reject off-curve h2`, `zkp0 must reject off-curve batch_opening_at_zeta`, `zkp0 must reject off-curve batch_opening_at_zeta_omega`.

Run:

```
GROTH16_VK_PATH=./src/groth/example_jsons/vk.json npm run test:jest -- src/groth/ec50d_regression.spec.ts
npm run test:jest -- src/plonk/ec50d_regression.spec.ts
```

Results:

- Groth16 regression tests: 5 fail, 0 pass. All five tests resolve instead of rejecting, confirming that zkp0 and zkp6 accept off-curve and off-subgroup proof points.
- PLONK regression tests: 10 fail, 0 pass. All ten tests resolve instead of rejecting, confirming that PLONK zkp0 accepts off-curve proof points.

### Commit 2 - Fix applied

- **`src/ec/index.ts`**: added `assertOnCurve()` method to `G1Affine`, delegates to `bn254.assertOnCurve()`.
- **`src/towers/precomputed.ts`**: added `B_TWIST` constant (3/(9+u) in Fp2) for G2 twist curve equation.
- **`src/groth/recursion/zkp0.ts`**: added G1 on-curve checks for negA, C, PI.
- **`src/groth/recursion/zkp6.ts`**: added G2 on-curve check (y^2 = x^3 + b_twist) and G2 subgroup check. After the existing pi(B) and -pi^2(B) Frobenius corrections, T is advanced past pi_2_B and checked against -pi_3_B (same x, negated y), enforcing the full 4-term endomorphism relation [6u+2]B + pi(B) - pi^2(B) + pi^3(B) = O.
- **`src/groth/witness_tracker.ts`**: added off-circuit G2 subgroup check as dev sanity mirror of the in-circuit check in zkp6.
- **`src/plonk/recursion/zkp0.ts`**: added G1 on-curve checks for all 10 prover-supplied points.

Results:

- Groth16 regression tests: 5 pass, 0 fail.
- PLONK regression tests: 10 pass, 0 fail.

---

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
