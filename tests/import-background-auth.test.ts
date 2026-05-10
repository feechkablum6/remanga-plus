import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/background.ts"), "utf8");

test("background.ts handles check-auth message", () => {
  assert.match(source, /import-mangalib\/check-auth/);
});

test("background.ts dispatches to mangalib- and remanga-client auth functions", () => {
  assert.match(source, /fetchMangalibAuthStatus/);
  assert.match(source, /fetchRemangaAuthStatus/);
});

test("background.ts forwards read-mangalib-token to a tab", () => {
  assert.match(source, /chrome\.tabs\.query/);
  assert.match(source, /mangalib\.me/);
  assert.match(source, /chrome\.tabs\.sendMessage/);
});

test("background.ts probes host permissions before answering check-auth", () => {
  assert.match(source, /chrome\.permissions\.contains/);
  assert.match(source, /no-permission/);
});

test("background.ts proxies mangalib API calls through the bridge content script", () => {
  assert.match(source, /MANGALIB_PROXIED_FETCH_MESSAGE_TYPE/);
});

test("background.ts answers read-mangalib-token requests forwarded from extension pages", () => {
  assert.match(source, /READ_MANGALIB_TOKEN_MESSAGE_TYPE/);
  assert.match(
    source,
    /message\.type === READ_MANGALIB_TOKEN_MESSAGE_TYPE/,
  );
});

test("background.ts forwards read-remanga-bookmark-types to a remanga.org tab", () => {
  assert.match(source, /READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE/);
  assert.match(source, /remanga\.org/);
});

test("background.ts injects bridge scripts on demand via chrome.scripting.executeScript (resilient to stale tabs)", () => {
  assert.match(source, /chrome\.scripting\.executeScript/);
});
