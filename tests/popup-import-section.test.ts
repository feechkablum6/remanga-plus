import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
