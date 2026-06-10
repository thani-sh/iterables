# @thani-sh/iterables

A lightweight utility for creating queue-backed synchronous and asynchronous iterables.

## Usage

### Asynchronous Iterables

Use `createAsyncIterable` for handling asynchronous data streams, such as event listeners, chunked streams, or queue consumers.

```typescript
import { createAsyncIterable } from "@thani-sh/iterables";

const queue = createAsyncIterable<number>();

// Push values asynchronously
queue.push(1);
queue.push(2);
setTimeout(() => {
  queue.push(3);
  queue.complete();
}, 100);

// Consume values using for-await-of
for await (const value of queue) {
  console.log(value); // 1, 2, 3
}
```

### Synchronous Iterables

Use `createIterable` for synchronous queue buffering where values are pushed and consumed within the same execution context.

```typescript
import { createIterable } from "@thani-sh/iterables";

const queue = createIterable<string>();

queue.push("hello");
queue.push("world");
queue.complete();

// Consume values using for-of
for (const value of queue) {
  console.log(value); // "hello", "world"
}
```
