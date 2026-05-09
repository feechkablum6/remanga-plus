import assert from "node:assert/strict";
import test from "node:test";

import {
  createPremiumFreeStreamReference,
  createPremiumFreeCacheEntry,
  derivePremiumFreeTargetReference,
  describePremiumFreeFailure,
  extractRemangaChapterReference,
  pickPremiumFreeActivePage,
  readPremiumFreeBranchPreference,
  readPremiumFreeCacheEntry,
  shouldPrefetchPremiumFreeNextChapter,
  shouldPrefetchPremiumFreeNextChapterByViewport,
  writePremiumFreeBranchPreference,
} from "../src/premium-free.js";

test("extracts remanga chapter metadata for premium-free resolution", () => {
  const result = extractRemangaChapterReference({
    href: "https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1",
    canonicalHref: "https://remanga.org/manga/the-return-of-the-immortals_/1910899/",
    documentTitle:
      "Читать Манхва Возвращение Еретика 148 глава 3 том бесплатно онлайн на русском языке — ReManga",
    descriptionContent:
      "Читать Манхва Возвращение Еретика 148 глава 3 том бесплатно онлайн на русском языке. Это произведение также известно как The Return of the Immortals / Chronicles Of The Martial God’s Return, 무신귀환록, Chronicles of a Returner.",
    headerTitle: "Возвращение Еретика",
    headerChapterLabel: "3 - 148",
  });

  assert.deepEqual(result, {
    titleDir: "the-return-of-the-immortals_",
    titleName: "Возвращение Еретика",
    aliases: [
      "The Return of the Immortals",
      "Chronicles Of The Martial God’s Return",
      "무신귀환록",
      "Chronicles of a Returner",
    ],
    tome: 3,
    chapter: "148",
    chapterId: 1910899,
    chapterUrl: "https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1",
  });
});

test("returns null when chapter metadata cannot be resolved", () => {
  const result = extractRemangaChapterReference({
    href: "https://remanga.org/catalog/test",
    canonicalHref: null,
    documentTitle: "ReManga",
    descriptionContent: null,
    headerTitle: null,
    headerChapterLabel: null,
  });

  assert.equal(result, null);
});

test("keeps startup failures visible briefly before allowing a retry", () => {
  const entry = createPremiumFreeCacheEntry(
    {
      status: "failure",
      reason: "resolver_unavailable",
      provider: "mangabuff",
      manualUrl: "https://mangabuff.ru/search?type=manga&q=test",
    },
    1_000,
  );

  assert.deepEqual(readPremiumFreeCacheEntry(entry, 1_500), entry.result);
  assert.equal(readPremiumFreeCacheEntry(entry, 4_500), null);
});

test("keeps successful resolve results without expiration", () => {
  const entry = createPremiumFreeCacheEntry(
    {
      status: "success",
      provider: "mangabuff",
      matchedTitle: {
        titleId: "title-id",
        slug: "slug",
        titleName: "Title",
        titleUrl: "https://mangabuff.ru/manga/slug",
      },
      matchedChapter: {
        chapterId: "3-148",
        chapter: "148",
        volume: 3,
        chapterUrl: "https://mangabuff.ru/manga/slug/3/148",
      },
      manualUrl: "https://mangabuff.ru/manga/slug/3/148",
      nextChapter: {
        chapterId: "3-149",
        chapter: "149",
        volume: 3,
        chapterUrl: "https://mangabuff.ru/manga/slug/3/149",
      },
      totalPages: 1,
      pages: [
        {
          index: 0,
          proxyUrl: "/api/images/test",
        },
      ],
    },
    1_000,
  );

  assert.deepEqual(readPremiumFreeCacheEntry(entry, 99_000), entry.result);
});

test("derives the paid-next parser target from an inline premium banner on free chapters", () => {
  const result = derivePremiumFreeTargetReference({
    currentReference: {
      titleDir: "the-return-of-the-immortals_",
      titleName: "Возвращение Еретика",
      aliases: ["The Return of the Immortals"],
      tome: 3,
      chapter: "147",
      chapterId: 1905104,
      chapterUrl: "https://remanga.org/manga/the-return-of-the-immortals_/1905104?page=1",
    },
    hasNativeReaderPages: true,
    bannerText: "Том 3 глава 148 Откроется 22.03.2026 00:00 Открыть за 20",
    nextChapterHref: "https://remanga.org/manga/the-return-of-the-immortals_/1910899",
  });

  assert.deepEqual(result, {
    titleDir: "the-return-of-the-immortals_",
    titleName: "Возвращение Еретика",
    aliases: ["The Return of the Immortals"],
    tome: 3,
    chapter: "148",
    chapterId: 1910899,
    chapterUrl: "https://remanga.org/manga/the-return-of-the-immortals_/1910899",
  });
});

