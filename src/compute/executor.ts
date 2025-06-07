import { Logger } from '../logging/logger.js';
import {
  ComputationalStage,
  ComputationPlan,
  MainThreadComputationStage,
  ParallelComputationStage,
  ProcessCmd,
  ProcessCmdOutput,
  SerialComputationalStage,
} from './plan.js';
import {
  PlatformFeatureDetectionComputationalPlan,
  PlatformFeatures,
} from './plans/platform/index.js';
import { ProcessPool } from './processPool.js';

type InferInput<P> = P extends ComputationPlan<any, any, infer I> ? I : never;
type InferOutput<P> = P extends ComputationPlan<any, infer R, any> ? R : never;
type InferState<P> = P extends ComputationPlan<infer S, any, any> ? S : never;

let executorId = 0;

export class ComputationalPlanExecutor {
  #poolSize: number;
  #processPool: ProcessPool;
  #logger: Logger;
  #planExecutionId = 0;
  #activePlans = new Map<
    number,
    { plan: ComputationPlan<any, any, any>; state: any }
  >();
  #maxWorkersPerNuma: number;

  async #performMainThreadStage<S extends PlatformFeatures>(
    stage: MainThreadComputationStage<S>,
    state: S
  ) {
    let result: void | Promise<void> = stage.execute(state);
    if (result instanceof Promise) {
      await result;
    }
  }

  async #performSerialStage<S extends PlatformFeatures>(
    stage: SerialComputationalStage<S>,
    state: S
  ) {
    let processCmd = stage.processCmd;
    if (processCmd instanceof Function) {
      processCmd = processCmd(state);
    }

    if (stage.callback) {
      const cmdResult = await this.#processPool
        .runCommand(processCmd)
        .catch((err) => err as ProcessCmdOutput);
      const stageCallback = stage.callback(state, cmdResult);
      if (stageCallback instanceof Promise) {
        await stageCallback;
      }
    } else
      await this.#processPool
        .runCommand(processCmd)
        .catch((err: ProcessCmdOutput) => {
          throw err.error;
        });
  }

  async #performParallelStage<S extends PlatformFeatures>(
    stage: ParallelComputationStage<S>,
    state: S
  ) {
    let processCmds = stage.processCmds;
    if (processCmds instanceof Function) {
      processCmds = processCmds(state);
    }

    // Determine if we should use NUMA optimization
    const shouldUseNuma =
      stage.numaOptimized && state.numaNodes && state.numaNodes > 0;
    const numTasks = processCmds.length;
    const numaNodes = state.numaNodes || 0;

    // Skip NUMA if there are more NUMA nodes than tasks
    const useNumaOptimization = Boolean(shouldUseNuma);

    if (shouldUseNuma) {
      if (useNumaOptimization) {
        this.#logger.log(
          `Stage '${stage.name}': Using dynamic NUMA optimization for ${numTasks} tasks across ${numaNodes} NUMA nodes`
        );
      } else {
        this.#logger.log(
          `Stage '${stage.name}': Skipping NUMA optimization (${numTasks} tasks <= ${numaNodes} NUMA nodes)`
        );
      }
    }

    if (stage.callback) {
      const cmdResults = await this.#processPool
        .runParallelCommands(processCmds, numaNodes, useNumaOptimization)
        .catch((errors) => {
          // Handle array of errors from parallel execution
          return errors.map((err: any) => err as ProcessCmdOutput);
        });

      const stageCallback = stage.callback(state, cmdResults);
      if (stageCallback instanceof Promise) {
        await stageCallback;
      }
    } else {
      await this.#processPool
        .runParallelCommands(processCmds, numaNodes, useNumaOptimization)
        .catch((errors: ProcessCmdOutput[]) => {
          // Throw the first error encountered
          const firstError = errors.find((err) => err.error);
          if (firstError) {
            throw firstError.error;
          }
        });
    }

    // Log NUMA usage statistics after stage completion
    // if (useNumaOptimization) {
    //   const numaStatus = this.#processPool.getNumaStatus();
    //   this.#logger.debug(
    //     `NUMA usage after stage '${stage.name}':`,
    //     Object.fromEntries(numaStatus)
    //   );
    // }
  }

  async #stagePrerequisiteIndicatesSkip<S extends PlatformFeatures>(
    stage: ComputationalStage<S>,
    state: S
  ) {
    const prerequisiteCheck = stage.prerequisite;
    if (prerequisiteCheck) {
      let prerequisiteResult: boolean | Promise<boolean>;
      prerequisiteResult = prerequisiteCheck(state);

      if (prerequisiteResult instanceof Promise) {
        prerequisiteResult = await prerequisiteResult;
      }

      if (!prerequisiteResult) {
        return true;
      }
    }
    return false;
  }

  async #executeComputationalPlanInner<S extends PlatformFeatures, R, I>(
    state = {} as S,
    plan: ComputationPlan<S, R, I>,
    input: I
  ) {
    this.#planExecutionId++;
    const planId = this.#planExecutionId;
    this.#logger.log(`Executing computational plan '${plan.name}'.`);
    let error: Error | undefined = undefined;
    const startTime = Date.now();
    try {
      this.#activePlans.set(planId, { plan, state });
      if (plan.init) {
        this.#logger.log(
          `Calling the 'init' function of the '${plan.name}' computational plan.`
        );
        await plan.init(state, input);
      }

      let stageStartTime: number;
      for (let stage_idx = 0; stage_idx < plan.stages.length; stage_idx++) {
        const stage = plan.stages[stage_idx];
        stageStartTime = Date.now();

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

        if (await this.#stagePrerequisiteIndicatesSkip(stage, state)) continue;

        this.#logger.log(
          `[${stage.type}] Executing stage ${stage_idx} '${stage.name}' of the '${plan.name}' computational plan.`
        );

        switch (stage.type) {
          case 'main-thread': {
            await this.#performMainThreadStage(stage, state);
            break;
          }
          case 'serial-cmd': {
            await this.#performSerialStage(stage, state);
            break;
          }
          case 'parallel-cmd': {
            await this.#performParallelStage(stage, state);
            break;
          }
          default: {
            throw new Error(
              `Unknown stage type '${
                (stage as ComputationalStage<S>).type
              }' aborting.`
            );
          }
        }

        const stageElapsed = (Date.now() - stageStartTime) / 1000;
        this.#logger.log(
          `[${stage.type}] Stage ${stage_idx} '${stage.name}' of the '${plan.name}' computational plan completed in ${stageElapsed} seconds.`
        );

        // Log worker utilization after each parallel stage
        if (stage.type === 'parallel-cmd') {
          const freeWorkers = this.#processPool.workerFreeStatus();
          this.#logger.debug(
            `Free workers after stage '${stage.name}': [${freeWorkers.join(
              ', '
            )}] (${freeWorkers.length}/${this.#poolSize} available)`
          );
        }
      }

      // Run then
      this.#logger.log(
        `Calling the 'then' function of the '${plan.name}' computational plan.`
      );
      const result = await plan.then(state);
      return result;
    } catch (err) {
      error = err as Error;
      throw error;
    } finally {
      const elapsed = (Date.now() - startTime) / 1000;
      let finallyWorked = true;

      this.#activePlans.delete(planId);

      if (error)
        this.#logger.error(
          `Execution of the '${plan.name}' computational plan failed after ${elapsed} seconds: ${error}`
        );

      if (plan.finally) {
        this.#logger.info(
          `Calling the 'finally' function of the '${plan.name}' computational plan.`
        );
        await plan.finally(state).catch((err) => {
          this.#logger.error(
            `An error occured when calling the 'finally' function of the '${plan.name}' computational plan. ${err}`
          );
          finallyWorked = false;
        });
      }

      if (!error) {
        if (finallyWorked)
          this.#logger.log(
            `Execution of the computational plan '${plan.name}' completed successfully in ${elapsed} seconds.`
          );
        else
          this.#logger.warn(
            `Computational plan '${plan.name}' completed successfully in ${elapsed} seconds. However the 'finally' function had an error. Some cache cleanup logic may not have completed and left stray files on your system.'`
          );
      }
    }
  }

  async execute<P extends ComputationPlan<any, any, any>>(
    plan: P,
    input: InferInput<P>
  ) {
    // Define platform features
    const plaformPlan = new PlatformFeatureDetectionComputationalPlan();
    // Execute platform plan
    const platformFeatures = await this.#executeComputationalPlanInner<
      PlatformFeatures,
      PlatformFeatures,
      InferInput<P>
    >({} as PlatformFeatures, plaformPlan as any, input);

    this.#logger.log(
      `Detected platform features: ${platformFeatures.numaNodes} NUMA nodes, ` +
        `using ${this.#poolSize} workers with max ${
          this.#maxWorkersPerNuma
        } workers per NUMA node`
    );

    // Execute the given plan
    return await this.#executeComputationalPlanInner<
      InferState<P>,
      InferOutput<P>,
      InferInput<P>
    >(platformFeatures as InferState<P>, plan, input);
  }

  async terminate() {
    let resolver = Promise.resolve();
    this.#activePlans.forEach((activePlan) => {
      resolver = resolver.then(async () => {
        if (activePlan.plan.finally)
          await activePlan.plan.finally(activePlan.state);
      });
    });
    return resolver;
  }

  workerFreeStatus() {
    return this.#processPool.workerFreeStatus();
  }

  getPoolStats() {
    return {
      poolSize: this.#poolSize,
      freeWorkers: this.#processPool.workerFreeStatus().length,
      numaStatus: this.#processPool.getNumaStatus(),
      maxWorkersPerNuma: this.#maxWorkersPerNuma,
    };
  }

  constructor(poolSize: number, maxWorkersPerNuma = 2) {
    executorId++;
    this.#poolSize = poolSize;
    this.#maxWorkersPerNuma = maxWorkersPerNuma;
    this.#processPool = new ProcessPool(poolSize, maxWorkersPerNuma);
    this.#logger = new Logger(`ComputationalPlanExecutor${executorId}`);
  }
}
