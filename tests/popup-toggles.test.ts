import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToggles } from "../src/popup.js";
import { DEFAULT_SETTINGS, cloneSettings, type ReaderEnhancerSettings } from "../src/settings.js";

const html = readFileSync(resolve("public/popup.html"), "utf8");

const setup = () => {
  const dom = new JSDOM(html, { url: "http://localhost/" });
  const settings = cloneSettings(DEFAULT_SETTINGS);
  renderToggles(dom.window.document, settings, async () => {});
  return { dom, settings };
};

test("site drill-down has 19 toggles", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="site"]');
  assert.equal(list?.querySelectorAll(".toggle").length, 19);
});

test("site drill-down has four collapsible section triggers", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="site"]');
  const triggers = list?.querySelectorAll(".collapsible-group__trigger");
  const texts = [...(triggers ?? [])].map((h) => h.textContent);
  assert.deepEqual(texts, ["КНОПКИ ШАПКИ", "ГЛАВНАЯ СТРАНИЦА", "Скрытие на главной", "Фильтровать закладки"]);
});

test("reader drill-down has 8 toggles", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="reader"]');
  assert.equal(list?.querySelectorAll(".toggle").length, 8);
});

test("reader drill-down has АВТО-СКРЫТИЯ subsection trigger", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="reader"]');
  const triggers = list?.querySelectorAll(".collapsible-group__trigger");
  const texts = [...(triggers ?? [])].map((h) => h.textContent);
  assert.deepEqual(texts, ["АВТО-СКРЫТИЯ"]);
});

test("premium-free drill-down has 14 toggles (4 core + 3 rec-type + 7 providers)", () => {
  const { dom } = setup();
  const list = dom.window.document.querySelector('[data-toggle-list="premium-free"]');
  assert.equal(list?.querySelectorAll(".toggle").length, 14);
});

test("toggling 'auto-dismiss hints' commits hidePopups.hints = true", async () => {
  const dom = new JSDOM(html);
  const settings = cloneSettings(DEFAULT_SETTINGS);
  let committed: ReaderEnhancerSettings | null = null;
  renderToggles(dom.window.document, settings, async (next) => {
    committed = next;
  });
  const list = dom.window.document.querySelector('[data-toggle-list="reader"]');
  const toggles = list?.querySelectorAll(".toggle") ?? [];
  // first auto-dismiss toggle = "Авто-скрывать подсказки" (index 5: after 5 visual toggles)
  const labelEls = list?.querySelectorAll(".toggle__label") ?? [];
  let hintsIndex = -1;
  for (let i = 0; i < labelEls.length; i++) {
    if (labelEls[i].textContent === "Авто-скрывать подсказки") {
      hintsIndex = i;
      break;
    }
  }
  assert.notEqual(hintsIndex, -1, "hints toggle not found");
  const input = toggles[hintsIndex].querySelector('input[type="checkbox"]') as HTMLInputElement;
  input.checked = true;
  input.dispatchEvent(new dom.window.Event("change"));
  await Promise.resolve();
  assert.ok(committed !== null);
  assert.equal((committed as ReaderEnhancerSettings).hidePopups.hints, true);
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

test("clicking collapsible section trigger toggles the hidden attribute on the body element and persists state", async () => {
  const dom = new JSDOM(html, { url: "http://localhost/" });
  const settings = cloneSettings(DEFAULT_SETTINGS);
  
  dom.window.localStorage.clear();
  
  renderToggles(dom.window.document, settings, async () => {});
  
  const list = dom.window.document.querySelector('[data-toggle-list="site"]');
  const trigger = list?.querySelector(".collapsible-group__trigger") as HTMLElement;
  assert.ok(trigger, "section trigger should exist");
  
  // By default, subsections start expanded
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  
  const body = trigger.nextElementSibling as HTMLElement;
  assert.ok(body, "body container should exist");
  assert.equal(body.hasAttribute("hidden"), false, "body should be visible by default");
  
  // Click to collapse
  trigger.dispatchEvent(new dom.window.Event("click"));
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(body.hasAttribute("hidden"), true, "body should be hidden after click");
  
  // Verify localStorage
  const key = `rre-collapsible-${trigger.textContent}`;
  assert.equal(dom.window.localStorage.getItem(key), "false");
  
  // Re-render and verify it remains collapsed
  const dom2 = new JSDOM(html, { url: "http://localhost/" });
  dom2.window.localStorage.setItem(key, "false");
  renderToggles(dom2.window.document, settings, async () => {});
  
  const list2 = dom2.window.document.querySelector('[data-toggle-list="site"]');
  const trigger2 = list2?.querySelector(".collapsible-group__trigger") as HTMLElement;
  const body2 = trigger2.nextElementSibling as HTMLElement;
  assert.equal(trigger2.getAttribute("aria-expanded"), "false");
  assert.equal(body2.hasAttribute("hidden"), true, "body should remain hidden after re-render if saved in localStorage");
});
