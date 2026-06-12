# Iterables

A lightweight utility for creating queue-backed synchronous and asynchronous iterables.

## Getting Started

```bash
bun add @thani-sh/iterables
```

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
