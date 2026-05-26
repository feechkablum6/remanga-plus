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

const SEARCH_URL =
  "https://telemanga.me/api/manga/search?query=helmut&offset=0&limit=100";
const TITLE_URL = "https://telemanga.me/api/manga/gelmut-otvergnutoye-ditya";
const CHAPTERS_URL =
  "https://telemanga.me/api/manga/gelmut-otvergnutoye-ditya/chapters?sortOrder=ASC&offset=0&limit=100";
const CHAPTER_1_URL =
  "https://telemanga.me/api/manga/gelmut-otvergnutoye-ditya/chapter/1";

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

    // Live fixture has 117 chapters but we capped at 100; assert sane bounds
    assert.ok(details.chapters.length > 0);
    assert.ok(details.chapters.length <= 100);

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
