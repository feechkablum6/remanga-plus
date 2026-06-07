import assert from "node:assert/strict";
import test from "node:test";

import {
  SETTINGS_MENU_ITEMS,
  matchesSettingsMenuItemText,
} from "../src/settings-menu-items.js";

test("defines all supported native settings menu items", () => {
  assert.deepEqual(Object.keys(SETTINGS_MENU_ITEMS), [
    "imageSettings",
    "hotkeys",
    "scrollSettings",
    "otherSettings",
    "readerType",
    "pageIndicator",
    "notes",
  ]);
});

test("matches aliases for known settings menu items", () => {
  assert.equal(matchesSettingsMenuItemText("hotkeys", "Настройка горячих клавишь"), true);
  assert.equal(
    matchesSettingsMenuItemText("pageIndicator", "Отображение индикатора номера страниц"),
    true,
  );
});
