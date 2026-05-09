import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fixturesDir = path.resolve(process.cwd(), "fixtures");
const searchFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "senkuro-search.json"), "utf8"),
);
const mangaFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "senkuro-manga.json"), "utf8"),
);
const chaptersFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "senkuro-chapters.json"), "utf8"),
);
const chapterFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "senkuro-chapter.json"), "utf8"),
);

const loadModule = async () => {
  const module = await import("../src/providers/senkuro.js");
  return module as {
    extractSenkuroSearchResults: (json: unknown) => unknown;
    extractSenkuroTitleDetails: (json: unknown, titleRef: string) => unknown;
    extractSenkuroChapterPages: (json: unknown, chapterRef: string) => unknown;
    SenkuroProvider: new (http?: unknown) => {
      name: string;
      manualSearchUrl: (q: string) => string;
      searchTitles: (q: string) => Promise<unknown[]>;
      getTitleDetails: (ref: string) => Promise<unknown>;
      parseChapter: (ref: string) => Promise<unknown>;
      fetchImage: (url: string) => Promise<Buffer>;
    };
  };
};

describe("extractSenkuroSearchResults", () => {
  it("maps mangas.edges[].node to SourceTitleSearchResult[]", async () => {
    const { extractSenkuroSearchResults } = await loadModule();

    const result = extractSenkuroSearchResults(searchFixture) as Array<{
      titleId: string;
      slug: string;
      titleName: string;
      titleUrl: string;
    }>;

    assert.equal(result.length, 1);
    assert.equal(result[0]?.slug, "tower-of-god");
    assert.equal(result[0]?.titleId, "TUFOR0E6NTE4MTU4MDU0MDY0Mzc3NzA");
    assert.equal(result[0]?.titleUrl, "https://senkuro.com/manga/tower-of-god");
    assert.ok(result[0]?.titleName && result[0].titleName.length > 0);
  });

  it("returns an empty array when the search has no hits", async () => {
    const { extractSenkuroSearchResults } = await loadModule();
    const empty = { data: { mangas: { edges: [] } } };
    assert.deepEqual(extractSenkuroSearchResults(empty), []);
  });

  it("survives a malformed payload without throwing", async () => {
    const { extractSenkuroSearchResults } = await loadModule();
    assert.deepEqual(extractSenkuroSearchResults({ data: null }), []);
    assert.deepEqual(extractSenkuroSearchResults(null), []);
    assert.deepEqual(extractSenkuroSearchResults({ errors: [{ message: "nope" }] }), []);
  });
});

