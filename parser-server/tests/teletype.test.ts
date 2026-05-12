import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractTeletypeSearchResults,
  extractChapterNumberFromTitle,
  extractTeletypeArticlePages,
} from "../src/providers/teletype.js";

describe("extractChapterNumberFromTitle", () => {
  it("extracts number from 'Как демон император стал дворецким - 19 глава ✓'", () => {
    assert.equal(
      extractChapterNumberFromTitle(
        " Как демон император стал дворецким - 19 глава ✓",
      ),
      "19",
    );
  });

  it("extracts number from 'Как демон император стал дворецким - 382 Глава'", () => {
    assert.equal(
      extractChapterNumberFromTitle(
        "Как демон император стал дворецким - 382 Глава  ",
      ),
      "382",
    );
  });

  it("extracts number from 'Мой любимый хулиган. Глава 58'", () => {
    assert.equal(
      extractChapterNumberFromTitle("Мой любимый хулиган. Глава 58"),
      "58",
    );
  });

  it("returns null when no chapter number found", () => {
    assert.equal(extractChapterNumberFromTitle("Обзор манги"), null);
  });

  it("extracts from 'Том 3 Глава 15'", () => {
    assert.equal(
      extractChapterNumberFromTitle("Название - Том 3 Глава 15"),
      "15",
    );
  });
});

describe("extractTeletypeSearchResults", () => {
  it("parses articles from initial state", () => {
    const state = {
      search: {
        search: {
          articles: [
            {
              id: 4770609,
              uri: "aEXitqik_lS",
              title: " Как демон император стал дворецким - 19 глава ✓",
              author: { id: 1796817, uri: "hither.ss", name: "Higher" },
            },
          ],
        },
      },
    };
    const results = extractTeletypeSearchResults(
      state,
      "Как демон император стал дворецким",
      "19",
    );
    assert.equal(results.length, 1);
    assert.equal(results[0].articleId, "4770609");
    assert.equal(results[0].chapter, "19");
    assert.equal(
      results[0].articleUrl,
      "https://teletype.in/@hither.ss/aEXitqik_lS",
    );
  });

  it("skips articles with non-matching chapter number", () => {
    const state = {
      search: {
        search: {
          articles: [
            {
              id: 4731977,
              uri: "Ct_t5G8wCDL",
              title: "Как демон император стал дворецким - 382 Глава",
              author: { id: 1029732, uri: "konysama", name: "Nikita Konysama" },
            },
          ],
        },
      },
    };
    const results = extractTeletypeSearchResults(
      state,
      "Как демон император стал дворецким",
      "19",
    );
    assert.equal(results.length, 0);
  });

  it("skips articles with non-matching title", () => {
    const state = {
      search: {
        search: {
          articles: [
            {
              id: 5543477,
              uri: "abc123",
              title: "Мой любимый хулиган. Глава 19",
              author: { id: 1, uri: "someone", name: "Someone" },
            },
          ],
        },
      },
    };
    const results = extractTeletypeSearchResults(
      state,
      "Как демон император стал дворецким",
      "19",
    );
    assert.equal(results.length, 0);
  });
});

describe("extractTeletypeArticlePages", () => {
  it("extracts image URLs from article text", () => {
    const text =
      '<document><image src="https://img1.teletype.in/files/c1/9b/c19b58df.jpeg" anchor="F1zu" size="original" width=374 height=6031></image><image src="https://img3.teletype.in/files/a3/2c/a32c780d.jpeg" anchor="WQEB" size="original" width=374 height=3274></image></document>';
    const pages = extractTeletypeArticlePages(text);
    assert.equal(pages.length, 2);
    assert.equal(pages[0].index, 0);
    assert.equal(
      pages[0].imageRef,
      "https://img1.teletype.in/files/c1/9b/c19b58df.jpeg",
    );
    assert.equal(pages[1].index, 1);
    assert.equal(
      pages[1].imageRef,
      "https://img3.teletype.in/files/a3/2c/a32c780d.jpeg",
    );
  });

  it("returns empty array for empty text", () => {
    assert.deepEqual(extractTeletypeArticlePages(""), []);
  });
});