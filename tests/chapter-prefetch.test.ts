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

import { prewarmChapter } from "../src/chapter-prefetch.js";

type FakeLink = {
  rel: string;
  as: string;
  href: string;
  crossOrigin: string;
  setAttribute: (name: string, value: string) => void;
  attributes: Record<string, string>;
};

const installDomStub = (): { children: FakeLink[] } => {
  const head: { children: FakeLink[]; appendChild: (n: FakeLink) => FakeLink } = {
    children: [],
    appendChild(node) {
      this.children.push(node);
      return node;
    },
  };
  const make = (): FakeLink => {
    const node: FakeLink = {
      rel: "",
      as: "",
      href: "",
      crossOrigin: "",
      attributes: {},
      setAttribute(name, value) {
        node.attributes[name] = value;
      },
    };
    return node;
  };
  (globalThis as any).document = {
    head,
    createElement: (_tag: string) => make(),
  };
  return head;
};

const installFetchStub = (
  responses: Record<string, unknown>,
): string[] => {
  const calls: string[] = [];
  (globalThis as any).fetch = async (url: string) => {
    calls.push(url);
    if (responses[url]) {
      return {
        ok: true,
        json: async () => responses[url],
      };
    }
    return { ok: false, json: async () => ({}) };
  };
  return calls;
};

test("prewarmChapter fetches chapter JSON and adds <link rel=preload> for each page", async () => {
  const head = installDomStub();
  installFetchStub({
    "https://api.remanga.org/api/titles/chapters/1915808/": {
      content: {
        is_paid: false,
        pages: [
          [{ link: "https://img.reimg.org/a.webp" }],
          [{ link: "https://img.reimg.org/b.webp" }],
        ],
      },
    },
  });

  await prewarmChapter(1915808);

  const preloads = head.children.filter((n) => n.rel === "preload");
  assert.equal(preloads.length, 2);
  assert.deepEqual(
    preloads.map((p) => p.href).sort(),
    ["https://img.reimg.org/a.webp", "https://img.reimg.org/b.webp"],
  );
});

test("prewarmChapter skips image preload for is_paid chapters", async () => {
  const head = installDomStub();
  installFetchStub({
    "https://api.remanga.org/api/titles/chapters/2/": {
      content: { is_paid: true, pages: [] },
    },
  });

  await prewarmChapter(2);

  const preloads = head.children.filter((n) => n.rel === "preload");
  assert.equal(preloads.length, 0);
});

test("prewarmChapter is silent on network failure", async () => {
  installDomStub();
  (globalThis as any).fetch = async () => {
    throw new Error("network down");
  };

  await assert.doesNotReject(prewarmChapter(99));
});

import { prefetchNextChapter, resetPrefetchDedup } from "../src/chapter-prefetch.js";

test("prefetchNextChapter looks up branch by index ordering and prewarms next", async () => {
  resetPrefetchDedup();
  const head = installDomStub();
  const calls = installFetchStub({
    "https://api.remanga.org/api/titles/chapters/1915807/": {
      content: { id: 1915807, branch_id: 48218, index: 149, is_paid: false, pages: [] },
    },
    "https://api.remanga.org/api/titles/chapters/?branch_id=48218&ordering=index&page=5": {
      content: [
        { id: 1915807, index: 149 },
        { id: 1915808, index: 150 },
      ],
    },
    "https://api.remanga.org/api/titles/chapters/1915808/": {
      content: {
        is_paid: false,
        pages: [[{ link: "https://img.reimg.org/n.webp" }]],
      },
    },
  });

  await prefetchNextChapter("some-title", 1915807);

  // 3 fetches: current chapter (meta), branch list (page 5 since index 149→150 falls into page ceil(150/30)=5), next chapter (preload)
  assert.equal(calls.length, 3);
  assert.ok(
    calls.some((u) => u.includes("ordering=index") && u.includes("page=5")),
    "branch list URL must include ordering=index and the page derived from chapter index",
  );
  // 1 image preload (from next chapter)
  const preloads = head.children.filter((n) => n.rel === "preload");
  assert.equal(preloads.length, 1);
});

test("prefetchNextChapter dedups repeated calls for the same chapterId", async () => {
  resetPrefetchDedup();
  installDomStub();
  const calls = installFetchStub({
    "https://api.remanga.org/api/titles/chapters/100/": {
      content: { branch_id: 1, index: 1, is_paid: false, pages: [] },
    },
    "https://api.remanga.org/api/titles/chapters/?branch_id=1&ordering=index&page=1": {
      content: [{ id: 100, index: 1 }, { id: 101, index: 2 }],
    },
    "https://api.remanga.org/api/titles/chapters/101/": {
      content: { is_paid: false, pages: [] },
    },
  });

  await prefetchNextChapter("title-a", 100);
  await prefetchNextChapter("title-a", 100);

  // dedup means only the first call fetched
  assert.equal(calls.length, 3);
});

test("resetPrefetchDedup clears state when titleDir changes", async () => {
  resetPrefetchDedup();
  installDomStub();
  const calls = installFetchStub({
    "https://api.remanga.org/api/titles/chapters/200/": {
      content: { branch_id: 9, index: 1, is_paid: false, pages: [] },
    },
    "https://api.remanga.org/api/titles/chapters/?branch_id=9&ordering=index&page=1": {
      content: [{ id: 200, index: 1 }, { id: 201, index: 2 }],
    },
    "https://api.remanga.org/api/titles/chapters/201/": {
      content: { is_paid: false, pages: [] },
    },
  });

  await prefetchNextChapter("title-x", 200);
  resetPrefetchDedup();
  await prefetchNextChapter("title-x", 200);

  // 6 fetches: 3 each call after dedup reset
  assert.equal(calls.length, 6);
});

