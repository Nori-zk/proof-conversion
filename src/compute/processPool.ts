import { spawn } from "child_process";
import { ProcessCmd, ProcessCmdOutput } from "./plan";
import { Logger } from "../logging/logger.js";

class InvertedPromise<T, E = any> {
    promise: Promise<T>;
    #resolver: (value: T | PromiseLike<T>) => void;
    #rejector: (reason: unknown) => void;

    resolve(value: T) {
        this.#resolver(value);
    }

    reject(reason: E) {
        this.#rejector(reason);
    }

    constructor() {
        this.promise = new Promise((resolver, rejecter) => {
            this.#resolver = resolver;
            this.#rejector = rejecter;
        })
    }
}

export function processCmdToString(processCmd: ProcessCmd) {
    const {cmd, args} = processCmd;
    if (!processCmd.printableArgs) {
        return args.length ? `${cmd} ${args.join(' ')}` : cmd;
    }
    else {
        return args.length ? `${cmd} ${args.filter((_,idx)=>processCmd.printableArgs?.includes(idx)).join(' ')}...` : cmd;
    }
}

interface ProcessJob extends ProcessCmd {
    invertedPromise: InvertedPromise<ProcessCmdOutput>
}

let processPoolIdx = 0;

export class ProcessPool {
    #free: Set<number>;
    #lifo: ProcessJob[] = [];
    #logger: Logger;

    #jobToString(processCmd: ProcessCmd) {
        return processCmdToString(processCmd);
    }

    async #spawnWorker(processCmd: ProcessCmd, workerId: number) {
        const printableProcessCmd = this.#jobToString(processCmd);
        const startTime = Date.now();
        this.#logger.log(`[Executor${workerId}]: Attempting to execute cmd: '${printableProcessCmd}'.`);
        const {cmd, args} = processCmd;
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
                child.stdout?.on("data" , (data)=>{
                    stdOut += data;
                    if (emit) {
                        process.stdout.write(data);
                    }
                });
                child.stderr?.on("data", (err) => {
                    stdErr += err;
                    if (emit) {
                        process.stdout.write(err);
                    }
                });
            }

            // Capture exit code
            child.on('error', (error) => {
                const message = `[Executor${workerId}]: Cmd '${printableProcessCmd}' failed: ${error}`;
                this.#logger.error(message);
                reject({code: 1, stdErr, stdOut, error});
            });

            // Capture process close
            child.on('close', (code) => {
                if (code === 0) {
                    this.#logger.log(`[Executor${workerId}]: Cmd '${printableProcessCmd}' succeeded in ${(Date.now()-startTime)/1000} seconds.`);
                    resolve({code, stdErr, stdOut});
                } else {
                    const message = `[Executor${workerId}]: Cmd '${printableProcessCmd}' exited non zero code '${code}'`;
                    this.#logger.error(message);
                    reject({code, stdErr, stdOut});
                }
            });
        });
    }

    async #checkForJobsAfterWorkerFinish(workerId: number) {
        // Free ourselves 
        this.#free.add(workerId);
        // Check the status of the lifo queue, exit if there is nothing to do.
        const job = this.#lifo.pop();
        if (!job) return;
        // This worker is now considered busy with the taken job
        this.#free.delete(workerId);
        // Run the job and resolve/reject the inverted promise on completion / error.
        this.#spawnWorker(job, workerId)
            .then((result)=>job.invertedPromise.resolve(result))
            .catch((err)=>job.invertedPromise.reject(err))
            .finally(() => this.#checkForJobsAfterWorkerFinish(workerId));

    }

    async runCommand(processCmd: ProcessCmd) {
        // Create an inverted promise to resolve the result at a later time.
        const invertedPromise = new InvertedPromise<ProcessCmdOutput>();

        // Check for a free worker.
        const freeFreePoolWorkerKeyValuePair = this.#free.values().next().value;

        // If we have a free worker queue immediately.
        if (freeFreePoolWorkerKeyValuePair !== undefined) {
            // Get the worker Id
            const workerId = freeFreePoolWorkerKeyValuePair;
            // Remove the worker from the pool
            this.#free.delete(workerId);
            // Run job immediately
            this.#spawnWorker(processCmd, workerId)
                .then((result)=>invertedPromise.resolve(result))
                .catch((err)=>invertedPromise.reject(err))
                .finally(() => this.#checkForJobsAfterWorkerFinish(workerId));
            return invertedPromise.promise;
        }
        else {
            // Queue job for next free worker
            this.#logger.debug(`No workers available. Job '${this.#jobToString(processCmd)}' queued.`);
            this.#lifo.push({ ...processCmd, invertedPromise });
            return invertedPromise.promise;
        }
    }

    workerFreeStatus() {
        return Array.from(this.#free).sort((a,b)=>a-b);
    }

    constructor(poolSize: number) {
        processPoolIdx++;
        this.#free = new Set(Array.from({ length: poolSize }, (_, i) => i));
        this.#logger = new Logger(`ProcessPool${processPoolIdx}`);
    }
}