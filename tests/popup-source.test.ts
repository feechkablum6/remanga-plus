import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const popupSource = readFileSync(resolve(here, "../src/popup.ts"), "utf8");

const HEADER_LABELS: ReadonlyArray<[string, string]> = [
  ["logo", "Логотип"],
  ["catalog", "Каталог"],
  ["tops", "Топы"],
  ["forum", "Форум"],
  ["ellipsis", "Троеточие"],
  ["search", "Поиск"],
  ["bookmarks", "Закладки"],
  ["chat", "Чат"],
  ["notifications", "Уведомления"],
  ["avatar", "Профиль"],
];

for (const [key, label] of HEADER_LABELS) {
  test(`popup.ts references HeaderButtonKey "${key}" with label "${label}"`, () => {
    assert.match(popupSource, new RegExp(`["']${key}["']`));
    assert.match(popupSource, new RegExp(label));
  });
}

test("popup.ts wires hideHomeGameBanner toggle", () => {
  assert.match(popupSource, /hideHomeGameBanner/);
  assert.match(popupSource, /Скрыть\s+баннер\s+игры/i);
});

test("popup.ts wires restart button to RESTART_PARSER_SERVER_MESSAGE_TYPE", () => {
  assert.match(popupSource, /RESTART_PARSER_SERVER_MESSAGE_TYPE/);
  assert.match(popupSource, /data-action=["']restart-parser["']/);
});
