import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

const manifest = JSON.parse(
  readFileSync(path.resolve(process.cwd(), "public/manifest.json"), "utf8"),
);

test("manifest declares default_popup", () => {
  assert.equal(manifest.action.default_popup, "popup.html");
});
