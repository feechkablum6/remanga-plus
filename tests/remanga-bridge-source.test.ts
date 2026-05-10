import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/remanga-bridge.ts"), "utf8");

test("remanga-bridge listens for read-remanga-bookmark-types", () => {
  assert.match(source, /import-mangalib\/read-remanga-bookmark-types/);
  assert.match(source, /chrome\.runtime\.onMessage\.addListener/);
});

test("remanga-bridge reads bookmark category names from DOM tabs", () => {
  assert.match(source, /role="tab"|\[role="tab"\]/);
  assert.match(source, /trigger-/);
});
