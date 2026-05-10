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
