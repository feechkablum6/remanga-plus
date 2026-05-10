import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normaliseTitle,
  matchTitle,
  type RemangaCandidate,
} from "../src/import-mangalib/title-matcher.js";

test("normaliseTitle lowercases and trims", () => {
  assert.equal(normaliseTitle("  Solo  Leveling  "), "solo leveling");
});

test("normaliseTitle replaces ё with е", () => {
  assert.equal(normaliseTitle("Тёмный"), "темныи");
});

test("normaliseTitle drops punctuation", () => {
  assert.equal(normaliseTitle("Solo: Leveling!"), "solo leveling");
});

test("certain match by main_name exact", () => {
  const candidates: RemangaCandidate[] = [
    { id: 1, dir: "x", main_name: "Solo Leveling", secondary_name: "", another_name: "" },
    { id: 2, dir: "y", main_name: "Other", secondary_name: "", another_name: "" },
  ];
  const result = matchTitle("Solo Leveling", candidates);
  assert.equal(result.kind, "certain");
  assert.equal(result.kind === "certain" ? result.chosen.id : null, 1);
});

test("certain match by secondary_name", () => {
  const candidates: RemangaCandidate[] = [
    { id: 5, dir: "sl", main_name: "Поднятие уровня в одиночку", secondary_name: "Solo Leveling", another_name: "" },
  ];
  const result = matchTitle("Solo Leveling", candidates);
  assert.equal(result.kind, "certain");
});

test("certain match against any synonym in another_name", () => {
  const candidates: RemangaCandidate[] = [
    { id: 7, dir: "tg", main_name: "X", secondary_name: "Y", another_name: "Foo / Dark Genius / Bar" },
  ];
  const result = matchTitle("Dark Genius", candidates);
  assert.equal(result.kind, "certain");
});

test("ambiguous when only fuzzy matches", () => {
  const candidates: RemangaCandidate[] = [
    { id: 1, dir: "x", main_name: "Solo Leveling: Ragnarok", secondary_name: "", another_name: "" },
    { id: 2, dir: "y", main_name: "Solo Leveling Side Story", secondary_name: "", another_name: "" },
  ];
  const result = matchTitle("Solo Leveling", candidates);
  assert.equal(result.kind, "ambiguous");
  assert.equal(result.kind === "ambiguous" ? result.candidates.length : 0, 2);
});

test("not_found when candidate list empty", () => {
  assert.equal(matchTitle("X", []).kind, "not_found");
});

test("not_found when no candidate even fuzzy-matches", () => {
  const candidates: RemangaCandidate[] = [
    { id: 1, dir: "x", main_name: "Completely Different", secondary_name: "", another_name: "" },
  ];
  assert.equal(matchTitle("Solo Leveling", candidates).kind, "not_found");
});
