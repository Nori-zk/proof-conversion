import type { JsonProof } from 'o1js';

/**
 * Proof data in o1js format.
 *
 * Contains a serialized o1js proof along with its public inputs and outputs,
 * plus metadata about recursive proof composition.
 *
 * # Fields
 *
 * - `maxProofsVerified`: Number of proofs this circuit verifies recursively.
 *   This is a structural property of the proof's circuit, not a verification mode:
 *   - `0`: Circuit does not verify any other proofs (base case/leaf proof)
 *   - `1`: Circuit verifies exactly 1 other proof inside its execution
 *   - `2`: Circuit verifies exactly 2 other proofs inside its execution (binary tree recursion)
 *
 * - `proof`: Base64-encoded o1js proof in Pickles format. This is the native
 *   proof representation used by o1js, containing all the cryptographic witness
 *   data and commitments required for verification.
 *
 * - `publicInput`: Array of public input field elements as decimal strings.
 *   Each string represents a field element in the Pallas base field (255-bit modulus).
 *
 * - `publicOutput`: Array of public output field elements as decimal strings.
 *   Each string represents a field element in the Pallas base field (255-bit modulus).
 */
export type ProofDataOutput = JsonProof;

/**
 * Verification key data in o1js format.
 *
 * Contains a serialized o1js verification key with its cryptographic hash.
 *
 * # Fields
 *
 * - `data`: Base64-encoded o1js verification key in Pickles format. Contains
 *   all the cryptographic parameters needed to verify proofs: constraint system
 *   commitments, setup parameters, and domain configuration.
 *
 * - `hash`: Cryptographic hash of the verification key for integrity checking
 *   and identification.
 */
export interface VkDataOutput {
  data: string;
  hash: string;
}

/**
 * Complete conversion output in o1js format.
 *
 * Bundles together the verification key and proof data for o1js verification.
 *
 * # Structure
 *
 * - `vkData`: Verification key in o1js format (see [`VkDataOutput`])
 * - `proofData`: Proof in o1js format with public I/O (see [`ProofDataOutput`])
 */
export interface ConversionOutput {
  vkData: VkDataOutput;
  proofData: ProofDataOutput;
}
