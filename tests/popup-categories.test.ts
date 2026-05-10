import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_KEYS,
  CATEGORIES,
  countCategoryToggles,
  type CategoryKey,
} from "../src/popup-categories.js";

test("CATEGORY_KEYS lists exactly three categories in display order", () => {
  assert.deepEqual(CATEGORY_KEYS, ["site", "reader", "premium-free"]);
});

test("each category has a label and an icon name", () => {
  for (const key of CATEGORY_KEYS) {
    const meta = CATEGORIES[key];
    assert.ok(typeof meta.label === "string" && meta.label.length > 0, `${key}.label`);
    assert.ok(typeof meta.icon === "string" && meta.icon.length > 0, `${key}.icon`);
  }
});

test("category labels match spec", () => {
  assert.equal(CATEGORIES.site.label, "Сайт");
  assert.equal(CATEGORIES.reader.label, "Читалка");
  assert.equal(CATEGORIES["premium-free"].label, "Premium Free");
});

test("Сайт has 11 toggles (10 header buttons + 1 home banner)", () => {
  assert.equal(countCategoryToggles("site"), 11);
});

test("Читалка has 6 toggles", () => {
  assert.equal(countCategoryToggles("reader"), 6);
});

test("Premium Free has 2 toggles (no show-progress)", () => {
  assert.equal(countCategoryToggles("premium-free"), 2);
});

test("Сайт toggles include all 10 header button keys with Russian labels", () => {
  const labels = CATEGORIES.site.toggles.map((t) => t.label);
  for (const expected of ["Логотип", "Каталог", "Топы", "Форум", "Троеточие", "Поиск", "Закладки", "Чат", "Уведомления", "Профиль"]) {
    assert.ok(labels.includes(expected), `missing toggle: ${expected}`);
  }
});

test("Сайт includes 'Скрыть баннер игры' as a separate toggle", () => {
  const labels = CATEGORIES.site.toggles.map((t) => t.label);
  assert.ok(labels.includes("Скрыть баннер игры"));
});

test("Сайт toggles are split into two subsections", () => {
  const subsections = new Set(CATEGORIES.site.toggles.map((t) => t.subsection));
  const sorted = [...subsections].sort();
  assert.deepEqual(sorted, ["ГЛАВНАЯ СТРАНИЦА", "КНОПКИ ШАПКИ"]);
});

test("Читалка toggles match the 6 spec labels", () => {
  const labels = CATEGORIES.reader.toggles.map((t) => t.label);
  assert.deepEqual(labels, [
    "Скрыть шапку сайта в читалке",
    "Скрыть правую панель",
    "Скрыть счётчик страниц",
    "Улучшить меню настроек",
    "Скрыть комментарии",
    "Плотный фид глав",
  ]);
});

test("Premium Free toggles are exactly: режим + префетч", () => {
  const labels = CATEGORIES["premium-free"].toggles.map((t) => t.label);
  assert.deepEqual(labels, ["Premium Free режим", "Префетч следующей главы"]);
});

test("Premium Free 'режим' toggle has a caption from spec", () => {
  const main = CATEGORIES["premium-free"].toggles[0];
  assert.equal(main.caption, "Бесплатный доступ к платным главам");
});

test("show-progress is NOT in any toggle list", () => {
  for (const key of CATEGORY_KEYS) {
    for (const toggle of CATEGORIES[key].toggles) {
      assert.ok(
        !toggle.label.toLowerCase().includes("прогресс"),
        `unexpected 'прогресс' in toggle: ${toggle.label}`,
      );
    }
  }
});
