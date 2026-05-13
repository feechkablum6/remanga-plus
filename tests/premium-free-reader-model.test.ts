import assert from "node:assert/strict";
import test from "node:test";

import {
  createPremiumFreeKey,
  createPremiumFreeStreamEntry,
  formatPremiumFreeChapterLabel,
} from "../src/premium-free-reader-model.js";
import type {
  PremiumFreeResolveSuccess,
  RemangaChapterReference,
} from "../src/premium-free.js";

const reference: RemangaChapterReference = {
  titleDir: "demo-title",
  titleName: "Демо",
  aliases: [],
  tome: 3,
  chapter: "148",
  chapterId: 1910899,
  chapterUrl: "https://remanga.org/manga/demo-title/1910899",
};

const success: PremiumFreeResolveSuccess = {
  status: "success",
  provider: "mangabuff",
  matchedTitle: {
    titleId: "demo",
    slug: "demo",
    titleName: "Демо",
    titleUrl: "https://example.test/demo",
  },
  matchedChapter: {
    chapterId: "3-148",
    chapter: "148",
    volume: 3,
    chapterUrl: "https://example.test/demo/3/148",
  },
  manualUrl: "https://example.test/demo/3/148",
  nextChapter: null,
  totalPages: 1,
  pages: [{ index: 0, proxyUrl: "/api/images/demo" }],
};

test("createPremiumFreeKey includes title, tome and chapter", () => {
  assert.equal(createPremiumFreeKey(reference), "demo-title:3:148");
  assert.equal(
    createPremiumFreeKey({ ...reference, tome: undefined }),
    "demo-title:untomed:148",
  );
});

test("formatPremiumFreeChapterLabel mirrors Remanga chapter labels", () => {
  assert.equal(formatPremiumFreeChapterLabel(3, "148"), "3 - 148");
  assert.equal(formatPremiumFreeChapterLabel(undefined, "149"), "149");
});

test("createPremiumFreeStreamEntry keeps the display label and stable key", () => {
  assert.deepEqual(createPremiumFreeStreamEntry(reference, success), {
    key: "demo-title:3:148",
    reference,
    result: success,
    chapterLabel: "3 - 148",
  });
});
