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
