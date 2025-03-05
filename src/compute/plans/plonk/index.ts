import { ComputationalStage, ComputationPlan } from '../../plan.js';
import { PlatformFeatures } from '../platform';

export type PlonkInput = {
    hexPi: string;
    programVK: string;
    encodedProof: string;
}

export interface PlonkProofData {
    maxProofsVerified: 0 | 1 | 2,
    proof: string,
    publicInput: string[],
    publicOutput: string[]
}

export interface PlonkVkData {
    data: string;
    hash: string
}

export interface PlonkOutput {
    vkData: PlonkVkData;
    proofData: PlonkProofData;
}

interface State extends PlatformFeatures, PlonkOutput {}

export class PlonkComputationalPlan implements ComputationPlan<State, PlonkOutput, PlonkInput> {
    readonly __inputType!: PlonkInput;
    name = "PlonkConverter";
    stages: ComputationalStage<State>[] = [];
    async collect(state: State): Promise<PlonkOutput> {
        return {} as PlonkOutput;
    }
}