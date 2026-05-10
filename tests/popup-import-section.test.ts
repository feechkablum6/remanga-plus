import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("public/popup.html"), "utf8");
const ts = readFileSync(resolve("src/popup.ts"), "utf8");

test("popup.html exposes import section with auth status hooks", () => {
  for (const hook of [
    "data-import-section",
    "data-auth-mangalib",
    "data-auth-remanga",
    "data-import-button",
    "data-resume-banner",
  ]) {
    assert.match(html, new RegExp(hook), `missing ${hook}`);
  }
});

test("popup.ts wires import section", () => {
  assert.match(ts, /CHECK_AUTH_MESSAGE_TYPE/);
  assert.match(ts, /chrome\.tabs\.create/);
  assert.match(ts, /import\.html/);
});
