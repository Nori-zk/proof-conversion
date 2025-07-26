/**
 * Build-time configuration for public input count
 * Set via PUBLIC_INPUT_COUNT environment variable
 */

const PUBLIC_INPUT_COUNT = parseInt(process.env.PUBLIC_INPUT_COUNT || '5');

if (PUBLIC_INPUT_COUNT < 0 || PUBLIC_INPUT_COUNT > 6) {
    throw new Error(`Invalid PUBLIC_INPUT_COUNT: ${PUBLIC_INPUT_COUNT}. Supported range: 0-6`);
}

/**
 * Distribution strategy for zkp14/zkp15 based on empirical testing:
 * - 6 inputs: 3+3 distribution
 * - 5 inputs: 3+2 distribution (RISC0 setup)
 * - Lower counts: Keep all in zkp14 to minimize zkp15 complexity
 */
function getDistribution(inputCount: number): { zkp14: number[], zkp15: number[] } {
    switch (inputCount) {
        case 0: return { zkp14: [], zkp15: [] }; // Only ic0, no public inputs
        case 1: return { zkp14: [0], zkp15: [] }; // zkp14 handles pis[0]
        case 2: return { zkp14: [0, 1], zkp15: [] }; // zkp14 handles pis[0], pis[1]
        case 3: return { zkp14: [0, 1, 2], zkp15: [] }; // zkp14 handles pis[0], pis[1], pis[2]
        case 4: return { zkp14: [0, 1], zkp15: [2, 3] }; // 2+2
        case 5: return { zkp14: [0, 1, 2], zkp15: [3, 4] }; // 3 + 2 (RISC0 setup)
        case 6: return { zkp14: [0, 1, 2], zkp15: [3, 4, 5] }; // 3 + 3
        default: throw new Error(`Unsupported input count: ${inputCount}`);
    }
}

/**
 * Generate field names for proof parsing
 */
function getProofFields(inputCount: number): string[] {
    return Array.from({ length: inputCount }, (_, i) => `pi${i + 1}`);
}

/**
 * Generate IC point names for VK parsing
 */
function getIcFields(inputCount: number): string[] {
    return Array.from({ length: inputCount + 1 }, (_, i) => `ic${i}`);
}

export const CONFIG = {
    publicInputCount: PUBLIC_INPUT_COUNT,
    distribution: getDistribution(PUBLIC_INPUT_COUNT),
    proofFields: getProofFields(PUBLIC_INPUT_COUNT),
    icFields: getIcFields(PUBLIC_INPUT_COUNT),
} as const;

// Type exports for compile-time type safety
export type PublicInputCount = typeof CONFIG.publicInputCount;
export type Distribution = typeof CONFIG.distribution;