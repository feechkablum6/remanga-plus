import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const settingsSource = readFileSync(path.resolve(root, "src/settings.ts"), "utf8");
const readerEnhancerSource = readFileSync(
  path.resolve(root, "src/reader-enhancer.ts"),
  "utf8",
);
const contentSource = readFileSync(path.resolve(root, "src/content.ts"), "utf8");

test("settings.ts no longer exposes the minimizeSettingsButton toggle", () => {
  assert.doesNotMatch(
    settingsSource,
    /minimizeSettingsButton/,
    "minimizeSettingsButton must be removed from the settings contract",
  );
});

test("reader-enhancer.ts has no references to the settings-peek DOM or helpers", () => {
  const forbidden = [
    /minimizeSettingsButton/,
    /syncSettingsPeekZone/,
    /openHiddenSettingsButton/,
    /settings-peek-zone/,
    /settings-peek-content/,
    /settings-peek-button/,
  ];

  for (const pattern of forbidden) {
    assert.doesNotMatch(
      readerEnhancerSource,
      pattern,
      `reader-enhancer.ts must not reference ${pattern}`,
    );
  }
});

test("content.ts does not special-case the settings-peek-button click target anymore", () => {
  assert.doesNotMatch(
    contentSource,
    /settings-peek-button/,
    "content.ts click handler must no longer treat settings-peek-button specially",
  );
});
