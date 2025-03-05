import { ComputationalStage, ComputationPlan, ProcessCmd, ProcessCmdOutput } from "./plan.js";
import { PlatformFeatureDetectionComputationalPlan, PlatformFeatures } from "./plans/platform/index.js";
import { ProcessPool } from "./processPool.js";

type InferInput<P> = P extends ComputationPlan<any, any, infer I> ? I : never;
type InferOutput<P> = P extends ComputationPlan<any, infer R, any> ? R : never;
type InferState<P> = P extends ComputationPlan<infer S, any, any> ? S : never;

function applyNumaOptimization<T>(stageProcessCommands: ProcessCmd[], state: T & PlatformFeatures) {
    return stageProcessCommands.map((processCmd, idx) => {
        const numaNode = idx % state.numaNodes!; 
        const { cmd, args } = processCmd;

        /*
numactl --cpunodebind=$NUMA_NODE --membind=$NUMA_NODE \
node --max-old-space-size=$NODE_MEMORY_LIMIT \

            export interface ProcessCmd {
                cmd: string;
                args: string[];
                emit?: boolean;
                capture?: boolean;
            }
        */


        // replace the cmd with numactl and move the args one level down
        const newCmd = 'numactl';
        const newArgs = [`--cpunodebind=${numaNode}`, `--membind=${numaNode}`, cmd, ...args];

        return {...processCmd, cmd: newCmd, args: newArgs};
    });
}

export class ComputationalPlanExecutor {
    #poolSize: number;
    #processPool: ProcessPool;

    async #executeComputationalPlanInner<T, R, I>(state = {} as T & PlatformFeatures, plan: ComputationPlan<T & PlatformFeatures, R, I>, input: I) {
        console.info(`Executing computational plan: ${plan.name}`);

        if (plan.init) {
            console.info(`Running computational plan init.`);
            await plan.init(state, input);
        }

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
                    let processCmd = stage.processCmd;
                    if (processCmd instanceof Function) {
                        processCmd = processCmd(state);
                    }

                    if (stage.callback) {
                        const cmdResult = await this.#processPool.runCommand(processCmd).catch(err => err);
                        const stageCallback = stage.callback(state, cmdResult);
                        if (stageCallback instanceof Promise) {
                            await stageCallback;
                        }
                    }
                    else await this.#processPool.runCommand(processCmd);
                    break;
                }
                case 'parallel-cmd': {
                    let processCmds = stage.processCmds;
                    if (processCmds instanceof Function) {
                        processCmds = processCmds(state);
                    }

                    // If this is numa optimised then we should modify our commands
                    let modifiedCommands = processCmds;
                    if (stage.numaOptimized && state.numaNodes) {
                        modifiedCommands = applyNumaOptimization<T>(modifiedCommands, state);
                    }

                    if (stage.callback) {
                        const cmdResults = await Promise.all(
                            modifiedCommands
                                .map((cmd) => this.#processPool.runCommand(cmd).catch((err) => err as ProcessCmdOutput))
                        );
                        const stageCallback = stage.callback(state, cmdResults);
                        if (stageCallback instanceof Promise) {
                            await stageCallback;
                        }
                    }
                    else await Promise.all(
                        modifiedCommands
                            .map((cmd) => this.#processPool.runCommand(cmd))
                    );
                    break;
                }
                default: {
                    throw new Error(`Unknown stage type '${(stage as ComputationalStage<any>).type}' aborting.`);
                }
            }
        }

        // Run collect
        console.info('Collecting computational plan results.');
        return plan.collect(state);
    }

    async execute<P extends ComputationPlan<any,any,any>>(plan: P, input: InferInput<P>) {
        // Define platform features
        const plaformPlan = new PlatformFeatureDetectionComputationalPlan();
        // Execute platform plan        
        const platformFeatures = await this.#executeComputationalPlanInner<PlatformFeatures, PlatformFeatures, InferInput<P>>({} as PlatformFeatures, plaformPlan as InferInput<P>, input);
        // Execute the given plan
        return await this.#executeComputationalPlanInner<InferState<P>, InferOutput<P>, InferInput<P>>(platformFeatures as InferState<P>, plan, input);
    }

    workerFreeStatus() {
        return this.#processPool.workerFreeStatus();
    }

    constructor(poolSize: number) {
        this.#poolSize = poolSize;
        this.#processPool = new ProcessPool(poolSize);
    }
}

