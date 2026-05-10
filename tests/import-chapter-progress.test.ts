import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectChaptersToMark,
  type RemangaChapter,
} from "../src/import-mangalib/chapter-progress.js";

const chapters: RemangaChapter[] = [
  { id: 101, index: 1 },
  { id: 102, index: 2 },
  { id: 103, index: 3 },
  { id: 104, index: 4 },
  { id: 105, index: 5 },
];

test("returns ids for chapters with index ≤ lastRead", () => {
  assert.deepEqual(selectChaptersToMark(chapters, 3), [101, 102, 103]);
});

test("empty when lastRead is null", () => {
  assert.deepEqual(selectChaptersToMark(chapters, null), []);
});

test("empty when lastRead is 0", () => {
  assert.deepEqual(selectChaptersToMark(chapters, 0), []);
});

test("handles fractional indices", () => {
  const c: RemangaChapter[] = [
    { id: 1, index: 1 },
    { id: 2, index: 1.5 },
    { id: 3, index: 2 },
  ];
  assert.deepEqual(selectChaptersToMark(c, 1.5), [1, 2]);
});

test("when lastRead exceeds available, returns all", () => {
  assert.deepEqual(selectChaptersToMark(chapters, 999), [101, 102, 103, 104, 105]);
});

test("ignores chapters with non-finite index", () => {
  const c: RemangaChapter[] = [
    { id: 1, index: 1 },
    { id: 2, index: NaN },
    { id: 3, index: 2 },
  ];
  assert.deepEqual(selectChaptersToMark(c, 3), [1, 3]);
});
