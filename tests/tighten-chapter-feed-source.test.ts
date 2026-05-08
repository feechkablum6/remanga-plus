import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync("src/reader-enhancer.ts", "utf8");

test("reader-enhancer ships CSS that zeroes the InfiniteReader gap", () => {
  // Remanga's feed-mode wraps every chapter in a <div data-sentry-component="InfiniteReader">
  // with `gap-8` (32px) and `mb-16` (64px). The toggle should kill both so chapters
  // sit flush against each other.
  assert.match(
    SOURCE,
    /InfiniteReader/,
    "stylesheet must reference the InfiniteReader component selector",
  );
  assert.match(
    SOURCE,
    /tighten-chapter-feed/,
    "stylesheet must gate the rule on the data-rre-tighten-chapter-feed attribute",
  );
  assert.match(
    SOURCE,
    /gap:\s*0/,
    "stylesheet must zero gap on InfiniteReader when toggle is on",
  );
});

test("reader-enhancer applies the tighten-chapter-feed attribute from settings", () => {
  // syncReaderEnhancer should toggle the documentElement attribute based on
  // settings.tightenChapterFeed so the CSS rule above takes effect immediately.
  assert.match(
    SOURCE,
    /tightenChapterFeed/,
    "reader-enhancer must read the tightenChapterFeed setting",
  );
  assert.match(
    SOURCE,
    /data-rre-tighten-chapter-feed/,
    "reader-enhancer must mention the data attribute it toggles on documentElement",
  );
});