test("keeps the current reference for standalone paid chapter pages", () => {
  const currentReference = {
    titleDir: "the-return-of-the-immortals_",
    titleName: "Возвращение Еретика",
    aliases: ["The Return of the Immortals"],
    tome: 3,
    chapter: "148",
    chapterId: 1910899,
    chapterUrl: "https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1",
  };

  const result = derivePremiumFreeTargetReference({
    currentReference,
    hasNativeReaderPages: false,
    bannerText: "Том 3 глава 148 Откроется 22.03.2026 00:00 Открыть за 20",
    nextChapterHref: "https://remanga.org/manga/the-return-of-the-immortals_/1915807",
  });

  assert.deepEqual(result, currentReference);
});

test("builds synthetic follow-up references from parser next-chapter metadata", () => {
  const result = createPremiumFreeStreamReference(
    {
      titleDir: "the-return-of-the-immortals_",
      titleName: "Возвращение Еретика",
      aliases: ["The Return of the Immortals"],
      tome: 3,
      chapter: "148",
      chapterId: 1910899,
      chapterUrl: "https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1",
    },
    {
      chapterId: "3-149",
      chapter: "149",
      volume: 3,
      chapterUrl: "https://mangabuff.ru/manga/slug/3/149",
    },
  );

  assert.deepEqual(result, {
    titleDir: "the-return-of-the-immortals_",
    titleName: "Возвращение Еретика",
    aliases: ["The Return of the Immortals"],
    tome: 3,
    chapter: "149",
    chapterUrl: "https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1",
  });
});

test("prefetches the next parser chapter when the last page of the last stream section becomes active", () => {
  assert.equal(
    shouldPrefetchPremiumFreeNextChapter({
      activePageIndex: 11,
      totalPages: 12,
      isLastStreamEntry: true,
      streamStatus: "idle",
    }),
    true,
  );

  assert.equal(
    shouldPrefetchPremiumFreeNextChapter({
      activePageIndex: 10,
      totalPages: 12,
      isLastStreamEntry: true,
      streamStatus: "idle",
    }),
    false,
  );

  assert.equal(
    shouldPrefetchPremiumFreeNextChapter({
      activePageIndex: 11,
      totalPages: 12,
      isLastStreamEntry: false,
      streamStatus: "idle",
    }),
    false,
  );

  assert.equal(
    shouldPrefetchPremiumFreeNextChapter({
      activePageIndex: 11,
      totalPages: 12,
      isLastStreamEntry: true,
      streamStatus: "loading-next",
    }),
    false,
  );
});

test("picks the active parser page from viewport geometry when observer ratios are unreliable", () => {
  assert.deepEqual(
    pickPremiumFreeActivePage(
      [
        {
          key: "the-return-of-the-immortals_:3:149",
          pageIndex: 0,
          top: -3200,
          bottom: -120,
        },
        {
          key: "the-return-of-the-immortals_:3:149",
          pageIndex: 1,
          top: -80,
          bottom: 1880,
        },
        {
          key: "the-return-of-the-immortals_:3:149",
          pageIndex: 2,
          top: 1880,
          bottom: 3920,
        },
      ],
      900,
    ),
    {
      key: "the-return-of-the-immortals_:3:149",
      pageIndex: 1,
    },
  );

  assert.equal(
    pickPremiumFreeActivePage(
      [
        {
          key: "the-return-of-the-immortals_:3:149",
          pageIndex: 0,
          top: -4200,
          bottom: -40,
        },
      ],
      900,
    ),
    null,
  );
});

test("uses the provider-specific display name in the failure button label", () => {
  const mangabuffFailure = describePremiumFreeFailure(
    {
      status: "failure",
      reason: "chapter_not_found",
      provider: "mangabuff",
      manualUrl: "https://mangabuff.ru/manga/x",
    },
    "Возвращение Еретика",
  );
  assert.equal(mangabuffFailure.linkLabel, "Открыть Mangabuff");

  const senkuroFailure = describePremiumFreeFailure(
    {
      status: "failure",
      reason: "chapter_not_found",
      provider: "senkuro",
      manualUrl: "https://senkuro.com/manga/x",
    },
    "Башня Бога",
  );
  assert.equal(senkuroFailure.linkLabel, "Открыть Senkuro");

  const inkstoryFailure = describePremiumFreeFailure(
    {
      status: "failure",
      reason: "chapter_not_found",
      provider: "inkstory",
      manualUrl: "https://inkstory.net/content/x",
    },
    "Solo Leveling",
  );
  assert.equal(inkstoryFailure.linkLabel, "Открыть InkStory");
});

test("uses a generic 'Открыть источник' label for unknown providers", () => {
  const unknownFailure = describePremiumFreeFailure(
    {
      status: "failure",
      reason: "provider_error",
      provider: "unknown",
      manualUrl: "",
    },
    "Какой-то тайтл",
  );
  assert.equal(unknownFailure.linkLabel, "Открыть источник");
});

