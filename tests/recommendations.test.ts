import "./setup-dom.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGenreProfile,
  filterNativeCards,
  pickSupplements,
  fetchBookmarkTitles,
  fetchTitleGenres,
  fetchCatalogByGenres,
  findRecommendationsSection,
  extractNativeCards,
  buildCandidateCard,
  applyRecommendations,
  type BookmarkTitle,
  type GenreProfile,
  type NativeCard,
  type RecCandidate,
  type RecommendationDeps,
} from "../src/recommendations.js";

test("buildGenreProfile returns empty profile for empty bookmarks", () => {
  const profile = buildGenreProfile([]);
  assert.deepEqual(profile.genres, {});
  assert.deepEqual(profile.categories, {});
  assert.equal(profile.bookmarkIds.size, 0);
});

test("buildGenreProfile counts genres with weighting by bookmark type", () => {
  const bookmarks: BookmarkTitle[] = [
    {
      id: 1,
      dir: "title-a",
      genres: ["Комедия", "Фэнтези"],
      categories: ["Веб"],
      typeName: "Читаю",
    },
    {
      id: 2,
      dir: "title-b",
      genres: ["Фэнтези"],
      categories: [],
      typeName: "Планирую",
    },
  ];
  const profile = buildGenreProfile(bookmarks);
  assert.equal(profile.genres["Фэнтези"], 4);
  assert.equal(profile.genres["Комедия"], 3);
  assert.equal(profile.categories["Веб"], 3);
  assert.equal(profile.bookmarkIds.size, 2);
  assert.ok(profile.bookmarkIds.has(1));
  assert.ok(profile.bookmarkIds.has(2));
});

test("buildGenreProfile gives Читаю ×3, В процессе ×2, others ×1", () => {
  const bookmarks: BookmarkTitle[] = [
    { id: 1, dir: "a", genres: ["X"], categories: [], typeName: "Читаю" },
    { id: 2, dir: "b", genres: ["X"], categories: [], typeName: "В процессе" },
    { id: 3, dir: "c", genres: ["X"], categories: [], typeName: "Брошено" },
    { id: 4, dir: "d", genres: ["X"], categories: [], typeName: "Прочитано" },
    { id: 5, dir: "e", genres: ["X"], categories: [], typeName: "Отложено" },
  ];
  const profile = buildGenreProfile(bookmarks);
  assert.equal(profile.genres["X"], 3 + 2 + 1 + 1 + 1);
});

test("filterNativeCards removes cards whose data-id is in bookmarkIds", () => {
  const profile: GenreProfile = {
    genres: {},
    categories: {},
    bookmarkIds: new Set([10, 20]),
    bookmarkDirs: new Set(["title-10", "title-20"]),
    updatedAt: Date.now(),
  };
  const cards: NativeCard[] = [
    { id: 10, dir: "title-10", element: document.createElement("a") },
    { id: 20, dir: "title-20", element: document.createElement("a") },
    { id: 30, dir: "title-30", element: document.createElement("a") },
  ];
  const kept = filterNativeCards(cards, profile);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, 30);
});

test("filterNativeCards removes cards whose dir is in bookmarkDirs", () => {
  const profile: GenreProfile = {
    genres: {},
    categories: {},
    bookmarkIds: new Set(),
    bookmarkDirs: new Set(["title-10"]),
    updatedAt: Date.now(),
  };
  const cards: NativeCard[] = [
    { id: 10, dir: "title-10", element: document.createElement("a") },
    { id: 30, dir: "title-30", element: document.createElement("a") },
  ];
  const kept = filterNativeCards(cards, profile);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].id, 30);
});

test("pickSupplements returns candidates not in bookmarkIds, sorted by genre match score", () => {
  const profile: GenreProfile = {
    genres: { "Комедия": 6, "Фэнтези": 3 },
    categories: {},
    bookmarkIds: new Set([1, 2]),
    bookmarkDirs: new Set(),
    updatedAt: Date.now(),
  };
  const candidates: RecCandidate[] = [
    {
      id: 3,
      dir: "c3",
      img: "",
      mainName: "C3",
      typeName: "Манхва",
      issueYear: 2024,
      rating: 8.5,
      genres: ["Комедия", "Фэнтези"],
    },
    {
      id: 4,
      dir: "c4",
      img: "",
      mainName: "C4",
      typeName: "Манхва",
      issueYear: 2023,
      rating: 9.0,
      genres: ["Драма"],
    },
    {
      id: 2,
      dir: "c2",
      img: "",
      mainName: "C2 Bookmarked",
      typeName: "Манхва",
      issueYear: 2023,
      rating: 9.0,
      genres: ["Комедия"],
    },
  ];
  const result = pickSupplements(candidates, profile, 10);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 3);
  assert.equal(result[1].id, 4);
});

