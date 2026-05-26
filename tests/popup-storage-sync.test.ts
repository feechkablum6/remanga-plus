import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToggles } from "../src/popup.js";
import { DEFAULT_SETTINGS, cloneSettings } from "../src/settings.js";

const html = readFileSync(resolve("public/popup.html"), "utf8");

test("renderToggles is idempotent — re-rendering with new settings updates toggle state", () => {
  const dom = new JSDOM(html);
  const initial = cloneSettings(DEFAULT_SETTINGS);
  renderToggles(dom.window.document, initial, async () => {});
  const list = dom.window.document.querySelector('[data-toggle-list="premium-free"]');
  const input1 = list?.querySelector('.toggle input[type="checkbox"]') as HTMLInputElement;
  assert.equal(input1.checked, false);

  // Simulate external change (e.g. from another browser window)
  const updated = cloneSettings(DEFAULT_SETTINGS);
  updated.premiumFree = true;
  renderToggles(dom.window.document, updated, async () => {});
  const input2 = list?.querySelector('.toggle input[type="checkbox"]') as HTMLInputElement;
  assert.equal(input2.checked, true);
});

test("renderToggles does NOT duplicate DOM children on second render", () => {
  const dom = new JSDOM(html);
  const settings = cloneSettings(DEFAULT_SETTINGS);
  renderToggles(dom.window.document, settings, async () => {});
  renderToggles(dom.window.document, settings, async () => {});
  const list = dom.window.document.querySelector('[data-toggle-list="site"]');
  // 19 toggle rows total, should NOT be 38
  assert.equal(list?.querySelectorAll(".toggle").length, 19);
});
