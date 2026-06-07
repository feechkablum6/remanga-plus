import "./setup-dom.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGenreProfile,
  filterNativeCards,
  pickSupplements,
  selectTopGenres,
  parseCatalogCandidates,
  parseTitleDetailGenres,
  parseGenreIdMap,
  classifyRecommendationType,
  applyTypePreferences,
  sanitizeTypePreferences,
  type BookmarkTitle,
  type GenreProfile,
  type NativeCard,
  type RecCandidate,
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
      bookmarkType: null,
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
      bookmarkType: null,
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
      bookmarkType: null,
    },
  ];
  const result = pickSupplements(candidates, profile, 10);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 3);
  assert.equal(result[1].id, 4);
});

test("pickSupplements excludes candidates the viewer already bookmarked (bookmarkType set)", () => {
  const profile: GenreProfile = {
    genres: { "Комедия": 5 },
    categories: {},
    bookmarkIds: new Set(),
    bookmarkDirs: new Set(),
    updatedAt: Date.now(),
  };
  const candidates: RecCandidate[] = [
    { id: 1, dir: "a", img: "", mainName: "A", typeName: "Манхва", issueYear: 2024, rating: 9, genres: ["Комедия"], bookmarkType: "Прочитано" },
    { id: 2, dir: "b", img: "", mainName: "B", typeName: "Манхва", issueYear: 2024, rating: 8, genres: ["Комедия"], bookmarkType: null },
  ];
  const result = pickSupplements(candidates, profile, 10);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 2);
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
    bookmarkType: null,
  }));
  const result = pickSupplements(candidates, profile, 3);
  assert.equal(result.length, 3);
});

test("selectTopGenres returns the highest-weighted genre names, capped", () => {
  const profile: GenreProfile = {
    genres: { "Фэнтези": 10, "Комедия": 6, "Драма": 3, "Спорт": 1 },
    categories: {},
    bookmarkIds: new Set(),
    bookmarkDirs: new Set(),
    updatedAt: Date.now(),
  };
  assert.deepEqual(selectTopGenres(profile, 2), ["Фэнтези", "Комедия"]);
  assert.deepEqual(selectTopGenres(profile, 0), []);
});

test("parseCatalogCandidates maps catalog rows to RecCandidate with flattened genres", () => {
  const raw = {
    content: [
      {
        id: 2060,
        dir: "solo-leveling_",
        main_name: "Поднятие уровня в одиночку",
        type: "Манхва",
        issue_year: 2018,
        avg_rating: 9.7,
        bookmark_type: "Прочитано",
        cover: { low: "/l.webp", mid: "/m.webp", high: "/h.webp" },
        genres: [
          { id: 2, name: "Экшен" },
          { id: 38, name: "Фэнтези" },
        ],
      },
      { id: "bad", dir: "skip-me" },
    ],
  };
  const result = parseCatalogCandidates(raw);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], {
    id: 2060,
    dir: "solo-leveling_",
    img: "/m.webp",
    mainName: "Поднятие уровня в одиночку",
    typeName: "Манхва",
    issueYear: 2018,
    rating: 9.7,
    genres: ["Экшен", "Фэнтези"],
    bookmarkType: "Прочитано",
  });
});

test("parseCatalogCandidates tolerates string avg_rating and missing content", () => {
  assert.deepEqual(parseCatalogCandidates({}), []);
  assert.deepEqual(parseCatalogCandidates(null), []);
  const result = parseCatalogCandidates({
    content: [
      { id: 1, dir: "a", avg_rating: "7.3", type: { id: 2, name: "Манхва" } },
    ],
  });
  assert.equal(result[0].rating, 7.3);
  assert.equal(result[0].typeName, "Манхва");
  assert.equal(result[0].img, "");
  assert.equal(result[0].bookmarkType, null);
});

test("parseTitleDetailGenres reads dir/genres/categories from content wrapper", () => {
  const raw = {
    content: {
      id: 2060,
      dir: "solo-leveling_",
      genres: [
        { id: 2, name: "Экшен", dir: "ekshen" },
        { id: 38, name: "Фэнтези", dir: "fentezi" },
      ],
      categories: [{ id: 6, name: "В цвете" }],
    },
  };
  assert.deepEqual(parseTitleDetailGenres(raw), {
    id: 2060,
    dir: "solo-leveling_",
    genres: ["Экшен", "Фэнтези"],
    categories: ["В цвете"],
  });
});

