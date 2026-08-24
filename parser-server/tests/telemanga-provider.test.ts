import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fixturesDir = path.resolve(process.cwd(), "fixtures/telemanga");
const searchFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "search-helmut.json"), "utf8"),
);
const titleFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "title-detail.json"), "utf8"),
);
const chaptersFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "chapters-asc.json"), "utf8"),
);
const chapterFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "chapter-1.json"), "utf8"),
);
const nubTitleFixture = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "title-nub.json"), "utf8"),
);
const nubChaptersPage0 = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "chapters-nub-offset-0.json"), "utf8"),
);
const nubChaptersPage100 = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "chapters-nub-offset-100.json"), "utf8"),
);
const nubChaptersPage200 = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, "chapters-nub-offset-200.json"), "utf8"),
);

const SEARCH_URL =
  "https://telemanga.me/api/manga/search?query=helmut&offset=0&limit=100";
const TITLE_URL = "https://telemanga.me/api/manga/gelmut-otvergnutoye-ditya";
const CHAPTERS_URL =
  "https://telemanga.me/api/manga/gelmut-otvergnutoye-ditya/chapters?sortOrder=ASC&offset=0&limit=100";
const CHAPTERS_URL_PAGE2 =
  "https://telemanga.me/api/manga/gelmut-otvergnutoye-ditya/chapters?sortOrder=ASC&offset=100&limit=100";
const CHAPTER_1_URL =
  "https://telemanga.me/api/manga/gelmut-otvergnutoye-ditya/chapter/1";
const NUB_SLUG = "nub-maksimalnogo-urovnya";
const NUB_TITLE_URL = `https://telemanga.me/api/manga/${NUB_SLUG}`;
const nubChaptersUrl = (offset: number): string =>
  `https://telemanga.me/api/manga/${NUB_SLUG}/chapters?sortOrder=ASC&offset=${offset}&limit=100`;

const loadModule = async () => {
  const module = await import("../src/providers/telemanga.js");
  return module as {
    TelemangaProvider: new (httpOrFetch?: typeof fetch) => {
      name: string;
      manualSearchUrl: (q: string) => string;
      searchTitles: (q: string) => Promise<
        Array<{
          titleId: string;
          slug: string;
          titleName: string;
          titleUrl: string;
        }>
      >;
      getTitleDetails: (ref: string) => Promise<{
        titleId: string;
        slug: string;
        titleName: string;
        titleUrl: string;
        aliases: string[];
        chapters: Array<{
          chapterId: string;
          titleId: string;
          chapter: string;
          volume: number;
          chapterUrl: string;
        }>;
      }>;
      parseChapter: (ref: string) => Promise<{
        chapterId: string;
        titleId: string;
        chapter: string;
        volume: number;
        chapterUrl: string;
        pages: Array<{ index: number; imageRef: string }>;
      }>;
      fetchImage: (url: string) => Promise<Buffer>;
    };
  };
};