test("prefetchNextChapter is a no-op on the last chapter", async () => {
  resetPrefetchDedup();
  installDomStub();
  const calls = installFetchStub({
    "https://api.remanga.org/api/titles/chapters/300/": {
      content: { branch_id: 5, index: 1, is_paid: false, pages: [] },
    },
    "https://api.remanga.org/api/titles/chapters/?branch_id=5&ordering=index&page=1": {
      content: [{ id: 300, index: 1 }],
    },
  });

  await prefetchNextChapter("title-y", 300);

  // 2 fetches: current + branch list, no next
  assert.equal(calls.length, 2);
});

test("prefetchNextChapter computes correct page for chapter index 30 (boundary)", async () => {
  resetPrefetchDedup();
  installDomStub();
  const calls = installFetchStub({
    "https://api.remanga.org/api/titles/chapters/500/": {
      content: { branch_id: 7, index: 30, is_paid: false, pages: [] },
    },
    // index 31 lives on page 2 (ceil(31/30) = 2)
    "https://api.remanga.org/api/titles/chapters/?branch_id=7&ordering=index&page=2": {
      content: [{ id: 501, index: 31 }, { id: 502, index: 32 }],
    },
    "https://api.remanga.org/api/titles/chapters/501/": {
      content: { is_paid: false, pages: [] },
    },
  });

  await prefetchNextChapter("title-z", 500);

  // Branch list URL must request page=2 (not page=1)
  assert.ok(
    calls.some((u) => u.includes("page=2")),
    "branch list must request page=2 for chapter index 30→31",
  );
  // Should still find next and call prewarm
  assert.equal(calls.length, 3);
});

test("prefetch fetches must NOT send credentials (api.remanga.org rejects credentialed CORS)", async () => {
  resetPrefetchDedup();
  installDomStub();
  const fetchOptions: Array<RequestInit | undefined> = [];
  (globalThis as any).fetch = async (_url: string, options?: RequestInit) => {
    fetchOptions.push(options);
    return {
      ok: true,
      json: async () => ({
        content: { branch_id: 1, is_paid: false, pages: [] },
      }),
    };
  };

  await prefetchNextChapter("some-title", 1);

  assert.ok(fetchOptions.length > 0, "should have called fetch at least once");
  for (const options of fetchOptions) {
    assert.notEqual(
      options?.credentials,
      "include",
      "fetch must not include credentials — api.remanga.org rejects credentialed CORS for /api/titles/chapters/<id>/",
    );
  }
});

test("prewarmChapter image preload links must NOT carry crossorigin (mismatch breaks <img> cache reuse)", async () => {
  const head = installDomStub();
  installFetchStub({
    "https://api.remanga.org/api/titles/chapters/9/": {
      content: {
        is_paid: false,
        pages: [[{ link: "https://img.reimg.org/x.webp" }]],
      },
    },
  });

  await prewarmChapter(9);

  const preloads = head.children.filter((n) => n.rel === "preload");
  assert.equal(preloads.length, 1);
  assert.equal(
    preloads[0].attributes.crossorigin,
    undefined,
    "preload link must not have crossorigin attribute — Remanga's <img> tags don't use it, mismatch defeats cache reuse",
  );
});

test("prefetchNextChapter invokes onPaidNextChapter when next chapter is paid and skips image preloads", async () => {
  resetPrefetchDedup();
  const head = installDomStub();
  installFetchStub({
    "https://api.remanga.org/api/titles/chapters/700/": {
      content: { branch_id: 11, index: 50, is_paid: false, pages: [] },
    },
    "https://api.remanga.org/api/titles/chapters/?branch_id=11&ordering=index&page=2": {
      content: [
        { id: 700, index: 50, chapter: "49", tome: 3 },
        { id: 701, index: 51, chapter: "50", tome: 3 },
      ],
    },
    "https://api.remanga.org/api/titles/chapters/701/": {
      content: {
        is_paid: true,
        chapter: "50",
        tome: 3,
        pages: [[{ link: "https://img.reimg.org/paid.webp" }]],
      },
    },
  });

  const paidCalls: Array<{
    titleDir: string;
    chapterId: number;
    chapter: string;
    tome: number;
  }> = [];

  await prefetchNextChapter("title-pf", 700, {
    onPaidNextChapter: async (meta) => {
      paidCalls.push(meta);
    },
  });

  assert.equal(paidCalls.length, 1);
  assert.deepEqual(paidCalls[0], {
    titleDir: "title-pf",
    chapterId: 701,
    chapter: "50",
    tome: 3,
  });

  // No <link rel=preload> for paid chapter — only PF flow handles it.
  const preloads = head.children.filter((n) => n.rel === "preload");
  assert.equal(preloads.length, 0);
});

test("prefetchNextChapter does NOT invoke onPaidNextChapter for free next chapter", async () => {
  resetPrefetchDedup();
  installDomStub();
  installFetchStub({
    "https://api.remanga.org/api/titles/chapters/800/": {
      content: { branch_id: 12, index: 1, is_paid: false, pages: [] },
    },
    "https://api.remanga.org/api/titles/chapters/?branch_id=12&ordering=index&page=1": {
      content: [
        { id: 800, index: 1 },
        { id: 801, index: 2 },
      ],
    },
    "https://api.remanga.org/api/titles/chapters/801/": {
      content: {
        is_paid: false,
        pages: [[{ link: "https://img.reimg.org/free.webp" }]],
      },
    },
  });

  let called = false;
  await prefetchNextChapter("title-free", 800, {
    onPaidNextChapter: async () => {
      called = true;
    },
  });

  assert.equal(called, false);
});
