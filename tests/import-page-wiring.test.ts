import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/import-page.ts"), "utf8");

test("imports orchestrator and clients", () => {
  assert.match(source, /from "\.\/import-mangalib\/orchestrator\.js"/);
  assert.match(source, /from "\.\/import-mangalib\/mangalib-client\.js"/);
  assert.match(source, /from "\.\/import-mangalib\/remanga-client\.js"/);
});

test("calls runImport.buildPreview and runImport.execute", () => {
  assert.match(source, /runImport\.buildPreview/);
  assert.match(source, /runImport\.execute/);
});

test("reads mangalib token via runtime.sendMessage to background", () => {
  assert.match(source, /CHECK_AUTH_MESSAGE_TYPE/);
});

test("persists state via state.ts", () => {
  assert.match(source, /from "\.\/import-mangalib\/state\.js"/);
});

test("import-page proxies mangalib API through background bridge", () => {
  assert.match(source, /MANGALIB_PROXIED_FETCH_MESSAGE_TYPE/);
  assert.match(source, /fetchMangalibBookmarks\(mangalibTokenProvider, 1, /);
});

test("import-page wires real fetchExistingRemangaBookmarks (safety: never auto-touch existing)", () => {
  assert.match(source, /fetchExistingRemangaBookmarks/);
  assert.doesNotMatch(source, /fetchExistingBookmarks: async \(\) => new Set</);
});