const mockJsonFetch = (
  responses: Record<string, unknown>,
): typeof fetch => {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (!(url in responses)) {
      throw new Error(`Unexpected fetch URL: ${url}`);
    }
    return new Response(JSON.stringify(responses[url]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
};

describe("TelemangaProvider.searchTitles", () => {
  it("maps /api/manga/search response to SourceTitleSearchResult[]", async () => {
    const { TelemangaProvider } = await loadModule();
    const fetchImpl = mockJsonFetch({ [SEARCH_URL]: searchFixture });
    const provider = new TelemangaProvider(fetchImpl);

    const results = await provider.searchTitles("helmut");
    assert.equal(results.length, 1);
    assert.equal(results[0].slug, "gelmut-otvergnutoye-ditya");
    assert.equal(results[0].titleId, "gelmut-otvergnutoye-ditya");
    assert.equal(
      results[0].titleUrl,
      "https://telemanga.me/manga/gelmut-otvergnutoye-ditya/",
    );
    assert.ok(results[0].titleName.length > 0);
  });
});

describe("TelemangaProvider.getTitleDetails", () => {
  it("aggregates title metadata and chapter list", async () => {
    const { TelemangaProvider } = await loadModule();
    const fetchImpl = mockJsonFetch({
      [TITLE_URL]: titleFixture,
      [CHAPTERS_URL]: chaptersFixture,
      [CHAPTERS_URL_PAGE2]: [],
    });
    const provider = new TelemangaProvider(fetchImpl);

    const details = await provider.getTitleDetails("gelmut-otvergnutoye-ditya");
    assert.equal(details.slug, "gelmut-otvergnutoye-ditya");
    assert.equal(details.titleId, "gelmut-otvergnutoye-ditya");
    assert.equal(details.titleName, "Гельмут: Отвергнутое дитя");
    assert.ok(details.aliases.includes("Helmut: The Forsaken Child"));
    assert.equal(
      details.titleUrl,
      "https://telemanga.me/manga/gelmut-otvergnutoye-ditya/",
    );

    assert.ok(details.chapters.length > 0);

    // Chapter ordering: API returns ASC by numeration; we should expose all entries
    const firstChapter = details.chapters.find((c) => c.chapter === "1");
    assert.ok(firstChapter, "chapter 1 must exist");
    assert.equal(firstChapter!.volume, 1);
    assert.equal(firstChapter!.titleId, "gelmut-otvergnutoye-ditya");
    assert.equal(
      firstChapter!.chapterUrl,
      "https://telemanga.me/manga/gelmut-otvergnutoye-ditya/1",
    );
    assert.equal(firstChapter!.chapterId, "1");
  });

  it("paginates chapter list past the first 100 entries using offset", async () => {
    const { TelemangaProvider } = await loadModule();
    const chapterUrls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === NUB_TITLE_URL) {
        return new Response(JSON.stringify(nubTitleFixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes(`/${NUB_SLUG}/chapters?`)) {
        chapterUrls.push(url);
        const responses: Record<string, unknown> = {
          [nubChaptersUrl(0)]: nubChaptersPage0,
          [nubChaptersUrl(100)]: nubChaptersPage100,
          [nubChaptersUrl(200)]: nubChaptersPage200,
        };
        if (!(url in responses)) {
          throw new Error(`Unexpected chapters URL: ${url}`);
        }
        const limitMatch = /[?&]limit=(\d+)/.exec(url);
        const limit = limitMatch ? Number(limitMatch[1]) : NaN;
        assert.equal(limit, 100, `page size must stay at 100, got ${limit}`);
        return new Response(JSON.stringify(responses[url]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    const provider = new TelemangaProvider(fetchImpl);
    const details = await provider.getTitleDetails(NUB_SLUG);

    assert.equal(details.chapters.length, 258);
    const chapter200 = details.chapters.find((c) => c.chapter === "200");
    assert.ok(chapter200, "chapter 200 must be visible after pagination");
    assert.equal(
      chapter200!.chapterUrl,
      `https://telemanga.me/manga/${NUB_SLUG}/200`,
    );
    const chapter257 = details.chapters.find((c) => c.chapter === "257");
    assert.ok(chapter257, "chapter 257 must be visible after pagination");
    assert.deepEqual(chapterUrls, [
      nubChaptersUrl(0),
      nubChaptersUrl(100),
      nubChaptersUrl(200),
    ]);
  });

  it("stops paging on an empty chapter page", async () => {
    const { TelemangaProvider } = await loadModule();
    const chapterUrls: string[] = [];
    const page0 = Array.from({ length: 100 }, (_, i) => ({
      id: `c${i}`,
      mangaId: NUB_SLUG,
      numeration: i + 1,
      totalPages: 1,
    }));
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === NUB_TITLE_URL) {
        return new Response(
          JSON.stringify({ id: NUB_SLUG, titleRu: "Нуб" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === nubChaptersUrl(0)) {
        chapterUrls.push(url);
        return new Response(JSON.stringify(page0), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === nubChaptersUrl(100)) {
        chapterUrls.push(url);
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    }) as typeof fetch;

    const provider = new TelemangaProvider(fetchImpl);
    const details = await provider.getTitleDetails(NUB_SLUG);
    assert.equal(details.chapters.length, 100);
    assert.deepEqual(chapterUrls, [nubChaptersUrl(0), nubChaptersUrl(100)]);
  });

  it("caps chapter pages so a stuck source cannot loop forever", async () => {
    const { TelemangaProvider } = await loadModule();
    let chapterRequests = 0;
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === NUB_TITLE_URL) {
        return new Response(
          JSON.stringify({ id: NUB_SLUG, titleRu: "Нуб" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      const offsetMatch = /[?&]offset=(\d+)/.exec(url);
      if (!url.includes(`/${NUB_SLUG}/chapters?`) || !offsetMatch) {
        throw new Error(`Unexpected fetch URL: ${url}`);
      }
      chapterRequests += 1;
      const offset = Number(offsetMatch[1]);
      const page = Array.from({ length: 100 }, (_, i) => ({
        id: `c${offset + i}`,
        mangaId: NUB_SLUG,
        numeration: offset + i + 1,
        totalPages: 1,
      }));
      return new Response(JSON.stringify(page), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const provider = new TelemangaProvider(fetchImpl);
    const details = await provider.getTitleDetails(NUB_SLUG);
    assert.ok(chapterRequests > 1, "must page at least twice for a long title");
    assert.ok(chapterRequests <= 20, `runaway paging: ${chapterRequests} requests`);
    assert.equal(details.chapters.length, chapterRequests * 100);
  });
});

describe("TelemangaProvider.parseChapter", () => {
  it("returns absolute storage URLs for chapter pages", async () => {
    const { TelemangaProvider } = await loadModule();
    const fetchImpl = mockJsonFetch({ [CHAPTER_1_URL]: chapterFixture });
    const provider = new TelemangaProvider(fetchImpl);

    const parsed = await provider.parseChapter("gelmut-otvergnutoye-ditya/1");
    assert.equal(parsed.titleId, "gelmut-otvergnutoye-ditya");
    assert.equal(parsed.chapter, "1");
    assert.equal(parsed.volume, 1);
    assert.equal(parsed.chapterId, "1");
    assert.equal(
      parsed.chapterUrl,
      "https://telemanga.me/manga/gelmut-otvergnutoye-ditya/1",
    );

    assert.equal(parsed.pages.length, 7);
    assert.equal(parsed.pages[0].index, 0);
    assert.equal(
      parsed.pages[0].imageRef,
      "https://storage.yandexcloud.net/telemangacnd/mangas/gelmut-otvergnutoye-ditya/glava-1/1.jpg",
    );
    assert.equal(parsed.pages[6].index, 6);
  });
});

describe("TelemangaProvider.manualSearchUrl", () => {
  it("builds a human search URL", async () => {
    const { TelemangaProvider } = await loadModule();
    const provider = new TelemangaProvider();
    const url = provider.manualSearchUrl("Helmut: The Forsaken Child");
    assert.ok(url.startsWith("https://telemanga.me/"));
    assert.ok(url.includes("Helmut"));
  });
});

describe("TelemangaProvider exposes Telemanga as provider name", () => {
  it("name is 'telemanga'", async () => {
    const { TelemangaProvider } = await loadModule();
    const provider = new TelemangaProvider();
    assert.equal(provider.name, "telemanga");
  });
});