describe("extractSenkuroTitleDetails", () => {
  const combined = {
    manga: mangaFixture.data.manga,
    chapters: chaptersFixture.data.mangaChapters.edges.map((e: { node: unknown }) => e.node),
  };

  it("aggregates titleName from titles and adds every other content as alias", async () => {
    const { extractSenkuroTitleDetails } = await loadModule();
    const details = extractSenkuroTitleDetails(combined, "tower-of-god") as {
      titleId: string;
      slug: string;
      titleName: string;
      titleUrl: string;
      aliases: string[];
      chapters: Array<{ chapterId: string; titleId: string; chapter: string; volume: number; chapterUrl: string }>;
    };

    assert.equal(details.slug, "tower-of-god");
    assert.equal(details.titleUrl, "https://senkuro.com/manga/tower-of-god");
    // titleName must be one of the known content strings
    const allContents = [
      "Tower of God",
      "Башня Бога",
      "신의 탑",
      "Sin-ui Tap",
      "Kami no Tou",
      "Kami no Tou: Tower of God",
    ];
    assert.ok(allContents.includes(details.titleName), `titleName=${details.titleName}`);
    for (const c of allContents) {
      if (c === details.titleName) continue;
      assert.ok(details.aliases.includes(c), `alias ${c} must be present`);
    }
  });

  it("converts chapter.number and volume to the SourceChapterReference shape", async () => {
    const { extractSenkuroTitleDetails } = await loadModule();
    const details = extractSenkuroTitleDetails(combined, "tower-of-god") as {
      chapters: Array<{ chapterId: string; chapter: string; volume: number; chapterUrl: string }>;
    };

    assert.equal(details.chapters.length, 5);
    const first = details.chapters[0];
    assert.equal(first.chapter, "650");
    assert.equal(first.volume, 3);
    assert.equal(first.chapterId, "156162230679782950");
    assert.equal(
      first.chapterUrl,
      "https://senkuro.com/manga/tower-of-god/156162230679782950",
    );
  });

  it("picks the RU branch with the most chapters and uses its id for chapters fetch", async () => {
    // Synthetic fixture: manga has three branches; resolver must pick RU-with-most.
    const synthetic = {
      manga: {
        id: "MANGA_ID",
        slug: "sample",
        titles: [{ lang: "RU", content: "Пример" }],
        originalName: null,
        alternativeNames: [],
        branches: [
          { id: "B_EN", lang: "EN", chapters: 500, updatedAt: "2025-01-01T00:00:00" },
          { id: "B_RU_SMALL", lang: "RU", chapters: 10, updatedAt: "2025-06-01T00:00:00" },
          { id: "B_RU_BIG", lang: "RU", chapters: 100, updatedAt: "2024-03-01T00:00:00" },
        ],
        chosenBranchId: "B_RU_BIG",
      },
      chapters: [
        { id: "C1", slug: "111", number: "1", volume: "1", name: "a", branchId: "B_RU_BIG" },
      ],
    };
    const { extractSenkuroTitleDetails } = await loadModule();
    const details = extractSenkuroTitleDetails(synthetic, "sample") as {
      chapters: Array<{ chapterId: string }>;
    };
    assert.equal(details.chapters.length, 1);
    assert.equal(details.chapters[0].chapterId, "111");
  });

  it("returns empty chapters when no RU branch exists (no EN/original fallback)", async () => {
    const synthetic = {
      manga: {
        id: "MANGA_ID",
        slug: "only-en",
        titles: [{ lang: "EN", content: "Sample" }],
        originalName: null,
        alternativeNames: [],
        branches: [{ id: "B_EN", lang: "EN", chapters: 99, updatedAt: "2025-01-01T00:00:00" }],
      },
      chapters: [],
    };
    const { extractSenkuroTitleDetails } = await loadModule();
    const details = extractSenkuroTitleDetails(synthetic, "only-en") as {
      chapters: unknown[];
    };
    assert.deepEqual(details.chapters, []);
  });

  it("uses updatedAt as tie-breaker when several RU branches have identical chapter counts", async () => {
    const synthetic = {
      manga: {
        id: "X",
        slug: "tie",
        titles: [{ lang: "RU", content: "tie" }],
        originalName: null,
        alternativeNames: [],
        branches: [
          { id: "B_OLD", lang: "RU", chapters: 50, updatedAt: "2023-01-01T00:00:00" },
          { id: "B_NEW", lang: "RU", chapters: 50, updatedAt: "2025-06-01T00:00:00" },
        ],
      },
      chapters: [
        { id: "C1", slug: "s1", number: "1", volume: "1", name: "", branchId: "B_NEW" },
      ],
    };
    const { extractSenkuroTitleDetails } = await loadModule();
    const details = extractSenkuroTitleDetails(synthetic, "tie") as {
      chapters: Array<{ chapterId: string }>;
    };
    // Extractor gets chapters already fetched for the chosen branch, but we verify
    // end-to-end branch selection via integration test below. Here we just verify
    // that a correctly-aggregated payload yields the expected chapters pass-through.
    assert.equal(details.chapters.length, 1);
    assert.equal(details.chapters[0].chapterId, "s1");
  });
});

