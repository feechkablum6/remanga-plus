import assert from "node:assert/strict";
import test from "node:test";

import {
  derivePremiumFreeTargetReference,
  type RemangaChapterReference,
} from "../src/premium-free.js";

const CURRENT_REFERENCE: RemangaChapterReference = {
  titleDir: "<29.04.2026>the-celestial-horse-cant-live-ordinary",
  titleName: "Реинкарнация тёмного магистра",
  aliases: [],
  tome: 1,
  chapter: "6",
  chapterId: 514422,
  chapterUrl:
    "https://remanga.org/manga/%3C29.04.2026%3Ethe-celestial-horse-cant-live-ordinary/514422",
};

const NEXT_HREF =
  "https://remanga.org/manga/%3C29.04.2026%3Ethe-celestial-horse-cant-live-ordinary/514684";

// Full banner: the chapter header comes first, the volume range is a trailer.
const FULL_BANNER_TEXT =
  "Том 1 глава 7Открыть за 150 монетКупить том за 1000 монетВ том входят 45 глав  (том 1 глава 6 - том 1 глава 50)";

// The BuyChapterActions block that appears at the bottom of the stream has no
// chapter header — only the volume range. Reading a chapter number out of it
// yields the first chapter of the volume, which is not the current chapter.
const BOTTOM_BLOCK_TEXT =
  "Открыть за 150 монетКупить том за 1000 монетВ том входят 45 глав  (том 1 глава 6 - том 1 глава 50)";

test("takes the chapter from the banner header, not from the volume range", () => {
  const target = derivePremiumFreeTargetReference({
    currentReference: CURRENT_REFERENCE,
    hasNativeReaderPages: true,
    bannerText: FULL_BANNER_TEXT,
    nextChapterHref: NEXT_HREF,
  });

  assert.equal(target?.chapter, "7");
  assert.equal(target?.tome, 1);
});

test("returns no target when the block only lists the volume range", () => {
  const target = derivePremiumFreeTargetReference({
    currentReference: CURRENT_REFERENCE,
    hasNativeReaderPages: true,
    bannerText: BOTTOM_BLOCK_TEXT,
    nextChapterHref: NEXT_HREF,
  });

  assert.equal(target, null);
});

test("returns no target when the volume range is the whole text", () => {
  const target = derivePremiumFreeTargetReference({
    currentReference: CURRENT_REFERENCE,
    hasNativeReaderPages: true,
    bannerText: "В том входят 45 глав  (том 1 глава 6 - том 1 глава 50)",
    nextChapterHref: NEXT_HREF,
  });

  assert.equal(target, null);
});

test("still finds the header when the volume range comes first", () => {
  const target = derivePremiumFreeTargetReference({
    currentReference: CURRENT_REFERENCE,
    hasNativeReaderPages: true,
    bannerText:
      "В том входят 45 глав  (том 1 глава 6 - том 1 глава 50)Том 1 глава 7Открыть за 150 монет",
    nextChapterHref: NEXT_HREF,
  });

  assert.equal(target?.chapter, "7");
});

test("keeps fractional chapter numbers intact", () => {
  const target = derivePremiumFreeTargetReference({
    currentReference: CURRENT_REFERENCE,
    hasNativeReaderPages: true,
    bannerText: "Том 2 глава 7.5Открыть за 150 монет",
    nextChapterHref: NEXT_HREF,
  });

  assert.equal(target?.chapter, "7.5");
  assert.equal(target?.tome, 2);
});

test("returns no target when the banner names no tome", () => {
  const target = derivePremiumFreeTargetReference({
    currentReference: CURRENT_REFERENCE,
    hasNativeReaderPages: true,
    bannerText: "Глава 7Открыть за 150 монет",
    nextChapterHref: NEXT_HREF,
  });

  assert.equal(target, null);
});

test("returns no target for empty banner text", () => {
  for (const bannerText of ["", "   ", null]) {
    assert.equal(
      derivePremiumFreeTargetReference({
        currentReference: CURRENT_REFERENCE,
        hasNativeReaderPages: true,
        bannerText,
        nextChapterHref: NEXT_HREF,
      }),
      null,
    );
  }
});

test("keeps the current chapter when the native reader has no pages of its own", () => {
  const target = derivePremiumFreeTargetReference({
    currentReference: CURRENT_REFERENCE,
    hasNativeReaderPages: false,
    bannerText: BOTTOM_BLOCK_TEXT,
    nextChapterHref: NEXT_HREF,
  });

  assert.equal(target, CURRENT_REFERENCE);
});
