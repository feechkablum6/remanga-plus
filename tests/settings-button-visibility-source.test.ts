import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("hides the original settings button whenever the minimize preset is active, regardless of panel state", () => {
  // The original button must be hidden consistently with the peek zone.
  // If it stayed visible while the settings panel is open, the peek button
  // and the original would overlap and the original would remain behind the
  // panel. The peek entry point is the single source of truth.
  const hideSettingsLine = readerEnhancerSource
    .split("\n")
    .find((line) => line.includes("const hideSettingsButton"));

  assert.ok(hideSettingsLine, "hideSettingsButton declaration must exist");

  assert.doesNotMatch(
    hideSettingsLine,
    /settingsPanel/,
    "hideSettingsButton must NOT depend on whether the settings panel is open",
  );

  assert.match(
    hideSettingsLine,
    /applyRightRailPreset\s*&&\s*settings\.minimizeSettingsButton/,
    "hideSettingsButton must be driven purely by rail preset + minimize flag",
  );
});
