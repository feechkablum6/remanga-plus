import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("public/import.html"), "utf8");

test("import.html loads import.js", () => {
  assert.match(html, /src=["']import\.js["']/);
});

test("import.html exposes data-* hooks", () => {
  for (const hook of [
    "data-auth-status",
    "data-progress-fetch",
    "data-progress-match",
    "data-progress-execute",
    "data-preview-table",
    "data-execute-button",
    "data-report",
  ]) {
    assert.match(html, new RegExp(hook), `missing ${hook}`);
  }
});
