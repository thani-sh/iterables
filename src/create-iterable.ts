/**
 * IterableController represents the control interface and synchronous generator for a queue-backed iterable.
 */
export interface IterableController<T> {
  /**
   * push appends a new value to the queue.
   */
  push(value: T): void;
  /**
   * reject finishes the queue with an error, which will be thrown when the generator is consumed.
   */
  reject(err: unknown): void;
  /**
   * complete closes the queue normally.
   */
  complete(): void;
  /**
   * iterable is the synchronous generator that yields values pushed to the queue.
   */
  iterable: Generator<T, void, unknown>;
  /**
   * [Symbol.iterator] returns the synchronous generator for direct iteration.
   */
  [Symbol.iterator](): Generator<T, void, unknown>;
}

/**
 * IterableOptions configures the behavior of the synchronous iterable.
 */
export interface IterableOptions {
  /**
   * onCleanup is a callback invoked when the iterable completes, rejects, or is closed.
   */
  onCleanup?: () => void;
}

/**
 * createIterable creates a synchronous queue-backed generator that allows pushing values.
 */
export function createIterable<T>(
  options?: IterableOptions,
): IterableController<T> {
  const queue: T[] = [];
  let done = false;
  let error: unknown = null;
  const onCleanup = options?.onCleanup;

  const push = (value: T): void => {
    if (done) return;
    queue.push(value);
  };

  const reject = (err: unknown): void => {
    if (done) return;
    done = true;
    error = err;
    onCleanup?.();
  };

  const complete = (): void => {
    if (done) return;
    done = true;
    onCleanup?.();
  };

  const generator: Generator<T, void, unknown> = {
    [Symbol.iterator]() {
      return this;
    },

    next(): IteratorResult<T, void> {
      if (queue.length > 0) {
        return { value: queue.shift()!, done: false };
      }
      if (done) {
        if (error) {
          throw error;
        }
        return { value: undefined, done: true };
      }
      return { value: undefined, done: true };
    },

    return(value?: void) {
      complete();
      return { value, done: true };
    },

    throw(err: unknown) {
      reject(err);
      throw err;
    },

    [Symbol.dispose]() {
      this.return();
    },
  };

  const controller: IterableController<T> = {
    push,
    reject,
    complete,
    iterable: generator,
    [Symbol.iterator]() {
      return generator;
    },
  };

  return controller;
}
