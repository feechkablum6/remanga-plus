import assert from "node:assert/strict";
import test from "node:test";

import { mapWithConcurrency } from "../src/async-pool.js";

const defer = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

test("preserves result order regardless of completion order", async () => {
  const results = await mapWithConcurrency([3, 1, 2], 3, async (value) => {
    await defer(value * 5);
    return value * 10;
  });
  assert.deepEqual(results, [30, 10, 20]);
});

test("processes every item", async () => {
  const input = Array.from({ length: 25 }, (_, i) => i);
  const results = await mapWithConcurrency(input, 4, async (value) => value + 1);
  assert.deepEqual(
    results,
    input.map((v) => v + 1),
  );
});

test("never exceeds the concurrency limit", async () => {
  let active = 0;
  let peak = 0;
  const input = Array.from({ length: 20 }, (_, i) => i);
  await mapWithConcurrency(input, 5, async () => {
    active += 1;
    peak = Math.max(peak, active);
    await defer(5);
    active -= 1;
    return null;
  });
  assert.equal(peak, 5);
});

test("returns empty array for empty input without invoking fn", async () => {
  let calls = 0;
  const results = await mapWithConcurrency([], 4, async () => {
    calls += 1;
    return calls;
  });
  assert.deepEqual(results, []);
  assert.equal(calls, 0);
});

test("passes the item index to fn", async () => {
  const results = await mapWithConcurrency(["a", "b", "c"], 2, async (value, index) =>
    `${value}${index}`,
  );
  assert.deepEqual(results, ["a0", "b1", "c2"]);
});

test("rejects a limit below 1", async () => {
  await assert.rejects(
    () => mapWithConcurrency([1], 0, async (v) => v),
    /limit/,
  );
});
