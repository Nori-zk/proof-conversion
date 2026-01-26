export interface ProofDataOutput {
  maxProofsVerified: 0 | 1 | 2;
  proof: string;
  publicInput: string[];
  publicOutput: string[];
}

export interface VkDataOutput {
  data: string;
  hash: string;
}

export interface ConversionOutput {
  vkData: VkDataOutput;
  proofData: ProofDataOutput;
}