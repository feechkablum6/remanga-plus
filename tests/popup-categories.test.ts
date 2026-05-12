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

test("site toggles include personalRecommendations, filterHomeBookmarks, and bookmark categories", () => {
  assert.ok(countCategoryToggles("site") >= 13);
});

test("Читалка has 8 toggles (5 visual + 3 popup auto-dismiss)", () => {
  assert.equal(countCategoryToggles("reader"), 8);
});

test("Premium Free has 3 toggles (режим + префетч + прогресс)", () => {
  assert.equal(countCategoryToggles("premium-free"), 3);
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

test("Сайт includes 'Скрыть промо-плашку Telegram' as a separate toggle", () => {
  const labels = CATEGORIES.site.toggles.map((t) => t.label);
  assert.ok(labels.includes("Скрыть промо-плашку Telegram"));
});

test("Сайт toggles are split into two subsections", () => {
  const subsections = new Set(CATEGORIES.site.toggles.map((t) => t.subsection));
  const sorted = [...subsections].sort();
  assert.deepEqual(sorted, ["ГЛАВНАЯ СТРАНИЦА", "КНОПКИ ШАПКИ"]);
});

test("Читалка toggles match the 8 spec labels in display order", () => {
  const labels = CATEGORIES.reader.toggles.map((t) => t.label);
  assert.deepEqual(labels, [
    "Скрыть шапку сайта в читалке",
    "Скрыть правую панель",
    "Улучшить меню настроек",
    "Скрыть комментарии",
    "Плотный фид глав",
    "Авто-скрывать подсказки",
    "Авто-скрывать подарки и промо",
    "Авто-скрывать прочие всплывающие окна",
  ]);
});

test("Premium Free toggles are: режим + префетч + прогресс", () => {
  const labels = CATEGORIES["premium-free"].toggles.map((t) => t.label);
  assert.deepEqual(labels, [
    "Premium Free режим",
    "Префетч следующей главы",
    "Показывать прогресс загрузки",
  ]);
});

test("Premium Free 'режим' toggle has a caption from spec", () => {
  const main = CATEGORIES["premium-free"].toggles[0];
  assert.equal(main.caption, "Бесплатный доступ к платным главам");
});

test("Auto-dismiss toggles in Читалка sit under АВТО-СКРЫТИЯ subsection", () => {
  const autoDismiss = CATEGORIES.reader.toggles.filter((t) =>
    t.label.startsWith("Авто-скрывать"),
  );
  assert.equal(autoDismiss.length, 3);
  for (const toggle of autoDismiss) {
    assert.equal(toggle.subsection, "АВТО-СКРЫТИЯ");
  }
});

test("Auto-dismiss toggles use popup-kind accessor with correct keys", () => {
  const byLabel = new Map(CATEGORIES.reader.toggles.map((t) => [t.label, t]));
  const cases: Array<[string, "hints" | "giftsPromo" | "otherNonBlocking"]> = [
    ["Авто-скрывать подсказки", "hints"],
    ["Авто-скрывать подарки и промо", "giftsPromo"],
    ["Авто-скрывать прочие всплывающие окна", "otherNonBlocking"],
  ];
  for (const [label, key] of cases) {
    const toggle = byLabel.get(label);
    assert.ok(toggle, `missing toggle: ${label}`);
    assert.equal(toggle.accessor.kind, "popup");
    if (toggle.accessor.kind === "popup") {
      assert.equal(toggle.accessor.key, key);
    }
  }
});

test("Premium Free 'прогресс' toggle wired to showPremiumFreeProgress", () => {
  const toggle = CATEGORIES["premium-free"].toggles.find(
    (t) => t.label === "Показывать прогресс загрузки",
  );
  assert.ok(toggle);
  assert.equal(toggle.accessor.kind, "scalar");
  if (toggle.accessor.kind === "scalar") {
    assert.equal(toggle.accessor.key, "showPremiumFreeProgress");
  }
});

test("site toggles include personalRecommendations under ГЛАВНАЯ СТРАНИЦА", () => {
  const toggles = CATEGORIES.site.toggles;
  const rec = toggles.find(t => t.label === "Персональные рекомендации");
  assert.ok(rec, "toggle not found");
  assert.deepEqual(rec?.accessor, { kind: "scalar", key: "personalRecommendations" });
  assert.equal(rec?.subsection, "ГЛАВНАЯ СТРАНИЦА");
});
