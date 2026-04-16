import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("peek button uses full circular border-radius matching the original toolbar button", () => {
  // Extract the settings-peek-button CSS rule
  const peekButtonCssMatch = readerEnhancerSource.match(
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-button"\]\s*\{([^}]+)\}/,
  );
  assert.ok(peekButtonCssMatch, "settings-peek-button CSS rule must exist");

  const cssBody = peekButtonCssMatch[1];

  // Must NOT have a half-circle border-radius (0 on the right side)
  assert.doesNotMatch(
    cssBody,
    /border-radius:\s*9999px 0 0 9999px/,
    "peek button must not use half-circle border-radius",
  );
});

test("peek button preserves the original button inner structure instead of bare SVG", () => {
  // The syncSettingsPeekZone function must NOT replace children with just
  // createSettingsIcon (bare SVG). It should preserve the full inner content
  // cloned from the original button to retain the circular background wrapper.
  const syncFnMatch = readerEnhancerSource.match(
    /const syncSettingsPeekZone[\s\S]*?^};/m,
  );
  assert.ok(syncFnMatch, "syncSettingsPeekZone must exist");

  const syncFnBody = syncFnMatch[0];

  assert.doesNotMatch(
    syncFnBody,
    /button\.replaceChildren\(createSettingsIcon\(/,
    "peek button must not replace children with bare SVG icon",
  );
});
