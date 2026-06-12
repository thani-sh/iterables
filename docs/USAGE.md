# Advanced Usage Guide

This document covers the advanced usage, API reference, lifecycle management, and architectural details of the `@thani-sh/iterables` library.

---

## Table of Contents

- [Introduction](#introduction)
- [Synchronous Iterables (`createIterable`)](#synchronous-iterables-createiterable)
  - [Example: Same-Context Buffering](#example-same-context-buffering)
- [Asynchronous Iterables (`createAsyncIterable`)](#asynchronous-iterables-createasynciterable)
  - [Example: Delayed Event Streaming](#example-delayed-event-streaming)
- [Lifecycle & Cleanup Management](#lifecycle--cleanup-management)
  - [Using `onCleanup`](#using-oncleanup)
  - [Explicit Resource Disposal (`Symbol.dispose`)](#explicit-resource-disposal-symboldispose)
- [Error Handling & Rejection](#error-handling--rejection)
  - [Synchronous Rejection](#synchronous-rejection)
  - [Asynchronous Rejection](#asynchronous-rejection)
- [API Reference](#api-reference)

---

## Introduction

`@thani-sh/iterables` allows you to bridge push-based data producers (like event emitters, WebSockets, or UI inputs) with pull-based consumers (`for-of` and `for-await-of` loops).

By providing a controller with a `push`/`complete`/`reject` API, this library handles the underlying queue management, promise buffering, and proper generator lifecycle events.

---

## Synchronous Iterables (`createIterable`)

Synchronous iterables are backed by a queue that buffers values. They are ideal for cases where you push and pull values within the same execution context or thread without waiting for asynchronous events.

### Example: Same-Context Buffering

```typescript
import { createIterable } from "@thani-sh/iterables";

// Create a controller for a synchronous stream of strings
const controller = createIterable<string>();

// Pushing values synchronously
controller.push("Item A");
controller.push("Item B");
controller.complete(); // Marks the queue as finished

// Consume the values
// You can iterate over the controller directly
for (const val of controller) {
  console.log(val); // "Item A", "Item B"
}
```

_Note: You can iterate directly on the `controller` (using `Symbol.iterator`), or access the raw generator via `controller.iterable`._

---

## Asynchronous Iterables (`createAsyncIterable`)

Asynchronous iterables allow you to handle data that arrives over time. When a consumer requests a value using `for await...of`, the iterator yields it immediately if it's already in the queue. If the queue is empty, the iterator returns a promise that resolves as soon as a new value is pushed.

### Example: Delayed Event Streaming

```typescript
import { createAsyncIterable } from "@thani-sh/iterables";

const controller = createAsyncIterable<number>();

// Simulate an asynchronous event source pushing data
let count = 0;
const interval = setInterval(() => {
  count++;
  controller.push(count);

  if (count === 3) {
    clearInterval(interval);
    controller.complete(); // Notify the loop that no more values are coming
  }
}, 50);

// Consume values asynchronously
for await (const num of controller) {
  console.log(`Received: ${num}`);
}
```

---

## Lifecycle & Cleanup Management

Properly tearing down active resources (timers, database handles, sockets) when the iterator finishes is critical. This library provides two ways to clean up: the `onCleanup` callback and standard JavaScript disposal (`Symbol.dispose` / `Symbol.asyncDispose`).

### Using `onCleanup`

The `onCleanup` callback is triggered when the iterable finishes naturally via `complete()`, is terminated via `reject()`, or when the consumer breaks out of the loop early.

```typescript
import { createAsyncIterable } from "@thani-sh/iterables";

const socket = new WebSocket("ws://example.com");

const { push, complete, reject, iterable } = createAsyncIterable<string>({
  onCleanup: () => {
    console.log("Cleaning up WebSocket connection...");
    socket.close();
  },
});

socket.onmessage = (event) => push(event.data);
socket.onclose = () => complete();
socket.onerror = (err) => reject(err);

// If we break out of this loop early, onCleanup is still called
for await (const message of iterable) {
  if (message === "STOP") {
    break; // Triggers loop termination and onCleanup
  }
  console.log(message);
}
```

### Explicit Resource Disposal (`Symbol.dispose`)

Both synchronous and asynchronous iterables conform to standard ES disposal protocols. This makes them compatible with the TypeScript `using` statement for scoped resource management.

```typescript
import { createIterable } from "@thani-sh/iterables";

function processLogs() {
  // The iterable will automatically call its cleanup routine when exiting scope
  using controller = createIterable<string>({
    onCleanup: () => console.log("Scope cleanup complete!"),
  });

  controller.push("log 1");
  controller.push("log 2");

  for (const log of controller) {
    console.log(log);
  }
} // "Scope cleanup complete!" is printed here
```

For asynchronous workflows, `Symbol.asyncDispose` is supported:

```typescript
import { createAsyncIterable } from "@thani-sh/iterables";

async function processStream() {
  await using controller = createAsyncIterable<number>({
    onCleanup: () => console.log("Async cleanup complete!"),
  });

  controller.push(42);
  controller.complete();

  for await (const val of controller) {
    console.log(val);
  }
} // "Async cleanup complete!" is printed here
```

---

## Error Handling & Rejection

You can propagate errors down to the consumer using the `reject` method. Once `reject` is invoked, the queue stops accepting new items. Pushed items already in the queue are yielded first, and then the error is thrown.

### Synchronous Rejection

```typescript
import { createIterable } from "@thani-sh/iterables";

const controller = createIterable<number>();
controller.push(1);
controller.reject(new Error("Database failure"));

try {
  for (const num of controller) {
    console.log(num); // Prints 1, then throws
  }
} catch (err) {
  console.error("Caught error:", (err as Error).message); // "Caught error: Database failure"
}
```

### Asynchronous Rejection

```typescript
import { createAsyncIterable } from "@thani-sh/iterables";

const controller = createAsyncIterable<number>();
controller.push(10);
controller.reject(new Error("Stream disconnected"));

try {
  for await (const num of controller) {
    console.log(num); // Prints 10, then throws
  }
} catch (err) {
  console.error("Caught error:", (err as Error).message); // "Caught error: Stream disconnected"
}
```

---

## API Reference

### `createIterable`

```typescript
function createIterable<T>(options?: IterableOptions): IterableController<T>;
```

#### `IterableOptions`

```typescript
interface IterableOptions {
  /** Callback invoked when the iterable completes, rejects, or is closed early */
  onCleanup?: () => void;
}
```

#### `IterableController`

```typescript
interface IterableController<T> {
  /** Appends a new value to the queue. Ignored if already completed or rejected. */
  push(value: T): void;

  /** Finishes the queue with an error. The error is thrown when the consumer reaches it. */
  reject(err: unknown): void;

  /** Closes the queue normally. Consumers will finish once the queue is exhausted. */
  complete(): void;

  /** The underlying synchronous Generator object. */
  iterable: Generator<T, void, unknown>;

  /** Allows direct iteration over the controller. */
  [Symbol.iterator](): Generator<T, void, unknown>;
}
```

---

### `createAsyncIterable`

```typescript
function createAsyncIterable<T>(
  options?: AsyncIterableOptions,
): AsyncIterableController<T>;
```

#### `AsyncIterableOptions`

```typescript
interface AsyncIterableOptions {
  /** Callback invoked when the async iterable completes, rejects, or is closed early */
  onCleanup?: () => void;
}
```

#### `AsyncIterableController`

```typescript
interface AsyncIterableController<T> {
  /** Appends a new value to the queue. Resolves the oldest pending next() promise. */
  push(value: T): void;

  /** Finishes the queue with an error. Rejecting any pending and future next() promises. */
  reject(err: unknown): void;

  /** Closes the queue normally. Resolving pending and future next() promises to done. */
  complete(): void;

  /** The underlying asynchronous Generator object. */
  iterable: AsyncGenerator<T, void, unknown>;

  /** Allows direct iteration over the controller. */
  [Symbol.asyncIterator](): AsyncGenerator<T, void, unknown>;
}
```
