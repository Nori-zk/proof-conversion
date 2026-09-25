// The Groth16 recursion circuits (zkp0-zkp15) are shared across all three
// Groth16 ingestion paths (SP1, Risc0, snarkjs) - see
// src/compute/plans/{sp1,risc0,snarkjs}/groth16.ts, which all compile and
// run the exact same zkp14/zkp15 build output. Only zkp14 pins any of the
// five public inputs to vendor-specific constants (exit_code/vk_root for
// SP1, control-root/bn254-control-id for Risc0), so which constants (if
// any) apply depends on which vendor produced the proof. This must be an
// explicit, caller-supplied value: unlike inputCount, it cannot be detected
// from the proof bytes themselves, since a 5-input SP1 proof and a 5-input
// Risc0 proof are shaped identically.
export const Groth16VendorBrand = {
  SP1: 'sp1',
  Risc0: 'risc0',
  Snarkjs: 'snarkjs',
} as const;

export type Groth16VendorBrand =
  (typeof Groth16VendorBrand)[keyof typeof Groth16VendorBrand];

export function parseGroth16VendorBrand(value: string): Groth16VendorBrand {
  const values = Object.values(Groth16VendorBrand) as string[];
  if (!values.includes(value)) {
    throw new Error(
      `Unknown Groth16VendorBrand '${value}', expected one of: ${values.join(', ')}`
    );
  }
  return value as Groth16VendorBrand;
}
