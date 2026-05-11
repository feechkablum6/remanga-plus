import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { renderResumeBanner, wireResumeBanner } from "../src/popup.js";

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
  renderResumeBanner(dom.window.document, null);
  const banner = dom.window.document.querySelector<HTMLElement>("[data-resume-banner]");
  assert.equal(banner?.hidden, true);
});

test("resume banner visible with phase text when interrupted state exists", () => {
  const dom = new JSDOM(html);
  // Pass a minimal state shape: { phase: "fetching" } cast via `unknown` so we don't depend on exact ImportState type here
  renderResumeBanner(dom.window.document, { phase: "fetching" } as unknown as Parameters<typeof renderResumeBanner>[1]);
  const banner = dom.window.document.querySelector<HTMLElement>("[data-resume-banner]");
  assert.equal(banner?.hidden, false);
  assert.match(banner?.textContent ?? "", /Прерван — продолжить/);
});

test("resume banner hidden when phase is 'done'", () => {
  const dom = new JSDOM(html);
  renderResumeBanner(dom.window.document, { phase: "done" } as unknown as Parameters<typeof renderResumeBanner>[1]);
  const banner = dom.window.document.querySelector<HTMLElement>("[data-resume-banner]");
  assert.equal(banner?.hidden, true);
});

test("resume banner exposes a dismiss button alongside the action", () => {
  assert.match(html, /data-resume-action/);
  assert.match(html, /data-resume-dismiss/);
});

test("dismiss button hides the banner without opening import.html", () => {
  const dom = new JSDOM(html, { url: "https://example.test/" });
  const originalChrome = (globalThis as { chrome?: unknown }).chrome;
  let openedUrl: string | null = null;
  (globalThis as { chrome?: unknown }).chrome = {
    tabs: { create: (opts: { url: string }) => { openedUrl = opts.url; } },
    runtime: { getURL: (p: string) => `chrome-extension://x/${p}` },
  };
  try {
    renderResumeBanner(dom.window.document, { phase: "fetching" } as unknown as Parameters<typeof renderResumeBanner>[1]);
    wireResumeBanner(dom.window.document);
    const banner = dom.window.document.querySelector<HTMLElement>("[data-resume-banner]");
    const dismiss = dom.window.document.querySelector<HTMLElement>("[data-resume-dismiss]");
    assert.ok(banner, "banner present");
    assert.ok(dismiss, "dismiss button present");
    assert.equal(banner!.hidden, false);
    dismiss!.dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
    assert.equal(banner!.hidden, true, "banner must be hidden after dismiss click");
    assert.equal(openedUrl, null, "dismiss must NOT open import.html");
  } finally {
    (globalThis as { chrome?: unknown }).chrome = originalChrome;
  }
});

test("action button opens import.html", () => {
  const dom = new JSDOM(html, { url: "https://example.test/" });
  const originalChrome = (globalThis as { chrome?: unknown }).chrome;
  let openedUrl: string | null = null;
  (globalThis as { chrome?: unknown }).chrome = {
    tabs: { create: (opts: { url: string }) => { openedUrl = opts.url; } },
    runtime: { getURL: (p: string) => `chrome-extension://x/${p}` },
  };
  try {
    renderResumeBanner(dom.window.document, { phase: "fetching" } as unknown as Parameters<typeof renderResumeBanner>[1]);
    wireResumeBanner(dom.window.document);
    const action = dom.window.document.querySelector<HTMLElement>("[data-resume-action]");
    assert.ok(action, "action button present");
    action!.dispatchEvent(new dom.window.Event("click", { bubbles: true, cancelable: true }));
    assert.match(openedUrl ?? "", /import\.html$/);
  } finally {
    (globalThis as { chrome?: unknown }).chrome = originalChrome;
  }
});
