import assert from "node:assert/strict";
import test from "node:test";

import { shouldScheduleSettledRefresh } from "../src/settings-panel-transition.js";

test("schedules a settled refresh for settings panel attribute transitions", () => {
  assert.equal(
    shouldScheduleSettledRefresh({
      mutationType: "attributes",
      attributeName: "class",
      targetMatchesSettingsPanel: true,
      targetText: "Настройки читалки Тип читалки",
    }),
    true,
  );
});

test("ignores unrelated mutations", () => {
  assert.equal(
    shouldScheduleSettledRefresh({
      mutationType: "attributes",
      attributeName: "class",
      targetMatchesSettingsPanel: false,
      targetText: "Настройки читалки Тип читалки",
    }),
    false,
  );

  assert.equal(
    shouldScheduleSettledRefresh({
      mutationType: "childList",
      attributeName: null,
      targetMatchesSettingsPanel: true,
      targetText: "Настройки читалки Тип читалки",
    }),
    false,
  );

  assert.equal(
    shouldScheduleSettledRefresh({
      mutationType: "attributes",
      attributeName: "class",
      targetMatchesSettingsPanel: true,
      targetText: "Другой drawer",
    }),
    false,
  );
});
