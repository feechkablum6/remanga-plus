import { test } from "node:test";
import assert from "node:assert/strict";

import {
  READER_LINK_SELECTOR,
  buildRemangaTitleUrl,
  isReaderPathname,
  matchReaderChapterId,
  matchReaderLocation,
} from "../src/remanga-routes.js";

test("isReaderPathname accepts both reader prefixes", () => {
  assert.equal(isReaderPathname("/manga/solo-leveling_/211773"), true);
  assert.equal(isReaderPathname("/content/solo-leveling_/211773"), true);
  assert.equal(isReaderPathname("/content/solo-leveling_/211773/"), true);
});

test("isReaderPathname rejects non-reader pages", () => {
  assert.equal(isReaderPathname("/"), false);
  assert.equal(isReaderPathname("/catalog"), false);
  assert.equal(isReaderPathname("/manga/solo-leveling_/main"), false);
  assert.equal(isReaderPathname("/content/solo-leveling_/main"), false);
  assert.equal(isReaderPathname("/user/bookmarks"), false);
});

test("matchReaderLocation reads dir and chapter from both prefixes", () => {
  assert.deepEqual(
    matchReaderLocation("https://remanga.org/manga/solo-leveling_/211773"),
    { titleDir: "solo-leveling_", chapterId: 211773 },
  );
  assert.deepEqual(
    matchReaderLocation("https://remanga.org/content/solo-leveling_/211773?page=1"),
    { titleDir: "solo-leveling_", chapterId: 211773 },
  );
});

test("matchReaderLocation keeps the encoded dir untouched", () => {
  assert.deepEqual(
    matchReaderLocation(
      "https://remanga.org/content/%3C29.04.2026%3Ethe-celestial-horse-cant-live-ordinary/868135?page=1",
    ),
    {
      titleDir: "%3C29.04.2026%3Ethe-celestial-horse-cant-live-ordinary",
      chapterId: 868135,
    },
  );
});

test("matchReaderLocation ignores title and non-chapter urls", () => {
  assert.equal(matchReaderLocation("https://remanga.org/manga/solo-leveling_/main"), null);
  assert.equal(matchReaderLocation("https://remanga.org/catalog"), null);
  assert.equal(matchReaderLocation(null), null);
  assert.equal(matchReaderLocation(undefined), null);
});

test("matchReaderChapterId returns the chapter id for both prefixes", () => {
  assert.equal(matchReaderChapterId("/manga/solo-leveling_/211772"), 211772);
  assert.equal(matchReaderChapterId("/content/solo-leveling_/211772"), 211772);
  assert.equal(matchReaderChapterId("/manga/solo-leveling_/main"), null);
});

test("buildRemangaTitleUrl does not double-encode an encoded dir", () => {
  assert.equal(
    buildRemangaTitleUrl("%3C29.04.2026%3Ei-am-a-fulltime-newbie-exclusive_"),
    "https://remanga.org/manga/%3C29.04.2026%3Ei-am-a-fulltime-newbie-exclusive_/main",
  );
});

test("buildRemangaTitleUrl encodes a raw dir", () => {
  assert.equal(
    buildRemangaTitleUrl("<29.04.2026>i-am-a-fulltime-newbie-exclusive_"),
    "https://remanga.org/manga/%3C29.04.2026%3Ei-am-a-fulltime-newbie-exclusive_/main",
  );
  assert.equal(
    buildRemangaTitleUrl("solo-leveling_"),
    "https://remanga.org/manga/solo-leveling_/main",
  );
});

test("READER_LINK_SELECTOR covers both prefixes", () => {
  assert.match(READER_LINK_SELECTOR, /\/manga\//);
  assert.match(READER_LINK_SELECTOR, /\/content\//);
});
