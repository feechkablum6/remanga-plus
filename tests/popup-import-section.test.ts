import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { wireResumeBanner } from "../src/popup.js";

const html = readFileSync(resolve("public/popup.html"), "utf8");
const ts = readFileSync(resolve("src/popup.ts"), "utf8");

test("popup.html exposes auth hooks for new layout", () => {
  for (const hook of [
    "data-auth-mangalib",
    "data-auth-remanga",
    "data-auth-icon",
    "data-auth-link",
    "data-auth-hint",
    "data-import-button",
    "data-resume-banner",
  ]) {
    assert.match(html, new RegExp(hook), `missing ${hook}`);
  }
});

test("popup.html site links point to real domains", () => {
  assert.match(html, /href="https:\/\/mangalib\.me\//);
  assert.match(html, /href="https:\/\/remanga\.org\//);
});

test("popup.ts wires import button to open import.html", () => {
  assert.match(ts, /CHECK_AUTH_MESSAGE_TYPE/);
  assert.match(ts, /chrome\.tabs\.create/);
  assert.match(ts, /import\.html/);
});

test("popup.ts wires site link clicks to chrome.tabs.create", () => {
  // Both site URLs should appear in popup.ts since wireSiteLinks calls chrome.tabs.create
  assert.match(ts, /mangalib\.me/);
  assert.match(ts, /remanga\.org/);
});

test("resume banner hidden when no interrupted import", () => {
  const dom = new JSDOM(html);
  wireResumeBanner(dom.window.document, null);
  const banner = dom.window.document.querySelector<HTMLElement>("[data-resume-banner]");
  assert.equal(banner?.hidden, true);
});

test("resume banner visible with phase text when interrupted state exists", () => {
  const dom = new JSDOM(html);
  // Pass a minimal state shape: { phase: "fetching" } cast via `unknown` so we don't depend on exact ImportState type here
  wireResumeBanner(dom.window.document, { phase: "fetching" } as unknown as Parameters<typeof wireResumeBanner>[1]);
  const banner = dom.window.document.querySelector<HTMLElement>("[data-resume-banner]");
  assert.equal(banner?.hidden, false);
  assert.match(banner?.textContent ?? "", /Прерван — продолжить/);
});

test("resume banner hidden when phase is 'done'", () => {
  const dom = new JSDOM(html);
  wireResumeBanner(dom.window.document, { phase: "done" } as unknown as Parameters<typeof wireResumeBanner>[1]);
  const banner = dom.window.document.querySelector<HTMLElement>("[data-resume-banner]");
  assert.equal(banner?.hidden, true);
});
