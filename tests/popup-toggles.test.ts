import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToggles } from "../src/popup.js";
import { DEFAULT_SETTINGS, cloneSettings, type ReaderEnhancerSettings } from "../src/settings.js";

const html = readFileSync(resolve("public/popup.html"), "utf8");

const setup = () => {
  const dom = new JSDOM(html);
  const settings = cloneSettings(DEFAULT_SETTINGS);
  renderToggles(dom.window.document, settings, async () => {});
  return { dom, settings };
};

test("site drill-down has 12 toggles", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="site"]');
  assert.equal(list?.querySelectorAll(".toggle").length, 12);
});

test("site drill-down has two subsection headings", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="site"]');
  const headings = list?.querySelectorAll(".drill-subheading");
  const texts = [...(headings ?? [])].map((h) => h.textContent);
  assert.deepEqual(texts, ["КНОПКИ ШАПКИ", "ГЛАВНАЯ СТРАНИЦА"]);
});

test("reader drill-down has 6 toggles", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="reader"]');
  assert.equal(list?.querySelectorAll(".toggle").length, 6);
});

test("premium-free drill-down has 2 toggles", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="premium-free"]');
  assert.equal(list?.querySelectorAll(".toggle").length, 2);
});

test("premium-free first toggle has caption", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="premium-free"]');
  const firstToggle = list?.querySelector(".toggle");
  const caption = firstToggle?.querySelector(".toggle__caption");
  assert.equal(caption?.textContent, "Бесплатный доступ к платным главам");
});

test("toggle reflects current settings state (ON)", () => {
  const dom = new JSDOM(html);
  const settings = cloneSettings(DEFAULT_SETTINGS);
  settings.premiumFree = true;
  renderToggles(dom.window.document, settings, async () => {});
  const list = dom.window.document.querySelector('[data-toggle-list="premium-free"]');
  const input = list?.querySelector('.toggle input[type="checkbox"]') as HTMLInputElement | null;
  assert.equal(input?.checked, true);
});

test("clicking a toggle calls commit with the new settings", async () => {
  const dom = new JSDOM(html);
  const settings = cloneSettings(DEFAULT_SETTINGS);
  let committed: ReaderEnhancerSettings | null = null;
  renderToggles(dom.window.document, settings, async (next) => {
    committed = next;
  });
  const list = dom.window.document.querySelector('[data-toggle-list="premium-free"]');
  const input = list?.querySelector('.toggle input[type="checkbox"]') as HTMLInputElement;
  input.checked = true;
  input.dispatchEvent(new dom.window.Event("change"));
  await Promise.resolve();
  assert.ok(committed !== null);
  assert.equal((committed as ReaderEnhancerSettings).premiumFree, true);
});
