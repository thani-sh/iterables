import { expect, test, mock } from "bun:test";
import { createIterable } from "./create-iterable.js";

test("createIterable yields pushed values and completes", () => {
  const { push, complete, iterable } = createIterable<number>();

  push(1);
  push(2);
  push(3);
  complete();

  const results: number[] = [];
  for (const value of iterable) {
    results.push(value);
  }

  expect(results).toEqual([1, 2, 3]);
});

test("createIterable can be iterated directly via controller", () => {
  const controller = createIterable<string>();

  controller.push("a");
  controller.push("b");
  controller.complete();

  const results: string[] = [];
  for (const value of controller) {
    results.push(value);
  }

  expect(results).toEqual(["a", "b"]);
});

test("createIterable throws error if rejected", () => {
  const { push, reject, iterable } = createIterable<number>();

  push(1);
  reject(new Error("Test Error"));

  const iterator = iterable[Symbol.iterator]();

  expect(iterator.next()).toEqual({ value: 1, done: false });
  expect(() => iterator.next()).toThrow("Test Error");
});

test("createIterable invokes onCleanup callback on complete", () => {
  const cleanupMock = mock(() => {});
  const { push, complete, iterable } = createIterable<number>({
    onCleanup: cleanupMock,
  });

  push(10);
  expect(cleanupMock).toHaveBeenCalledTimes(0);

  complete();
  expect(cleanupMock).toHaveBeenCalledTimes(1);

  // Subsequent completes do not trigger cleanup again
  complete();
  expect(cleanupMock).toHaveBeenCalledTimes(1);
});

test("createIterable invokes onCleanup callback on reject", () => {
  const cleanupMock = mock(() => {});
  const { reject } = createIterable<number>({
    onCleanup: cleanupMock,
  });

  reject(new Error("Fail"));
  expect(cleanupMock).toHaveBeenCalledTimes(1);
});
