import { spawn } from 'child_process';
import { ProcessCmd, ProcessCmdOutput } from './plan';
import { Logger } from '../logging/logger.js';
import { InvertedPromise } from '../utils/InvertedPromise.js';

export function processCmdToString(processCmd: ProcessCmd): string {
  const { cmd, args, printableArgs } = processCmd;

  if (!args.length) return cmd;

  if (!printableArgs) {
    return `${cmd} ${args.join(' ')}`;
  }

  const filteredPrintableArgs = args.filter((_, idx) =>
    printableArgs.includes(idx)
  );

  return filteredPrintableArgs.length < args.length
    ? `${cmd} ${filteredPrintableArgs.join(' ')}...`
    : `${cmd} ${args.join(' ')}`;
}

interface ProcessJob extends ProcessCmd {
  invertedPromise: InvertedPromise<ProcessCmdOutput>;
  originalCmd?: ProcessCmd; // Store original command before NUMA modification
}

interface WorkerInfo {
  id: number;
  numaNode?: number;
  isBusy: boolean;
}

let processPoolIdx = 0;

export class ProcessPool {
  #workers: Map<number, WorkerInfo>;
  #jobQueue: ProcessJob[] = [];
  #logger: Logger;
  #maxWorkersPerNuma: number;
  #numaWorkerCount: Map<number, number> = new Map();

