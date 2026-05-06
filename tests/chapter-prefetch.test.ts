import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  extractCurrentChapterIdFromUrl,
  findNextChapterId,
} from "../src/chapter-prefetch.js";

test("extractCurrentChapterIdFromUrl pulls the trailing numeric segment", () => {
  assert.equal(
    extractCurrentChapterIdFromUrl(
      "https://remanga.org/manga/some-title/1915807",
    ),
    1915807,
  );
});

test("extractCurrentChapterIdFromUrl returns null for non-reader paths", () => {
  assert.equal(extractCurrentChapterIdFromUrl("https://remanga.org/"), null);
  assert.equal(
    extractCurrentChapterIdFromUrl("https://remanga.org/manga/some-title"),
    null,
  );
});

test("findNextChapterId returns the chapter immediately after current by id", () => {
  const branchList = [
    { id: 1915805, index: 147 },
    { id: 1915806, index: 148 },
    { id: 1915807, index: 149 },
    { id: 1915808, index: 150 },
  ];
  assert.equal(findNextChapterId(branchList, 1915806), 1915807);
  assert.equal(findNextChapterId(branchList, 1915807), 1915808);
});

test("findNextChapterId tolerates list sorted descending", () => {
  const desc = [
    { id: 1915808, index: 150 },
    { id: 1915807, index: 149 },
    { id: 1915806, index: 148 },
  ];
  assert.equal(findNextChapterId(desc, 1915807), 1915808);
});

test("findNextChapterId returns null when current is the last chapter", () => {
  const branchList = [
    { id: 1, index: 1 },
    { id: 2, index: 2 },
  ];
  assert.equal(findNextChapterId(branchList, 2), null);
});

test("findNextChapterId returns null when current is missing from list", () => {
  const branchList = [
    { id: 1, index: 1 },
    { id: 3, index: 3 },
  ];
  assert.equal(findNextChapterId(branchList, 99), null);
});
