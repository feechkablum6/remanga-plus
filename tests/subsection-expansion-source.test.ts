import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("starts nested settings subsections collapsed and resets them after drawer close", () => {
  assert.match(
    readerEnhancerSource,
    /rightRailOptionsExpanded = false;\s*rightRailOptionsExpansionTouched = false;/,
  );
  assert.match(
    readerEnhancerSource,
    /settingsMenuOptionsExpanded = false;\s*settingsMenuOptionsExpansionTouched = false;/,
  );
  assert.match(
    readerEnhancerSource,
    /if \(!rightRailOptionsExpansionTouched\) \{\s*rightRailOptionsExpanded = false;/,
  );
  assert.match(
    readerEnhancerSource,
    /if \(!settingsMenuOptionsExpansionTouched\) \{\s*settingsMenuOptionsExpanded = false;/,
  );
});
