import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("instantly finalizes settings button visibility in minimize mode", () => {
  // When minimizeSettingsButton is on, the peek zone handles the visual
  // entry point. The original button must be finalized instantly (no
  // slide-right animation) to avoid flash when switching between
  // peek button and original button on settings open/close.
  const fnMatch = readerEnhancerSource.match(
    /const applyVisibilitySettings[\s\S]*?^};/m,
  );
  assert.ok(fnMatch, "applyVisibilitySettings must exist");

  const fnBody = fnMatch[0];

  // Must use finalizeMotionVisibility for both show and hide
  // when minimizeSettingsButton is enabled
  assert.match(
    fnBody,
    /settings\.minimizeSettingsButton && settingsMotionTarget[\s\S]*finalizeMotionVisibility\(settingsMotionTarget,\s*hideSettingsButton/,
    "must use finalizeMotionVisibility with hideSettingsButton in minimize mode",
  );
});
