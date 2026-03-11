import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SETTINGS,
  cloneSettings,
  mergeSettings,
} from "../src/settings.js";

test("defaults the settings menu enhancement preset to disabled", () => {
  assert.equal(DEFAULT_SETTINGS.enhanceSettingsMenu, false);
});

test("defaults the additional settings section to expanded", () => {
  assert.equal(DEFAULT_SETTINGS.isAdditionalSettingsExpanded, true);
});

test("defaults all nested settings menu items to hidden when the preset is enabled", () => {
  assert.deepEqual(DEFAULT_SETTINGS.hideSettingsMenuItems, {
    imageSettings: true,
    hotkeys: true,
    scrollSettings: true,
    otherSettings: true,
    readerType: true,
    pageIndicator: true,
    notes: true,
  });
});

test("cloneSettings preserves the settings menu enhancement fields", () => {
  const cloned = cloneSettings(DEFAULT_SETTINGS);

  assert.equal(cloned.enhanceSettingsMenu, DEFAULT_SETTINGS.enhanceSettingsMenu);
  assert.equal(
    cloned.isAdditionalSettingsExpanded,
    DEFAULT_SETTINGS.isAdditionalSettingsExpanded,
  );
  assert.deepEqual(cloned.hideSettingsMenuItems, DEFAULT_SETTINGS.hideSettingsMenuItems);
  assert.notEqual(cloned.hideSettingsMenuItems, DEFAULT_SETTINGS.hideSettingsMenuItems);
});

test("mergeSettings merges partial settings menu item overrides", () => {
  const merged = mergeSettings({
    enhanceSettingsMenu: true,
    isAdditionalSettingsExpanded: false,
    hideSettingsMenuItems: {
      hotkeys: false,
      notes: false,
    },
  });

  assert.equal(merged.enhanceSettingsMenu, true);
  assert.equal(merged.isAdditionalSettingsExpanded, false);
  assert.deepEqual(merged.hideSettingsMenuItems, {
    imageSettings: true,
    hotkeys: false,
    scrollSettings: true,
    otherSettings: true,
    readerType: true,
    pageIndicator: true,
    notes: false,
  });
});
