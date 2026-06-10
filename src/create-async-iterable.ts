/**
 * AsyncIterableController represents the control interface and asynchronous generator for a queue-backed async iterable.
 */
export interface AsyncIterableController<T> {
  /**
   * push appends a new value to the queue, resolving the oldest pending next() promise if one exists.
   */
  push(value: T): void;
  /**
   * reject finishes the queue with an error, which will reject pending and future next() promises.
   */
  reject(err: unknown): void;
  /**
   * complete closes the queue normally, resolving pending and future next() promises to done.
   */
  complete(): void;
  /**
   * iterable is the asynchronous generator that yields values pushed to the queue.
   */
  iterable: AsyncGenerator<T, void, unknown>;
  /**
   * [Symbol.asyncIterator] returns the asynchronous generator for direct iteration.
   */
  [Symbol.asyncIterator](): AsyncGenerator<T, void, unknown>;
}

/**
 * AsyncIterableOptions configures the behavior of the asynchronous iterable.
 */
export interface AsyncIterableOptions {
  /**
   * onCleanup is a callback invoked when the async iterable completes, rejects, or is closed.
   */
  onCleanup?: () => void;
}

/**
 * createAsyncIterable creates an asynchronous queue-backed generator that allows pushing values.
 */
export function createAsyncIterable<T>(
  options?: AsyncIterableOptions,
): AsyncIterableController<T> {
  const queue: T[] = [];
  const resolvers: {
    resolve: (res: IteratorResult<T, void>) => void;
    reject: (err: unknown) => void;
  }[] = [];
  let done = false;
  let error: unknown = null;
  const onCleanup = options?.onCleanup;

  const push = (value: T): void => {
    if (done) return;
    if (resolvers.length > 0) {
      const { resolve } = resolvers.shift()!;
      resolve({ value, done: false });
    } else {
      queue.push(value);
    }
  };

  const reject = (err: unknown): void => {
    if (done) return;
    done = true;
    error = err;
    while (resolvers.length > 0) {
      const { reject: rej } = resolvers.shift()!;
      rej(err);
    }
    onCleanup?.();
  };

  const complete = (): void => {
    if (done) return;
    done = true;
    while (resolvers.length > 0) {
      const { resolve } = resolvers.shift()!;
      resolve({ value: undefined, done: true });
    }
    onCleanup?.();
  };

  const generator: AsyncGenerator<T, void, unknown> = {
    [Symbol.asyncIterator]() {
      return this;
    },

    async next(): Promise<IteratorResult<T, void>> {
      if (queue.length > 0) {
        return { value: queue.shift()!, done: false };
      }
      if (done) {
        if (error) {
          throw error;
        }
        return { value: undefined, done: true };
      }
      return new Promise<IteratorResult<T, void>>((resolve, rejectPromise) => {
        resolvers.push({ resolve, reject: rejectPromise });
      });
    },

    async return(value?: void | PromiseLike<void>) {
      complete();
      const resolvedValue = await value;
      return { value: resolvedValue, done: true };
    },

    async throw(err: unknown) {
      reject(err);
      throw err;
    },

    async [Symbol.asyncDispose]() {
      await this.return();
    },
  };

  const controller: AsyncIterableController<T> = {
    push,
    reject,
    complete,
    iterable: generator,
    [Symbol.asyncIterator]() {
      return generator;
    },
  };

  return controller;
}
