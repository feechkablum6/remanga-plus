import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES,
  readToggleValue,
  applyToggleChange,
  getReaderDrawerToggles,
  type ToggleDescriptor,
} from "../src/popup-categories.js";
import { DEFAULT_SETTINGS, cloneSettings } from "../src/settings.js";

test("readToggleValue handles scalar accessor", () => {
  const s = cloneSettings(DEFAULT_SETTINGS);
  s.hideHeader = true;
  const toggle: ToggleDescriptor = {
    label: "x",
    accessor: { kind: "scalar", key: "hideHeader" },
  };
  assert.equal(readToggleValue(s, toggle), true);
});

test("readToggleValue handles header-button accessor", () => {
  const s = cloneSettings(DEFAULT_SETTINGS);
  s.hideHeaderButtons.logo = true;
  const toggle: ToggleDescriptor = {
    label: "x",
    accessor: { kind: "header-button", key: "logo" },
  };
  assert.equal(readToggleValue(s, toggle), true);
});

test("readToggleValue handles popup accessor", () => {
  const s = cloneSettings(DEFAULT_SETTINGS);
  s.hidePopups.hints = true;
  const toggle: ToggleDescriptor = {
    label: "x",
    accessor: { kind: "popup", key: "hints" },
  };
  assert.equal(readToggleValue(s, toggle), true);
});

test("applyToggleChange returns new object for scalar without mutating input", () => {
  const s = cloneSettings(DEFAULT_SETTINGS);
  const toggle: ToggleDescriptor = {
    label: "x",
    accessor: { kind: "scalar", key: "hideHeader" },
  };
  const next = applyToggleChange(s, toggle, true);
  assert.equal(next.hideHeader, true);
  assert.equal(s.hideHeader, false, "input must not be mutated");
  assert.notEqual(next, s);
});

test("applyToggleChange sets popup nested key without mutating input", () => {
  const s = cloneSettings(DEFAULT_SETTINGS);
  const toggle: ToggleDescriptor = {
    label: "x",
    accessor: { kind: "popup", key: "giftsPromo" },
  };
  const next = applyToggleChange(s, toggle, true);
  assert.equal(next.hidePopups.giftsPromo, true);
  assert.equal(s.hidePopups.giftsPromo, false, "input must not be mutated");
  assert.notEqual(next.hidePopups, s.hidePopups);
});

test("applyToggleChange sets header-button nested key without mutating input", () => {
  const s = cloneSettings(DEFAULT_SETTINGS);
  const toggle: ToggleDescriptor = {
    label: "x",
    accessor: { kind: "header-button", key: "search" },
  };
  const next = applyToggleChange(s, toggle, true);
  assert.equal(next.hideHeaderButtons.search, true);
  assert.equal(s.hideHeaderButtons.search, false);
});

test("getReaderDrawerToggles concatenates reader + premium-free in display order", () => {
  const drawer = getReaderDrawerToggles();
  const expected = [
    ...CATEGORIES.reader.toggles,
    ...CATEGORIES["premium-free"].toggles,
  ];
  assert.deepEqual(
    drawer.map((t) => t.label),
    expected.map((t) => t.label),
  );
});

test("getReaderDrawerToggles covers all reader-related settings keys", () => {
  const drawer = getReaderDrawerToggles();
  const scalarKeys = drawer
    .filter((t) => t.accessor.kind === "scalar")
    .map((t) => (t.accessor.kind === "scalar" ? t.accessor.key : ""));
  for (const required of [
    "hideHeader",
    "hideRightRail",
    "enhanceSettingsMenu",
    "hideCommentsSection",
    "tightenChapterFeed",
    "premiumFree",
    "prefetchNextChapter",
    "showPremiumFreeProgress",
  ] as const) {
    assert.ok(scalarKeys.includes(required), `missing scalar toggle: ${required}`);
  }
  const popupKeys = drawer
    .filter((t) => t.accessor.kind === "popup")
    .map((t) => (t.accessor.kind === "popup" ? t.accessor.key : ""));
  assert.deepEqual(popupKeys.sort(), ["giftsPromo", "hints", "otherNonBlocking"]);
});
