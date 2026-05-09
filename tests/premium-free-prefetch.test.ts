import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  prewarmPremiumFreeChapter,
  resetPremiumFreePrefetchDedup,
  type PremiumFreeResolverFn,
} from "../src/premium-free-prefetch.js";
import type {
  PremiumFreeClientResolveResult,
  RemangaChapterReference,
} from "../src/premium-free.js";

const reference = (
  partial: Partial<RemangaChapterReference> = {},
): RemangaChapterReference => ({
  titleDir: "demo-title",
  titleName: "Demo",
  aliases: [],
  chapter: "10",
  chapterId: 1234,
  chapterUrl: "https://remanga.org/manga/demo-title/1234",
  ...partial,
});

const successResult = (
  pages: Array<{ index: number; proxyUrl: string }>,
): PremiumFreeClientResolveResult => ({
  status: "success",
  provider: "mangabuff",
  matchedTitle: {
    titleId: "x",
    slug: "x",
    titleName: "Demo",
    titleUrl: "https://example.test/x",
  },
  matchedChapter: {
    chapterId: "y",
    chapter: "10",
    volume: 1,
    chapterUrl: "https://example.test/x/10",
  },
  manualUrl: "https://example.test/search",
  nextChapter: null,
  totalPages: pages.length,
  pages,
});

test("prewarmPremiumFreeChapter calls prewarmImage for each proxyUrl after successful resolve", async () => {
  resetPremiumFreePrefetchDedup();
  const resolver: PremiumFreeResolverFn = async () =>
    successResult([
      { index: 0, proxyUrl: "/proxy/img/a.webp" },
      { index: 1, proxyUrl: "/proxy/img/b.webp" },
      { index: 2, proxyUrl: "/proxy/img/c.webp" },
    ]);

  const prewarmedImages: string[] = [];
  await prewarmPremiumFreeChapter(reference({ chapterId: 1234 }), resolver, {
    prewarmImage: async (proxyUrl) => {
      prewarmedImages.push(proxyUrl);
    },
  });

  assert.deepEqual(prewarmedImages.sort(), [
    "/proxy/img/a.webp",
    "/proxy/img/b.webp",
    "/proxy/img/c.webp",
  ]);
});

test("prewarmPremiumFreeChapter dedups repeated calls for same titleDir+chapterId", async () => {
  resetPremiumFreePrefetchDedup();
  let resolverCalls = 0;
  const resolver: PremiumFreeResolverFn = async () => {
    resolverCalls += 1;
    return successResult([{ index: 0, proxyUrl: "/proxy/img/x.webp" }]);
  };

  let imageCalls = 0;
  const prewarmImage = async () => {
    imageCalls += 1;
  };

  await prewarmPremiumFreeChapter(reference({ chapterId: 50 }), resolver, {
    prewarmImage,
  });
  await prewarmPremiumFreeChapter(reference({ chapterId: 50 }), resolver, {
    prewarmImage,
  });

  assert.equal(resolverCalls, 1);
  assert.equal(imageCalls, 1);
});

test("prewarmPremiumFreeChapter does not call prewarmImage on failure status", async () => {
  resetPremiumFreePrefetchDedup();
  const resolver: PremiumFreeResolverFn = async () => ({
    status: "failure",
    reason: "no_match",
    provider: "mangabuff",
    manualUrl: "https://example.test/search",
  });

  let imageCalls = 0;
  await prewarmPremiumFreeChapter(reference({ chapterId: 99 }), resolver, {
    prewarmImage: async () => {
      imageCalls += 1;
    },
  });

  assert.equal(imageCalls, 0);
});

test("prewarmPremiumFreeChapter does not dedup after failure (allows retry)", async () => {
  resetPremiumFreePrefetchDedup();
  let calls = 0;
  const resolver: PremiumFreeResolverFn = async () => {
    calls += 1;
    if (calls === 1) {
      return {
        status: "failure",
        reason: "provider_error",
        provider: "mangabuff",
        manualUrl: "https://example.test/search",
      };
    }
    return successResult([{ index: 0, proxyUrl: "/proxy/img/x.webp" }]);
  };

  await prewarmPremiumFreeChapter(reference({ chapterId: 77 }), resolver, {
    prewarmImage: async () => {},
  });
  await prewarmPremiumFreeChapter(reference({ chapterId: 77 }), resolver, {
    prewarmImage: async () => {},
  });

  assert.equal(calls, 2);
});

test("prewarmPremiumFreeChapter is silent on resolver throw", async () => {
  resetPremiumFreePrefetchDedup();
  const resolver: PremiumFreeResolverFn = async () => {
    throw new Error("network");
  };

  await assert.doesNotReject(
    prewarmPremiumFreeChapter(reference({ chapterId: 1 }), resolver, {
      prewarmImage: async () => {},
    }),
  );
});

test("prewarmPremiumFreeChapter swallows individual prewarmImage errors and continues", async () => {
  resetPremiumFreePrefetchDedup();
  const resolver: PremiumFreeResolverFn = async () =>
    successResult([
      { index: 0, proxyUrl: "/proxy/img/ok-1.webp" },
      { index: 1, proxyUrl: "/proxy/img/fail.webp" },
      { index: 2, proxyUrl: "/proxy/img/ok-2.webp" },
    ]);

  const succeeded: string[] = [];
  await prewarmPremiumFreeChapter(reference({ chapterId: 5 }), resolver, {
    prewarmImage: async (proxyUrl) => {
      if (proxyUrl.includes("fail")) throw new Error("blob fetch failed");
      succeeded.push(proxyUrl);
    },
  });

  assert.deepEqual(succeeded.sort(), [
    "/proxy/img/ok-1.webp",
    "/proxy/img/ok-2.webp",
  ]);
});

test("prewarmPremiumFreeChapter works without prewarmImage option (resolver-only prewarm)", async () => {
  resetPremiumFreePrefetchDedup();
  let calls = 0;
  const resolver: PremiumFreeResolverFn = async () => {
    calls += 1;
    return successResult([{ index: 0, proxyUrl: "/proxy/img/x.webp" }]);
  };

  // No prewarmImage — caller only wants the resolve cache populated.
  await prewarmPremiumFreeChapter(reference({ chapterId: 42 }), resolver);

  assert.equal(calls, 1);
});
