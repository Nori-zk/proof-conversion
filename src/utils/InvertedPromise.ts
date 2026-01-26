export class InvertedPromise<T, E = unknown> {
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
    });
  }
}