describe("extractSenkuroChapterPages", () => {
  it("maps pages[].image.original.url to ExternalChapterParseResult", async () => {
    const { extractSenkuroChapterPages } = await loadModule();
    const result = extractSenkuroChapterPages(
      chapterFixture,
      "156162230679782950",
    ) as {
      chapterId: string;
      titleId: string;
      chapter: string;
      volume: number;
      chapterUrl: string;
      pages: Array<{ index: number; imageRef: string }>;
    };

    assert.equal(result.chapterId, "156162230679782950");
    assert.equal(result.chapter, "650");
    assert.equal(result.volume, 3);
    assert.equal(result.pages.length, 8);
    assert.equal(result.pages[0].index, 0);
    assert.equal(
      result.pages[0].imageRef,
      "https://mirai.senkuro.net/manga-chapters/51815805406437770/51815805406503306/0d9817c9b4e6971a74bc6dc04f8289026ec83a48_167650435610472781.jpeg",
    );
    // pages must be sorted by page.number ascending
    for (let i = 1; i < result.pages.length; i += 1) {
      assert.ok(result.pages[i].index > result.pages[i - 1].index);
    }
  });

  it("throws a descriptive error when chapter is null (private/missing)", async () => {
    const { extractSenkuroChapterPages } = await loadModule();
    assert.throws(
      () => extractSenkuroChapterPages({ data: { mangaChapter: null } }, "x"),
      /not found|missing|null/i,
    );
  });
});

describe("pickRuBranch (branch selection policy)", () => {
  const load = async () =>
    (await import("../src/providers/senkuro.js")) as {
      pickRuBranch: (
        branches: Array<{ id: string; lang: string; chapters: number; updatedAt?: string }> | null,
      ) => { id: string } | null;
    };

  it("returns null when no RU branch exists (no EN fallback)", async () => {
    const { pickRuBranch } = await load();
    const result = pickRuBranch([
      { id: "a", lang: "EN", chapters: 100, updatedAt: "2025-01-01T00:00:00" },
      { id: "b", lang: "JA", chapters: 50, updatedAt: "2025-01-01T00:00:00" },
    ]);
    assert.equal(result, null);
  });

  it("ignores RU branches with zero chapters", async () => {
    const { pickRuBranch } = await load();
    const result = pickRuBranch([
      { id: "empty", lang: "RU", chapters: 0, updatedAt: "2025-01-01T00:00:00" },
    ]);
    assert.equal(result, null);
  });

  it("picks RU branch with the most chapters", async () => {
    const { pickRuBranch } = await load();
    const result = pickRuBranch([
      { id: "small", lang: "RU", chapters: 10, updatedAt: "2025-06-01T00:00:00" },
      { id: "big", lang: "RU", chapters: 100, updatedAt: "2023-01-01T00:00:00" },
    ]);
    assert.equal(result?.id, "big");
  });

  it("tie-breaks by updatedAt DESC when chapter counts match", async () => {
    const { pickRuBranch } = await load();
    const result = pickRuBranch([
      { id: "old", lang: "RU", chapters: 50, updatedAt: "2023-01-01T00:00:00" },
      { id: "new", lang: "RU", chapters: 50, updatedAt: "2025-06-01T00:00:00" },
      { id: "older", lang: "RU", chapters: 50, updatedAt: "2021-01-01T00:00:00" },
    ]);
    assert.equal(result?.id, "new");
  });

  it("prefers RU over EN even when EN has more chapters", async () => {
    const { pickRuBranch } = await load();
    const result = pickRuBranch([
      { id: "en-huge", lang: "EN", chapters: 1000, updatedAt: "2025-06-01T00:00:00" },
      { id: "ru-small", lang: "RU", chapters: 5, updatedAt: "2024-01-01T00:00:00" },
    ]);
    assert.equal(result?.id, "ru-small");
  });
});

