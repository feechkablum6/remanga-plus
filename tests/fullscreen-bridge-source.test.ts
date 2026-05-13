import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve("src/fullscreen-bridge.ts"), "utf8");

test("fullscreen bridge handles clicks with the native Fullscreen API", () => {
  assert.match(source, /document\.addEventListener\(/);
  assert.match(source, /document\.documentElement\.requestFullscreen\(\)/);
  assert.match(source, /document\.exitFullscreen\(\)/);
  assert.match(source, /stopImmediatePropagation\(\)/);
  assert.match(source, /rreFullscreenHandledAt/);
});