test("install_required failure keeps provider-specific label with 'вручную' suffix", () => {
  const senkuroInstall = describePremiumFreeFailure(
    {
      status: "failure",
      reason: "install_required",
      provider: "senkuro",
      manualUrl: "https://senkuro.com/browse/manga?search=x",
    },
    "Башня Бога",
  );
  assert.equal(senkuroInstall.linkLabel, "Открыть Senkuro вручную");
});

test("readPremiumFreeBranchPreference returns null when no matching entry", () => {
  assert.equal(readPremiumFreeBranchPreference(null, "solo-leveling"), null);
  assert.equal(readPremiumFreeBranchPreference({}, "solo-leveling"), null);
});

test("writePremiumFreeBranchPreference stores under titleDir key, does not mutate input", () => {
  const before = { foo: { provider: "inkstory", branchId: "old" } };
  const after = writePremiumFreeBranchPreference(before, "solo-leveling", {
    provider: "inkstory",
    branchId: "branch-xyz",
  });
  assert.deepEqual(before, { foo: { provider: "inkstory", branchId: "old" } });
  assert.deepEqual(after["solo-leveling"], {
    provider: "inkstory",
    branchId: "branch-xyz",
  });
  assert.deepEqual(after["foo"], { provider: "inkstory", branchId: "old" });

  assert.equal(
    readPremiumFreeBranchPreference(after, "solo-leveling")?.branchId,
    "branch-xyz",
  );
});

test("clearStalePremiumFreeBranchPreference removes entry when server didn't honor forcedBranchId", async () => {
  const { clearStalePremiumFreeBranchPreference } = await import(
    "../src/premium-free.js"
  );
  const prefs = {
    "solo-leveling": { provider: "inkstory", branchId: "REQ" },
  };

  // server returned success with a DIFFERENT selectedBranchId → stale
  const stale = clearStalePremiumFreeBranchPreference(prefs, "solo-leveling", "REQ", {
    status: "success",
    branches: [
      { id: "OTHER", name: "x", chaptersCount: 1 },
      { id: "REQ", name: "y", chaptersCount: 0 },
    ],
    selectedBranchId: "OTHER",
  });
  assert.equal(stale["solo-leveling"], undefined);

  // honored — keep
  const honored = clearStalePremiumFreeBranchPreference(prefs, "solo-leveling", "REQ", {
    status: "success",
    branches: [{ id: "REQ", name: "y", chaptersCount: 1 }],
    selectedBranchId: "REQ",
  });
  assert.deepEqual(honored, prefs);

  // no forcedBranchId requested → never invalidate
  const never = clearStalePremiumFreeBranchPreference(prefs, "solo-leveling", null, {
    status: "success",
    branches: [{ id: "X", name: "y", chaptersCount: 1 }],
    selectedBranchId: "X",
  });
  assert.deepEqual(never, prefs);

  // source has no branches (e.g. mangabuff) → keep (may apply on fallback later)
  const noBranchSource = clearStalePremiumFreeBranchPreference(
    prefs,
    "solo-leveling",
    "REQ",
    { status: "success" },
  );
  assert.deepEqual(noBranchSource, prefs);

  // failure → keep, might be transient
  const onFailure = clearStalePremiumFreeBranchPreference(
    prefs,
    "solo-leveling",
    "REQ",
    { status: "failure" },
  );
  assert.deepEqual(onFailure, prefs);
});

test("writePremiumFreeBranchPreference overwrites existing entry for same titleDir", () => {
  const first = writePremiumFreeBranchPreference({}, "foo", {
    provider: "inkstory",
    branchId: "b1",
  });
  const second = writePremiumFreeBranchPreference(first, "foo", {
    provider: "senkuro",
    branchId: "b2",
  });
  assert.deepEqual(second["foo"], { provider: "senkuro", branchId: "b2" });
});

test("prefetches the next parser chapter when the viewport approaches the stream end", () => {
  assert.equal(
    shouldPrefetchPremiumFreeNextChapterByViewport({
      distanceToViewportBottom: 960,
      hasNextChapter: true,
      streamStatus: "idle",
    }),
    true,
  );

  assert.equal(
    shouldPrefetchPremiumFreeNextChapterByViewport({
      distanceToViewportBottom: 2400,
      hasNextChapter: true,
      streamStatus: "idle",
    }),
    false,
  );

  assert.equal(
    shouldPrefetchPremiumFreeNextChapterByViewport({
      distanceToViewportBottom: 960,
      hasNextChapter: false,
      streamStatus: "idle",
    }),
    false,
  );

  assert.equal(
    shouldPrefetchPremiumFreeNextChapterByViewport({
      distanceToViewportBottom: 960,
      hasNextChapter: true,
      streamStatus: "loading-next",
    }),
    false,
  );
});
