import { expect, test, mock } from "bun:test";
import { createAsyncIterable } from "./create-async-iterable.js";

test("createAsyncIterable yields pushed values and completes", async () => {
  const { push, complete, iterable } = createAsyncIterable<number>();

  push(1);
  push(2);
  complete();

  const results: number[] = [];
  for await (const value of iterable) {
    results.push(value);
  }

  expect(results).toEqual([1, 2]);
});

test("createAsyncIterable allows direct iteration on controller", async () => {
  const controller = createAsyncIterable<string>();

  controller.push("hello");
  controller.push("world");
  controller.complete();

  const results: string[] = [];
  for await (const value of controller) {
    results.push(value);
  }

  expect(results).toEqual(["hello", "world"]);
});

test("createAsyncIterable resolves pending promises when values are pushed", async () => {
  const { push, iterable } = createAsyncIterable<number>();
  const iterator = iterable[Symbol.asyncIterator]();

  const nextPromise1 = iterator.next();
  const nextPromise2 = iterator.next();

  push(10);
  push(20);

  const res1 = await nextPromise1;
  const res2 = await nextPromise2;

  expect(res1).toEqual({ value: 10, done: false });
  expect(res2).toEqual({ value: 20, done: false });
});

test("createAsyncIterable handles error propagation and rejection", async () => {
  const { push, reject, iterable } = createAsyncIterable<number>();
  const iterator = iterable[Symbol.asyncIterator]();

  push(100);
  const nextPromise1 = iterator.next();
  const nextPromise2 = iterator.next();

  reject(new Error("Async Error"));

  const res1 = await nextPromise1;
  expect(res1).toEqual({ value: 100, done: false });

  expect(nextPromise2).rejects.toThrow("Async Error");
  expect(iterator.next()).rejects.toThrow("Async Error");
});

test("createAsyncIterable triggers cleanup on complete", () => {
  const cleanupMock = mock(() => {});
  const { complete } = createAsyncIterable<number>({
    onCleanup: cleanupMock,
  });

  expect(cleanupMock).toHaveBeenCalledTimes(0);
  complete();
  expect(cleanupMock).toHaveBeenCalledTimes(1);
});

test("createAsyncIterable triggers cleanup on reject", () => {
  const cleanupMock = mock(() => {});
  const { reject } = createAsyncIterable<number>({
    onCleanup: cleanupMock,
  });

  expect(cleanupMock).toHaveBeenCalledTimes(0);
  reject(new Error("Fail"));
  expect(cleanupMock).toHaveBeenCalledTimes(1);
});
