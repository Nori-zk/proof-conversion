import { ComputationalStage, ComputationPlan, ProcessCmdOutput } from "./plan.js";
import { PlatformFeatureDetectionComputationalPlan, PlatformFeatures } from "./platform.js";
import { ProcessPool } from "./processPool.js";

export class ComputationalPlanExecutor {
    #poolSize: number;
    #processPool: ProcessPool;

    async #executeComputationalPlanInner<T>(state = {} as T & PlatformFeatures, plan: ComputationPlan<T & PlatformFeatures>) {
        console.info(`Executing computational plan: ${plan.name}`);

        for (let stage_idx = 0; stage_idx < plan.stages.length; stage_idx++) {
            const stage = plan.stages[stage_idx];

            const prerequisiteCheck = stage.prerequisite;
            if (prerequisiteCheck) {
                let prerequisiteResult: boolean | Promise<boolean>;
                prerequisiteResult = prerequisiteCheck(state);

                if (prerequisiteResult instanceof Promise) {
                    prerequisiteResult = await prerequisiteResult;
                }

                if (!prerequisiteResult) {
                    continue;
                }
            }

            console.info(`Executing [${stage.type}] stage ${stage_idx}: '${stage.name}' of the computational plan.`);

            switch (stage.type) {
                case 'main-thread': {
                    let result: void | Promise<void> = stage.execute(state);
                    if (result instanceof Promise) {
                        await result;
                    }
                    break;
                }
                case 'serial-cmd': {
                    if (stage.callback) {
                        const cmdResult = await this.#processPool.runCommand(stage.processCmd).catch(err => err);
                        const stageCallback = stage.callback(state, cmdResult);
                        if (stageCallback instanceof Promise) {
                            await stageCallback;
                        }
                    }
                    else await this.#processPool.runCommand(stage.processCmd);
                    break;
                }
                case 'parallel-cmd': {
                    if (stage.callback) {
                        const cmdResults = await Promise.all(
                            stage.processCmds
                                .map((cmd) => this.#processPool.runCommand(cmd).catch((err) => err as ProcessCmdOutput))
                        );
                        const stageCallback = stage.callback(state, cmdResults);
                        if (stageCallback instanceof Promise) {
                            await stageCallback;
                        }
                    }
                    else await Promise.all(
                        stage.processCmds
                            .map((cmd) => this.#processPool.runCommand(cmd))
                    );
                    break;
                }
                default: {
                    throw new Error(`Unknown stage type '${(stage as ComputationalStage<any>).type}' aborting.`);
                }
            }



        }

        return state;
    }

    async execute() {
        // Define platform features
        const plaformPlan = new PlatformFeatureDetectionComputationalPlan();
        // Execute platform plan        
        const platformFeatures = this.#executeComputationalPlanInner<PlatformFeatures>({} as PlatformFeatures, plaformPlan);

        return platformFeatures;
    }

    constructor(poolSize: number) {
        this.#poolSize = poolSize;
        this.#processPool = new ProcessPool(poolSize);
    }
}

