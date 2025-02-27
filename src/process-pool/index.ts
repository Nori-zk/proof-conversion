import { spawn } from "child_process";

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

type ReturnCodeSuccess = 0;

interface ProcessJob {
    cmd: string;
    args: string[];
    emitStdOut: boolean;
    invertedPromise: InvertedPromise<ReturnCodeSuccess>
}

export class ProcessPool {
    #free: Set<number>;
    #lifo: ProcessJob[] = [];

    async #jobToString(cmd: string, args: readonly string[], emitStdOut = true) {
        return `${cmd} ${args.join(' ')}`;
    }

    async #spawnWorker(cmd: string, args: readonly string[], emitStdOut = true) {
        return new Promise<ReturnCodeSuccess>((resolve, reject) => {
            // Spawn process
            const process = spawn(cmd, args, { stdio: emitStdOut ? 'inherit' : 'ignore' });
            const printableProcessCmd = this.#jobToString(cmd, args, emitStdOut);

            // Capture exit code
            process.on('error', (error) => {
                reject(new Error(`'${printableProcessCmd}' failed with error: ${error}`));
            });

            // Capture process close
            process.on('close', (code) => {
                if (code === 0) {
                    resolve(code);
                } else {
                    const errorMessage = code === 127
                        ? `'${printableProcessCmd}' not found (Exit code: ${code})`
                        : `'${printableProcessCmd}' failed with exit code: ${code}`;
                    reject(new Error(errorMessage));
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
        this.#spawnWorker(job.cmd, job.args, job.emitStdOut)
            .then(job.invertedPromise.resolve)
            .catch(job.invertedPromise.reject)
            .finally(() => this.#checkForJobsAfterWorkerFinish(workerId));

    }

    async runCommand(cmd: string, args: string[], emitStdOut = true) {
        // Create an inverted promise to resolve the result at a later time.
        const invertedPromise = new InvertedPromise<ReturnCodeSuccess>();

        // Check for a free worker.
        const freeFreePoolWorkerKeyValuePair = this.#free.values().next().value;

        // If we have a free worker queue immediately.
        if (freeFreePoolWorkerKeyValuePair) {
            // Get the worker Id
            const workerId = freeFreePoolWorkerKeyValuePair;
            // Remove the worker from the pool
            this.#free.delete(workerId);
            // Run job immediately
            this.#spawnWorker(cmd, args, emitStdOut)
                .then(invertedPromise.resolve)
                .catch(invertedPromise.reject)
                .finally(() => this.#checkForJobsAfterWorkerFinish(workerId));
        }
        else {
            // Queue job for next free worker
            console.warn(`No available workers. Job '${this.#jobToString(cmd, args, emitStdOut)}' is being queued.`);
            this.#lifo.push({ cmd, args, emitStdOut, invertedPromise });
            return invertedPromise.promise;
        }
    }

    constructor(poolSize: number) {
        this.#free = new Set(Array.from({ length: poolSize }, (_, i) => i));
    }
}