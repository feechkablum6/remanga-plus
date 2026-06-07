import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_KEYS,
  CATEGORIES,
  countCategoryToggles,
  cycleRecTypeState,
  applyRecTypeChange,
  readToggleValue,
  applyToggleChange,
  type CategoryKey,
} from "../src/popup-categories.js";
import { DEFAULT_SETTINGS, cloneSettings } from "../src/settings.js";

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

test("Сайт has 19 toggles", () => {
  assert.equal(countCategoryToggles("site"), 19);
});

test("Читалка has 8 toggles (5 visual + 3 popup auto-dismiss)", () => {
  assert.equal(countCategoryToggles("reader"), 8);
});

test("Premium Free has 14 toggles (4 core + 3 rec-type + 7 providers)", () => {
  assert.equal(countCategoryToggles("premium-free"), 14);
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

test("Premium Free toggles: core → rec-type → providers", () => {
  const labels = CATEGORIES["premium-free"].toggles.map((t) => t.label);
  assert.deepEqual(labels.slice(0, 7), [
    "Premium Free режим",
    "Префетч следующей главы",
    "Показывать прогресс загрузки",
    "Персональные рекомендации",
    "Манга",
    "Манхва",
    "Маньхуа",
  ]);
  // Providers follow rec-type
  assert.ok(labels.includes("Mangabuff"));
  assert.ok(labels.includes("WaManga"));
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

test("premium-free toggles include personalRecommendations", () => {
  const toggles = CATEGORIES["premium-free"].toggles;
  const rec = toggles.find(t => t.label === "Персональные рекомендации");
  assert.ok(rec, "toggle not found");
  assert.deepEqual(rec?.accessor, { kind: "scalar", key: "personalRecommendations" });
});

test("rec-type toggles sit in recTypeFilter collapsible group", () => {
  const toggles = CATEGORIES["premium-free"].toggles;
  for (const label of ["Манга", "Манхва", "Маньхуа"]) {
    const t = toggles.find((x) => x.label === label);
    assert.ok(t, `missing toggle: ${label}`);
    assert.equal(t?.collapsibleGroup, "recTypeFilter");
    assert.equal(t?.accessor.kind, "rec-type");
  }
});

test("cycleRecTypeState cycles neutral → priority → excluded → neutral", () => {
  assert.equal(cycleRecTypeState("neutral"), "priority");
  assert.equal(cycleRecTypeState("priority"), "excluded");
  assert.equal(cycleRecTypeState("excluded"), "neutral");
});

test("applyRecTypeChange updates exactly one key in recommendationTypePreferences", () => {
  const s = applyRecTypeChange(DEFAULT_SETTINGS, "manga", "priority");
  assert.equal(s.recommendationTypePreferences.manga, "priority");
  assert.equal(s.recommendationTypePreferences.manhwa, "neutral");
  assert.equal(s.recommendationTypePreferences.manhua, "neutral");
  // Original is not mutated
  assert.equal(DEFAULT_SETTINGS.recommendationTypePreferences.manga, "neutral");
});

test("rec-type toggle is not a checkbox (readToggleValue always true)", () => {
  const toggles = CATEGORIES["premium-free"].toggles;
  const manga = toggles.find((t) => t.label === "Манга")!;
  assert.equal(readToggleValue(DEFAULT_SETTINGS, manga), true);
  const excluded = applyRecTypeChange(DEFAULT_SETTINGS, "manga", "excluded");
  assert.equal(readToggleValue(excluded, manga), false);
});

test("rec-type accessor is no-op in applyToggleChange (checkbox path)", () => {
  const toggles = CATEGORIES["premium-free"].toggles;
  const manga = toggles.find((t) => t.label === "Манга")!;
  const result = applyToggleChange(DEFAULT_SETTINGS, manga, false);
  // Should return same settings (no change via checkbox path)
  assert.equal(result.recommendationTypePreferences.manga, "neutral");
});