test("pickSupplements respects the max count", () => {
  const profile: GenreProfile = {
    genres: { "Комедия": 6 },
    categories: {},
    bookmarkIds: new Set(),
    bookmarkDirs: new Set(),
    updatedAt: Date.now(),
  };
  const candidates: RecCandidate[] = [1, 2, 3, 4, 5].map((i) => ({
    id: i,
    dir: `c${i}`,
    img: "",
    mainName: `C${i}`,
    typeName: "Манхва",
    issueYear: 2024,
    rating: 8.0,
    genres: ["Комедия"],
  }));
  const result = pickSupplements(candidates, profile, 3);
  assert.equal(result.length, 3);
});

test("fetchBookmarkTitles returns BookmarkTitle[] from paginated API", async () => {
  const fetchedPages: Array<{ url: string }> = [];
  const mockFetch = async (url: string): Promise<Response> => {
    fetchedPages.push({ url });
    if (url.includes("page=1")) {
      return new Response(
        JSON.stringify({
          next: 2,
          results: [
            { title: { id: 10, dir: "t10" }, type: { id: 1, name: "Читаю" } },
            { title: { id: 20, dir: "t20" }, type: { id: 2, name: "Планирую" } },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({ next: null, results: [] }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  const result = await fetchBookmarkTitles(
    "fake-token",
    99,
    mockFetch as typeof fetch,
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 10);
  assert.equal(result[0].typeName, "Читаю");
  assert.equal(result[1].id, 20);
  assert.equal(result[1].typeName, "Планирую");
});

test("fetchTitleGenres returns genres and categories for a title dir", async () => {
  const mockFetch = async (_url: string): Promise<Response> => {
    return new Response(
      JSON.stringify({
        id: 10,
        dir: "t10",
        genres: [{ id: 1, name: "Комедия" }],
        categories: [{ id: 5, name: "Веб" }],
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  };
  const result = await fetchTitleGenres("fake-token", "t10", mockFetch as typeof fetch);
  assert.deepEqual(result, { dir: "t10", genres: ["Комедия"], categories: ["Веб"] });
});

test("fetchTitleGenres returns null on API error", async () => {
  const mockFetch = async (_url: string): Promise<Response> => {
    return new Response("not found", { status: 404 });
  };
  const result = await fetchTitleGenres("fake-token", "bad-dir", mockFetch as typeof fetch);
  assert.equal(result, null);
});

test("fetchCatalogByGenres returns RecCandidate[] from catalog API", async () => {
  const requestedUrls: string[] = [];
  const mockFetch = async (url: string): Promise<Response> => {
    requestedUrls.push(url);
    if (url.includes("/api/v2/search/")) {
      return new Response(
        JSON.stringify({
          results: [
            {
              id: 50,
              dir: "t50",
              main_name: "Тайтл 50",
              secondary_name: "Title 50",
              img: { mid: "/media/t50.webp" },
              type: { name: "Манхва" },
              issue_year: 2024,
              rating: { average: 8.5 },
              genres: [{ name: "Комедия" }],
              categories: [{ name: "Веб" }],
              count_chapters: 100,
              views_count: 50000,
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { headers: { "Content-Type": "application/json" } });
  };
  const result = await fetchCatalogByGenres(
    "fake-token",
    ["Комедия"],
    mockFetch as typeof fetch,
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 50);
  assert.equal(result[0].mainName, "Тайтл 50");
  assert.equal(result[0].genres[0], "Комедия");
});

test("fetchCatalogByGenres returns empty on API error", async () => {
  const mockFetch = async (_url: string): Promise<Response> => {
    return new Response("error", { status: 500 });
  };
  const result = await fetchCatalogByGenres(
    "fake-token",
    ["Комедия"],
    mockFetch as typeof fetch,
  );
  assert.equal(result.length, 0);
});

test("findRecommendationsSection returns the section containing 'Рекомендации для вас'", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-sentry-component="Container">
      <div data-sentry-component="DecoratedSliderWrapper">
        <div class="flex justify-between">
          <div class="flex h-10 items-center gap-2">
            <span class="text-lg leading-none font-semibold text-white uppercase italic">Рекомендации для вас</span>
          </div>
        </div>
        <div data-slot="carousel-content">
          <a data-slot="carousel-item" href="/manga/title-10/main">
            <div data-id="10" data-sentry-component="TitleCardRoot">Card 10</div>
          </a>
          <a data-slot="carousel-item" href="/manga/title-20/main">
            <div data-id="20" data-sentry-component="TitleCardRoot">Card 20</div>
          </a>
        </div>
      </div>
    </div>
  `;
  const section = findRecommendationsSection(root);
  assert.ok(section, "section not found");
  assert.ok(section.innerHTML.includes("Рекомендации для вас"));
});

test("findRecommendationsSection returns null when section is absent", () => {
  const root = document.createElement("div");
  root.innerHTML = `<div>Other content</div>`;
  const section = findRecommendationsSection(root);
  assert.equal(section, null);
});

test("extractNativeCards returns NativeCard[] from carousel items", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-sentry-component="DecoratedSliderWrapper">
      <div data-slot="carousel-content">
        <a data-slot="carousel-item" href="/manga/title-10/main">
          <div data-id="10" data-sentry-component="TitleCardRoot">Card 10</div>
        </a>
        <a data-slot="carousel-item" href="/manga/title-20/main">
          <div data-id="20" data-sentry-component="TitleCardRoot">Card 20</div>
        </a>
      </div>
    </div>
  `;
  const wrapper = root.querySelector('[data-sentry-component="DecoratedSliderWrapper"]') as HTMLElement;
  const cards = extractNativeCards(wrapper);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].id, 10);
  assert.equal(cards[0].dir, "title-10");
  assert.equal(cards[1].id, 20);
  assert.equal(cards[1].dir, "title-20");
});

test("buildCandidateCard creates anchor with cover image, rating, type, and title", () => {
  const candidate: RecCandidate = {
    id: 50,
    dir: "title-50",
    img: "https://remanga.org/media/t50.webp",
    mainName: "Милый дом",
    typeName: "Манхва",
    issueYear: 2017,
    rating: 9.5,
    genres: ["Комедия"],
  };
  const el = buildCandidateCard(candidate);
  assert.equal(el.tagName, "A");
  assert.equal(el.getAttribute("href"), "/manga/title-50/main");
  assert.ok(el.innerHTML.includes("9.5"));
  assert.ok(el.innerHTML.includes("Манхва"));
  assert.ok(el.innerHTML.includes("Милый дом"));
  const card = el.querySelector('[data-sentry-component="TitleCardRoot"]');
  assert.ok(card);
  assert.equal(card?.getAttribute("data-id"), "50");
});

test("applyRecommendations replaces bookmarked cards and adds supplements", async () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-sentry-component="Container">
      <div data-sentry-component="DecoratedSliderWrapper">
        <div class="flex justify-between">
          <div class="flex h-10 items-center gap-2">
            <span class="text-lg leading-none font-semibold text-white uppercase italic">Рекомендации для вас</span>
          </div>
        </div>
        <div data-slot="carousel-content">
          <a data-slot="carousel-item" href="/manga/bookmarked-title/main">
            <div data-id="999" data-sentry-component="TitleCardRoot">Bookmarked</div>
          </a>
          <a data-slot="carousel-item" href="/manga/kept-title/main">
            <div data-id="888" data-sentry-component="TitleCardRoot">Kept</div>
          </a>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  const mockFetch = async (url: string): Promise<Response> => {
    if (url.includes("/bookmarks/")) {
      return new Response(
        JSON.stringify({
          next: null,
          results: [{ title: { id: 999, dir: "bookmarked-title" }, type: { name: "Читаю" } }],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/titles/bookmarked-title/")) {
      return new Response(
        JSON.stringify({
          id: 999,
          dir: "bookmarked-title",
          genres: [{ name: "Комедия" }],
          categories: [],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    if (url.includes("/search/")) {
      return new Response(
        JSON.stringify({
          results: [
            {
              id: 100,
              dir: "new-title",
              main_name: "Новый тайтл",
              type: { name: "Манхва" },
              issue_year: 2025,
              rating: { average: 8.0 },
              img: { mid: "/media/new.webp" },
              genres: [{ name: "Комедия" }],
              categories: [],
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 404 });
  };

  const deps = {
    getToken: async () => "fake-token",
    getUserId: async () => 1,
    fetchImpl: mockFetch as typeof fetch,
  };

  await applyRecommendations(root, deps);

  const carouselContent = root.querySelector('[data-slot="carousel-content"]') as HTMLElement;
  const items = carouselContent.querySelectorAll('[data-slot="carousel-item"]');
  const ids = Array.from(items).map((i) => {
    const card = i.querySelector('[data-sentry-component="TitleCardRoot"]');
    return Number(card?.getAttribute("data-id"));
  });
  assert.ok(!ids.includes(999), "bookmarked card should be removed");
  assert.ok(ids.includes(888), "non-bookmarked card should be kept");
  assert.ok(ids.includes(100), "supplement card should be added");

  root.remove();
});