  #jobToString(processCmd: ProcessCmd) {
    return processCmdToString(processCmd);
  }

  #getOptimalNumaNode(
    numaNodes: number,
    availableWorkers: WorkerInfo[]
  ): number | null {
    if (numaNodes === 0) return null;

    // Find NUMA node with least busy workers
    const numaUsage = new Map<number, number>();

    // Initialize NUMA usage counts
    for (let i = 0; i < numaNodes; i++) {
      numaUsage.set(i, this.#numaWorkerCount.get(i) || 0);
    }

    // Find the NUMA node with minimum usage that hasn't exceeded max workers per NUMA
    let bestNuma = 0;
    let minUsage = numaUsage.get(0) || 0;

    for (let i = 1; i < numaNodes; i++) {
      const usage = numaUsage.get(i) || 0;
      if (usage < minUsage && usage < this.#maxWorkersPerNuma) {
        minUsage = usage;
        bestNuma = i;
      }
    }

    // If all NUMA nodes are at max capacity, return the one with least usage
    if (minUsage >= this.#maxWorkersPerNuma) {
      for (let i = 0; i < numaNodes; i++) {
        const usage = numaUsage.get(i) || 0;
        if (usage < minUsage) {
          minUsage = usage;
          bestNuma = i;
        }
      }
    }

    return bestNuma;
  }

  #applyNumaToCommand(processCmd: ProcessCmd, numaNode: number): ProcessCmd {
    const { cmd, args } = processCmd;

    const newCmd = 'numactl';
    const newArgs = [
      `--cpunodebind=${numaNode}`,
      `--membind=${numaNode}`,
      cmd,
      ...args,
    ];

    const newProcessCommand = { ...processCmd, cmd: newCmd, args: newArgs };
    if (newProcessCommand.printableArgs) {
      newProcessCommand.printableArgs = [
        0,
        1,
        2,
        ...newProcessCommand.printableArgs.map((idx: number) => idx + 3),
      ];
    }
    return newProcessCommand;
  }

  async #spawnWorker(processCmd: ProcessCmd, workerId: number) {
    const printableProcessCmd = this.#jobToString(processCmd);
    const startTime = Date.now();
    this.#logger.log(
      `[Executor${workerId}] Attempting to execute cmd: '${printableProcessCmd}'.`
    );
    const { cmd, args } = processCmd;
    return new Promise<ProcessCmdOutput>((resolve, reject) => {
      let stdio: 'inherit' | 'ignore' | 'pipe';

      const capture = !!processCmd.capture;
      const emit = !!processCmd.emit;

      if (capture) stdio = 'pipe';
      else if (emit) stdio = 'inherit';
      else stdio = 'ignore';

      let stdOut = '';
      let stdErr = '';

      // Spawn process
      const child = spawn(cmd, args, { stdio });

      if (capture) {
        child.stdout?.on('data', (data) => {
          stdOut += data;
          if (emit) {
            process.stdout.write(data);
          }
        });
        child.stderr?.on('data', (err) => {
          stdErr += err;
          if (emit) {
            process.stdout.write(err);
          }
        });
      }

      let alreadyErrored = false;

      // Capture exit code
      child.on('error', (error) => {
        if (alreadyErrored) return;
        alreadyErrored = true;
        const message = `[Executor${workerId}] Cmd '${printableProcessCmd}' failed. ${error}`;
        this.#logger.warn(message);
        reject({ code: 1, stdErr, stdOut, error });
      });

      // Capture process close
      child.on('close', (code) => {
        if (code === 0) {
          this.#logger.log(
            `[Executor${workerId}] Cmd '${printableProcessCmd}' succeeded in ${
              (Date.now() - startTime) / 1000
            } seconds.`
          );
          resolve({ code, stdErr, stdOut });
        } else {
          if (alreadyErrored) return;
          alreadyErrored = true;
          const stdErrTrimmed = stdErr.trim();
          const message = `[Executor${workerId}] Cmd '${printableProcessCmd}' exited non zero code '${code}'${
            stdErrTrimmed ? `.\n${stdErrTrimmed}` : '.'
          }`;
          this.#logger.warn(message);
          reject({ code, stdErr, stdOut, error: new Error(message) });
        }
      });
    });
  }

  async #checkForJobsAfterWorkerFinish(workerId: number) {
    const worker = this.#workers.get(workerId);
    if (!worker) return;

    // Mark worker as free
    worker.isBusy = false;

    // // Decrease NUMA worker count if worker was assigned to a NUMA node
    // if (worker.numaNode !== undefined) {
    //   const currentCount = this.#numaWorkerCount.get(worker.numaNode) || 0;
    //   this.#numaWorkerCount.set(worker.numaNode, Math.max(0, currentCount - 1));
    //   worker.numaNode = undefined;
    // }
    // let optimalNuma = worker.numaNode;
    // worker.numaNode = optimalNuma;
    // const currentCount = this.#numaWorkerCount.get(optimalNuma) || 0;
    // this.#numaWorkerCount.set(optimalNuma, currentCount + 1);
    // Check if there are queued jobs
    const job = this.#jobQueue.shift();
    if (!job) return;

    // Mark worker as busy
    worker.isBusy = true;

    // Use the original command (without NUMA modifications)
    let commandToRun = job.originalCmd || job;
    if (worker.numaNode !== undefined) {
      commandToRun = this.#applyNumaToCommand(commandToRun, worker.numaNode);
    }
    // Run the job and resolve/reject the inverted promise on completion / error
    this.#spawnWorker(commandToRun, workerId)
      .then((result) => job.invertedPromise.resolve(result))
      .catch((err) => job.invertedPromise.reject(err))
      .finally(() => this.#checkForJobsAfterWorkerFinish(workerId));
  }

  async runCommand(processCmd: ProcessCmd) {
    // Create an inverted promise to resolve the result at a later time
    const invertedPromise = new InvertedPromise<ProcessCmdOutput>();

    // Find available workers
    const availableWorkers = Array.from(this.#workers.values()).filter(
      (w) => !w.isBusy
    );

    // If we have available workers, assign immediately
    if (availableWorkers.length > 0) {
      const worker = availableWorkers[0];
      worker.isBusy = true;

      // Use original command directly since we handle NUMA dynamically
      this.#spawnWorker(processCmd, worker.id)
        .then((result) => invertedPromise.resolve(result))
        .catch((err) => invertedPromise.reject(err))
        .finally(() => this.#checkForJobsAfterWorkerFinish(worker.id));

      return invertedPromise.promise;
    } else {
      // Queue job for next available worker
      this.#logger.debug(
        `No workers available. Job '${this.#jobToString(processCmd)}' queued.`
      );
      this.#jobQueue.push({
        ...processCmd,
        invertedPromise,
        originalCmd: processCmd,
      });
      return invertedPromise.promise;
    }
  }

  async runParallelCommands(
    processCmds: ProcessCmd[],
    numaNodes?: number,
    useNuma = false
  ) {
    // Determine if we should use NUMA
    const shouldUseNuma = useNuma && numaNodes && numaNodes > 0;

    if (shouldUseNuma) {
      this.#logger.log(
        `Using dynamic NUMA optimization with ${numaNodes} NUMA nodes for ${processCmds.length} tasks`
      );
    }

    const promises = processCmds.map(async (cmd) => {
      // Create inverted promise
      const invertedPromise = new InvertedPromise<ProcessCmdOutput>();

      // Find available worker
      const availableWorkers = Array.from(this.#workers.values()).filter(
        (w) => !w.isBusy
      );

      if (availableWorkers.length > 0) {
        const worker = availableWorkers[0];
        worker.isBusy = true;

        let commandToRun = cmd;

        // Apply NUMA optimization if needed
        if (shouldUseNuma) {
          const optimalNuma = this.#getOptimalNumaNode(
            numaNodes!,
            availableWorkers
          );
          if (optimalNuma !== null) {
            worker.numaNode = optimalNuma;
            const currentCount = this.#numaWorkerCount.get(optimalNuma) || 0;
            this.#numaWorkerCount.set(optimalNuma, currentCount + 1);
            commandToRun = this.#applyNumaToCommand(cmd, optimalNuma);
            this.#logger.debug(
              `Assigned task to NUMA node ${optimalNuma} (worker ${worker.id})`
            );
          }
        }

        this.#spawnWorker(commandToRun, worker.id)
          .then((result) => invertedPromise.resolve(result))
          .catch((err) => invertedPromise.reject(err))
          .finally(() => this.#checkForJobsAfterWorkerFinish(worker.id));
      } else {
        // Queue the job
        this.#jobQueue.push({
          ...cmd,
          invertedPromise,
          originalCmd: cmd,
        });
        this.#logger.debug(`Queued job: ${this.#jobToString(cmd)}`);
      }

      return invertedPromise.promise;
    });

    return Promise.all(promises);
  }

  workerFreeStatus() {
    const freeWorkers = Array.from(this.#workers.values())
      .filter((w) => !w.isBusy)
      .map((w) => w.id)
      .sort((a, b) => a - b);
    return freeWorkers;
  }

  getNumaStatus() {
    const status = new Map<number, { busy: number; total: number }>();

    this.#workers.forEach((worker) => {
      if (worker.numaNode !== undefined) {
        const current = status.get(worker.numaNode) || { busy: 0, total: 0 };
        status.set(worker.numaNode, {
          busy: current.busy + (worker.isBusy ? 1 : 0),
          total: current.total + 1,
        });
      }
    });

    return status;
  }

  constructor(poolSize: number, maxWorkersPerNuma = 2) {
    processPoolIdx++;
    this.#maxWorkersPerNuma = maxWorkersPerNuma;
    this.#workers = new Map();

    // Initialize workers
    for (let i = 0; i < poolSize; i++) {
      this.#workers.set(i, {
        id: i,
        isBusy: false,
        numaNode: undefined,
      });
    }

    this.#logger = new Logger(`ProcessPool${processPoolIdx}`);
    this.#logger.log(
      `Initialized ProcessPool with ${poolSize} workers, max ${maxWorkersPerNuma} workers per NUMA node`
    );
  }
}
