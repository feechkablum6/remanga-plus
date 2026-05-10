import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/mangalib-bridge.ts"), "utf8");

test("bridge listens for the read-token message", () => {
  assert.match(source, /import-mangalib\/read-mangalib-token/);
  assert.match(source, /chrome\.runtime\.onMessage\.addListener/);
});

test("bridge reads localStorage.auth.token.access_token", () => {
  assert.match(source, /localStorage\.getItem\("auth"\)/);
  assert.match(source, /access_token/);
});

test("bridge replies with token and userId or nulls", () => {
  assert.match(source, /sendResponse/);
  assert.match(source, /token: null/);
  assert.match(source, /userId: null/);
});

test("bridge handles proxied-fetch by calling fetch with provided url and headers", () => {
  assert.match(source, /import-mangalib\/proxied-fetch/);
  assert.match(source, /fetch\(/);
});