describe("SenkuroProvider", () => {
  it("builds the correct browse manualSearchUrl", async () => {
    const { SenkuroProvider } = await loadModule();
    const provider = new SenkuroProvider();
    assert.equal(provider.name, "senkuro");
    assert.equal(
      provider.manualSearchUrl("Возвращение Еретика"),
      "https://senkuro.com/browse/manga?search=%D0%92%D0%BE%D0%B7%D0%B2%D1%80%D0%B0%D1%89%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%95%D1%80%D0%B5%D1%82%D0%B8%D0%BA%D0%B0",
    );
  });

  it("searchTitles posts GraphQL mangas query with search variable", async () => {
    const { SenkuroProvider } = await loadModule();
    const calls: Array<{ url: string; body: string }> = [];
    const fakeHttp = {
      async request(url: string, init: { body?: string; method?: string }) {
        calls.push({ url, body: String(init.body) });
        return new Response(JSON.stringify(searchFixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    };

    const provider = new SenkuroProvider(fakeHttp);
    const results = await provider.searchTitles("tower of god");
    assert.equal(results.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.senkuro.com/graphql");
    const body = JSON.parse(calls[0].body) as { query: string; variables?: Record<string, unknown> };
    assert.match(body.query, /mangas\s*\(\s*first:.*search:.*\)/s);
    assert.equal(body.variables?.search, "tower of god");
  });

  it("getTitleDetails runs manga + mangaChapters back-to-back, passing chosen branchId", async () => {
    const { SenkuroProvider } = await loadModule();
    const calls: Array<{ body: string }> = [];
    const fakeHttp = {
      async request(_url: string, init: { body?: string }) {
        const body = String(init.body);
        calls.push({ body });
        const parsed = JSON.parse(body) as { query: string; variables?: Record<string, unknown> };
        if (parsed.query.includes("manga(") && !parsed.query.includes("mangaChapters")) {
          return new Response(JSON.stringify(mangaFixture), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        if (parsed.query.includes("mangaChapters")) {
          // verify the branchId comes from RU branch of mangaFixture
          assert.equal(parsed.variables?.branchId, "TUFOR0FfQlJBTkNIOjUxODE1ODA1NDA2NTAzMzA2");
          return new Response(JSON.stringify(chaptersFixture), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        throw new Error("unexpected query");
      },
    };

    const provider = new SenkuroProvider(fakeHttp);
    const details = (await provider.getTitleDetails("tower-of-god")) as {
      slug: string;
      chapters: unknown[];
    };
    assert.equal(details.slug, "tower-of-god");
    assert.equal(details.chapters.length, 5);
    assert.equal(calls.length, 2);
  });

  it("getTitleDetails paginates mangaChapters with first <= 100 until hasNextPage is false", async () => {
    const { SenkuroProvider } = await loadModule();
    const mangaOnly = {
      data: {
        manga: {
          id: "M",
          slug: "long-manga",
          status: "ONGOING",
          type: "MANHWA",
          cover: null,
          originalName: null,
          titles: [{ lang: "RU", content: "Долгая манга" }],
          alternativeNames: [],
          branches: [
            {
              id: "RU_B",
              lang: "RU",
              chapters: 150,
              updatedAt: "2025-01-01T00:00:00",
            },
          ],
        },
      },
    };

    const pageRequests: Array<{ first: number; after?: string }> = [];
    const fakeHttp = {
      async request(_url: string, init: { body?: string }) {
        const parsed = JSON.parse(String(init.body)) as {
          query: string;
          variables?: Record<string, unknown>;
        };
        if (parsed.query.includes("mangaChapters")) {
          const first = parsed.variables?.first as number;
          const after = parsed.variables?.after as string | undefined;
          pageRequests.push({ first, after });
          assert.ok(first <= 100, `first must be <= 100, got ${first}`);
          const isFirstPage = !after;
          return new Response(
            JSON.stringify({
              data: {
                mangaChapters: {
                  edges: isFirstPage
                    ? Array.from({ length: 100 }, (_, i) => ({
                        node: {
                          id: `C${i}`,
                          slug: `s${i}`,
                          number: String(100 - i),
                          volume: "1",
                          name: "",
                          branchId: "RU_B",
                        },
                      }))
                    : Array.from({ length: 50 }, (_, i) => ({
                        node: {
                          id: `C${100 + i}`,
                          slug: `s${100 + i}`,
                          number: String(50 - i),
                          volume: "1",
                          name: "",
                          branchId: "RU_B",
                        },
                      })),
                  pageInfo: {
                    hasNextPage: isFirstPage,
                    endCursor: isFirstPage ? "cursor1" : null,
                  },
                },
              },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify(mangaOnly), { status: 200 });
      },
    };

    const provider = new SenkuroProvider(fakeHttp);
    const details = (await provider.getTitleDetails("long-manga")) as {
      chapters: unknown[];
    };

    assert.equal(details.chapters.length, 150);
    assert.equal(pageRequests.length, 2);
    assert.equal(pageRequests[0].after, undefined);
    assert.equal(pageRequests[1].after, "cursor1");
  });

  it("getTitleDetails returns empty chapters without calling mangaChapters when no RU branch", async () => {
    const { SenkuroProvider } = await loadModule();
    const mangaNoRu = {
      data: {
        manga: {
          id: "X",
          slug: "no-ru",
          status: "ONGOING",
          type: "MANGA",
          cover: null,
          originalName: null,
          titles: [{ lang: "EN", content: "NoRU" }],
          alternativeNames: [],
          branches: [
            { id: "EN_B", lang: "EN", chapters: 10, updatedAt: "2025-01-01T00:00:00" },
          ],
        },
      },
    };

    let chaptersCalled = false;
    const fakeHttp = {
      async request(_url: string, init: { body?: string }) {
        const body = JSON.parse(String(init.body)) as { query: string };
        if (body.query.includes("mangaChapters")) {
          chaptersCalled = true;
          return new Response('{"data":null}', { status: 200 });
        }
        return new Response(JSON.stringify(mangaNoRu), { status: 200 });
      },
    };

    const provider = new SenkuroProvider(fakeHttp);
    const details = (await provider.getTitleDetails("no-ru")) as { chapters: unknown[] };
    assert.deepEqual(details.chapters, []);
    assert.equal(chaptersCalled, false, "must not hit mangaChapters when no RU branch");
  });

  it("parseChapter accepts a full chapterUrl and extracts the chapter slug from it", async () => {
    const { SenkuroProvider } = await loadModule();
    let sentSlug: string | undefined;
    const fakeHttp = {
      async request(_url: string, init: { body?: string }) {
        const parsed = JSON.parse(String(init.body)) as {
          variables?: Record<string, string>;
        };
        sentSlug = parsed.variables?.slug;
        return new Response(JSON.stringify(chapterFixture), { status: 200 });
      },
    };
    const provider = new SenkuroProvider(fakeHttp);
    await provider.parseChapter(
      "https://senkuro.com/manga/tower-of-god/156162230679782950",
    );
    assert.equal(sentSlug, "156162230679782950");
  });

  it("parseChapter posts mangaChapter(slug:) and extracts pages", async () => {
    const { SenkuroProvider } = await loadModule();
    let sentVariable: string | undefined;
    const fakeHttp = {
      async request(_url: string, init: { body?: string }) {
        const parsed = JSON.parse(String(init.body)) as {
          query: string;
          variables?: Record<string, string>;
        };
        assert.match(parsed.query, /mangaChapter\s*\(\s*slug:/);
        sentVariable = parsed.variables?.slug;
        return new Response(JSON.stringify(chapterFixture), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    };
    const provider = new SenkuroProvider(fakeHttp);
    const result = (await provider.parseChapter("156162230679782950")) as {
      chapterId: string;
      pages: Array<{ index: number; imageRef: string }>;
    };
    assert.equal(sentVariable, "156162230679782950");
    assert.equal(result.chapterId, "156162230679782950");
    assert.equal(result.pages.length, 8);
  });

  it("fetchImage performs a plain GET without adding Referer", async () => {
    const { SenkuroProvider } = await loadModule();
    const imgBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    let observedHeaders: Headers | undefined;
    let calledUrl: string | undefined;
    const fakeHttp = {
      async request(url: string, init: RequestInit | undefined) {
        calledUrl = url;
        observedHeaders = new Headers(init?.headers);
        return new Response(imgBytes, {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      },
    };
    const provider = new SenkuroProvider(fakeHttp);
    const buf = await provider.fetchImage(
      "https://mirai.senkuro.net/manga-chapters/x/y/z.jpeg",
    );
    assert.equal(buf.length, 4);
    assert.equal(calledUrl, "https://mirai.senkuro.net/manga-chapters/x/y/z.jpeg");
    assert.equal(observedHeaders?.get("referer"), null);
  });
});
