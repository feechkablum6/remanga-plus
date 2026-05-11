import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  wireCardNavigation,
  wireScreenVisibility,
  wireBackButtons,
  renderCardSubtitles,
} from "../src/popup.js";
import { createPopupRouter } from "../src/popup-router.js";

const html = readFileSync(resolve("public/popup.html"), "utf8");

const setup = () => {
  const dom = new JSDOM(html);
  const router = createPopupRouter();
  wireScreenVisibility(dom.window.document, router);
  wireCardNavigation(dom.window.document, router);
  wireBackButtons(dom.window.document, router);
  renderCardSubtitles(dom.window.document);
  return { dom, router };
};

test("at start, only main screen is visible", () => {
  const { dom } = setup();
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-screen="main"]')?.hasAttribute("hidden"), false);
  for (const key of ["site", "reader", "premium-free"]) {
    assert.equal(doc.querySelector(`[data-screen="${key}"]`)?.hasAttribute("hidden"), true, key);
  }
});

test("clicking a card navigates to the corresponding drill-down screen", () => {
  const { dom } = setup();
  const doc = dom.window.document;
  const card = doc.querySelector<HTMLElement>('[data-card="reader"]');
  card?.click();
  assert.equal(doc.querySelector('[data-screen="main"]')?.hasAttribute("hidden"), true);
  assert.equal(doc.querySelector('[data-screen="reader"]')?.hasAttribute("hidden"), false);
});

test("clicking back returns to main", () => {
  const { dom } = setup();
  const doc = dom.window.document;
  doc.querySelector<HTMLElement>('[data-card="premium-free"]')?.click();
  doc.querySelector<HTMLElement>('[data-back="premium-free"]')?.click();
  assert.equal(doc.querySelector('[data-screen="main"]')?.hasAttribute("hidden"), false);
  assert.equal(doc.querySelector('[data-screen="premium-free"]')?.hasAttribute("hidden"), true);
});

test("card subtitles use Russian plural forms", () => {
  const { dom } = setup();
  const doc = dom.window.document;
  assert.equal(doc.querySelector('[data-card-subtitle="site"]')?.textContent, "12 настроек");
  assert.equal(doc.querySelector('[data-card-subtitle="reader"]')?.textContent, "8 настроек");
  assert.equal(doc.querySelector('[data-card-subtitle="premium-free"]')?.textContent, "3 настройки");
});
