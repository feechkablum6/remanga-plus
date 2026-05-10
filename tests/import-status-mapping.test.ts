import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MANGALIB_STATUS_READING,
  MANGALIB_STATUS_PLANNED,
  MANGALIB_STATUS_DROPPED,
  MANGALIB_STATUS_READ,
  MANGALIB_STATUS_FAVOURITE,
  REMANGA_CATEGORY_READING,
  REMANGA_CATEGORY_PLANNED,
  REMANGA_CATEGORY_DROPPED,
  REMANGA_CATEGORY_READ,
  REMANGA_CATEGORY_FAVOURITE,
  mapMangalibStatusToRemangaCategoryName,
  MANGALIB_STATUS_TO_REMANGA_NAME,
} from "../src/import-mangalib/status-mapping.js";

test("known MangaLib statuses map to Remanga category names", () => {
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_READING), REMANGA_CATEGORY_READING);
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_PLANNED), REMANGA_CATEGORY_PLANNED);
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_DROPPED), REMANGA_CATEGORY_DROPPED);
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_READ), REMANGA_CATEGORY_READ);
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_FAVOURITE), REMANGA_CATEGORY_FAVOURITE);
});

test("unknown status falls back to Reading", () => {
  assert.equal(mapMangalibStatusToRemangaCategoryName(99), REMANGA_CATEGORY_READING);
  assert.equal(mapMangalibStatusToRemangaCategoryName(0), REMANGA_CATEGORY_READING);
});

test("MANGALIB_STATUS_TO_REMANGA_NAME is exhaustive 1..5", () => {
  for (const k of [1, 2, 3, 4, 5]) {
    assert.ok(k in MANGALIB_STATUS_TO_REMANGA_NAME);
  }
});
