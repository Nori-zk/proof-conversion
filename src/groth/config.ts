/**
 * Distribution strategy for zkp14/zkp15:
 * - 6 inputs: 3+3 distribution
 * - 5 inputs: 3+2 distribution (RISC0 setup)
 * - Lower counts: Keep all in zkp14 to minimize zkp15 complexity
 */
export function getDistribution(inputCount: number): { zkp14: number[], zkp15: number[] } {
    switch (inputCount) {
        case 0: return { zkp14: [], zkp15: [] }; // Only ic0, no public inputs
        case 1: return { zkp14: [0], zkp15: [] }; // zkp14 handles pis[0]
        case 2: return { zkp14: [0, 1], zkp15: [] }; // zkp14 handles pis[0], pis[1]
        case 3: return { zkp14: [0, 1, 2], zkp15: [] }; // zkp14 handles pis[0], pis[1], pis[2]
        case 4: return { zkp14: [0, 1, 2], zkp15: [3] }; // 3+1
        case 5: return { zkp14: [0, 1, 2], zkp15: [3, 4] }; // 3 + 2 (RISC0 setup)
        case 6: return { zkp14: [0, 1, 2], zkp15: [3, 4, 5] }; // 3 + 3
        default: throw new Error(`Unsupported input count: ${inputCount}`);
    }
}