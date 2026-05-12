import "./setup-dom.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGenreProfile,
  filterNativeCards,
  pickSupplements,
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