test("parseTitleDetailGenres returns null when dir is absent", () => {
  assert.equal(parseTitleDetailGenres({ content: { genres: [] } }), null);
  assert.equal(parseTitleDetailGenres(null), null);
});

test("parseGenreIdMap maps genre names to ids from a detail payload", () => {
  const raw = {
    content: {
      genres: [
        { id: 2, name: "Экшен" },
        { id: 38, name: "Фэнтези" },
        { name: "NoId" },
      ],
    },
  };
  assert.deepEqual(parseGenreIdMap(raw), { "Экшен": 2, "Фэнтези": 38 });
  assert.deepEqual(parseGenreIdMap({}), {});
});

test("classifyRecommendationType maps known type names to keys", () => {
  assert.equal(classifyRecommendationType("Манга"), "manga");
  assert.equal(classifyRecommendationType("Манхва"), "manhwa");
  assert.equal(classifyRecommendationType("Маньхуа"), "manhua");
});

test("classifyRecommendationType is case-insensitive and trims", () => {
  assert.equal(classifyRecommendationType("  МАНГА  "), "manga");
  assert.equal(classifyRecommendationType("манхва"), "manhwa");
});

test("classifyRecommendationType returns null for unknown types", () => {
  assert.equal(classifyRecommendationType("Западный"), null);
  assert.equal(classifyRecommendationType("OEL"), null);
  assert.equal(classifyRecommendationType(""), null);
  assert.equal(classifyRecommendationType(undefined), null);
});

test("applyTypePreferences returns all items unchanged with all-neutral prefs", () => {
  const items = [{ dir: "a", typeName: "Манга" }, { dir: "b", typeName: "Манхва" }];
  const prefs = { manga: "neutral", manhwa: "neutral", manhua: "neutral" } as const;
  const result = applyTypePreferences(items, prefs, (r) =>
    classifyRecommendationType(r.typeName),
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].dir, "a");
  assert.equal(result[1].dir, "b");
});

test("applyTypePreferences removes excluded types", () => {
  const items = [
    { dir: "a", t: "Манга" },
    { dir: "b", t: "Манхва" },
    { dir: "c", t: "Маньхуа" },
  ];
  const prefs = { manga: "neutral", manhwa: "excluded", manhua: "neutral" } as const;
  const result = applyTypePreferences(items, prefs, (r) =>
    classifyRecommendationType(r.t),
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].dir, "a");
  assert.equal(result[1].dir, "c");
});

test("applyTypePreferences lifts priority types to the front (stable)", () => {
  const items = [
    { dir: "a", t: "Манга" },
    { dir: "b", t: "Манхва" },
    { dir: "c", t: "Маньхуа" },
    { dir: "d", t: "Манхва" },
  ];
  const prefs = { manga: "neutral", manhwa: "priority", manhua: "neutral" } as const;
  const result = applyTypePreferences(items, prefs, (r) =>
    classifyRecommendationType(r.t),
  );
  // Priority (manhwa) first, then neutral (manga, manhua)
  assert.equal(result.length, 4);
  assert.equal(result[0].dir, "b");
  assert.equal(result[1].dir, "d");
  assert.equal(result[2].dir, "a");
  assert.equal(result[3].dir, "c");
});

test("applyTypePreferences keeps unclassified items as neutral", () => {
  const items = [
    { dir: "a", t: "Западный" },
    { dir: "b", t: "Манхва" },
  ];
  const prefs = { manga: "neutral", manhwa: "excluded", manhua: "neutral" } as const;
  const result = applyTypePreferences(items, prefs, (r) =>
    classifyRecommendationType(r.t),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].dir, "a");
});

test("sanitizeTypePreferences accepts valid states and drops invalid ones", () => {
  assert.deepEqual(sanitizeTypePreferences({ manga: "priority" }), {
    manga: "priority",
    manhwa: "neutral",
    manhua: "neutral",
  });
  assert.deepEqual(sanitizeTypePreferences({ manhwa: "excluded" }), {
    manga: "neutral",
    manhwa: "excluded",
    manhua: "neutral",
  });
});

test("sanitizeTypePreferences drops invalid keys and states", () => {
  assert.deepEqual(
    sanitizeTypePreferences({ manga: "bad", unknown: "excluded", manhua: "priority" }),
    {
      manga: "neutral",
      manhwa: "neutral",
      manhua: "priority",
    },
  );
  assert.deepEqual(sanitizeTypePreferences(null), {
    manga: "neutral",
    manhwa: "neutral",
    manhua: "neutral",
  });
});