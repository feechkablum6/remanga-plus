import assert from "node:assert/strict";
import test from "node:test";

import {
  SETTINGS_MENU_ITEMS,
  matchSettingsMenuItemKey,
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

test("matches exact normalized labels to their settings menu item keys", () => {
  assert.equal(matchSettingsMenuItemKey("Настройка изображения"), "imageSettings");
  assert.equal(matchSettingsMenuItemKey("Настройка горячих клавиш"), "hotkeys");
  assert.equal(matchSettingsMenuItemKey("Настройка горячих клавишь"), "hotkeys");
  assert.equal(matchSettingsMenuItemKey("Настройка скролла"), "scrollSettings");
  assert.equal(matchSettingsMenuItemKey("Другие настройки"), "otherSettings");
  assert.equal(matchSettingsMenuItemKey("Тип читалки"), "readerType");
  assert.equal(
    matchSettingsMenuItemKey("Отображение индикатора номера страницы"),
    "pageIndicator",
  );
  assert.equal(
    matchSettingsMenuItemKey("Отображение индикатора номера страниц"),
    "pageIndicator",
  );
  assert.equal(matchSettingsMenuItemKey("Показывать заметки"), "notes");
});

test("ignores unrelated labels", () => {
  assert.equal(matchSettingsMenuItemKey("Автоподгрузка следующей главы"), null);
  assert.equal(matchSettingsMenuItemKey("Настройки читалки"), null);
});

test("matches aliases for known settings menu items", () => {
  assert.equal(matchesSettingsMenuItemText("hotkeys", "Настройка горячих клавишь"), true);
  assert.equal(
    matchesSettingsMenuItemText("pageIndicator", "Отображение индикатора номера страниц"),
    true,
  );
});
