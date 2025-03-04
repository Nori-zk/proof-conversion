import { ComputationalStage, ComputationPlan } from "../../plan.js";
import { range } from "../../utils.js";
import { PlatformFeatures } from "../platform";

interface NumaNodeTestComputationPlanOutput {
    output: string[];
}

interface NumaNodeTestComputationPlanState extends PlatformFeatures, NumaNodeTestComputationPlanOutput { }

export class NumaNodeTestComputationPlan implements ComputationPlan<NumaNodeTestComputationPlanState, NumaNodeTestComputationPlanOutput> {
    sharedState: NumaNodeTestComputationPlanState = {} as NumaNodeTestComputationPlanState;
    name = 'NumaNodeTest';
    async init (sharedState: NumaNodeTestComputationPlanState, input: undefined): Promise<void> {
        sharedState.output = [];
    }
    stages: ComputationalStage<NumaNodeTestComputationPlanState>[] = [
        {
            type: 'parallel-cmd',
            name: 'ScaledNumaEcho',
            processCmds: range(10).map((idx) => {
                return {
                    cmd: 'echo',
                    args: [`'Command${idx}'`],
                };
            }),
            numaOptimized: true,
            callback: (sharedState, result) => {
                sharedState.output = result.map((processOutput) => processOutput.stdOut as string);
            }
        }
    ];
    async collect(sharedState: NumaNodeTestComputationPlanState): Promise<NumaNodeTestComputationPlanOutput> {
        return { output: sharedState.output };
    }
}