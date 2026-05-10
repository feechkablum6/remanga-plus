import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseMangalibBookmarks } from "../src/import-mangalib/bookmarks-parser.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/bookmarks.json"), "utf8"),
);
const emptyFixture = JSON.parse(
  readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/bookmarks-empty.json"), "utf8"),
);

test("parses 5 bookmarks from real fixture", () => {
  const out = parseMangalibBookmarks(fixture);
  assert.equal(out.length, 5);
  for (const b of out) {
    assert.equal(typeof b.bookmarkId, "number");
    assert.equal(typeof b.slug, "string");
    assert.ok(b.slug.length > 0);
    assert.ok(b.rusName.length > 0 || b.engName.length > 0 || b.shortName.length > 0);
    assert.ok([1, 2, 3, 4, 5].includes(b.status));
  }
});

test("progress is parsed from string to number or null when zero/missing", () => {
  const out = parseMangalibBookmarks(fixture);
  // In our fixture all five have progress: "0" → mapped to null (no chapters read)
  for (const b of out) {
    assert.equal(b.lastReadChapter, null);
  }
});

test("non-zero numeric progress string is parsed to number", () => {
  const synthetic = {
    data: [
      {
        id: 1,
        type: "media-bookmark",
        status: 1,
        progress: "12",
        media: { id: 1, name: "n", rus_name: "r", eng_name: "e", slug: "s", slug_url: "s", items_count: { uploaded: 12, total: 100 } },
      },
    ],
  };
  const out = parseMangalibBookmarks(synthetic);
  assert.equal(out[0].lastReadChapter, 12);
});

test("returns empty array for empty fixture", () => {
  assert.deepEqual(parseMangalibBookmarks(emptyFixture), []);
});

test("returns empty array on null/undefined", () => {
  assert.deepEqual(parseMangalibBookmarks(null as unknown as object), []);
  assert.deepEqual(parseMangalibBookmarks(undefined as unknown as object), []);
});
