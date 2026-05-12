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

test("defaults premiumFree to false", () => {
  assert.equal(DEFAULT_SETTINGS.premiumFree, false);
});

test("cloneSettings preserves premiumFree", () => {
  const modified = { ...cloneSettings(DEFAULT_SETTINGS), premiumFree: true };
  const cloned = cloneSettings(modified);
  assert.equal(cloned.premiumFree, true);
});

test("mergeSettings merges premiumFree", () => {
  const merged = mergeSettings({ premiumFree: true });
  assert.equal(merged.premiumFree, true);

  const mergedDefault = mergeSettings({});
  assert.equal(mergedDefault.premiumFree, false);
});

test("mergeSettings migrates legacy hideBuyChapterBanner to premiumFree", () => {
  const merged = mergeSettings({ hideBuyChapterBanner: true });
  assert.equal(merged.premiumFree, true);
});

test("DEFAULT_SETTINGS exposes prefetch and progress toggles enabled by default", () => {
  assert.equal(DEFAULT_SETTINGS.prefetchNextChapter, true);
  assert.equal(DEFAULT_SETTINGS.showPremiumFreeProgress, true);
});

test("mergeSettings preserves new toggles when partial input omits them", () => {
  const merged = mergeSettings({ hideHeader: true });
  assert.equal(merged.prefetchNextChapter, true);
  assert.equal(merged.showPremiumFreeProgress, true);
});

test("mergeSettings respects explicit false for new toggles", () => {
  const merged = mergeSettings({
    prefetchNextChapter: false,
    showPremiumFreeProgress: false,
  });
  assert.equal(merged.prefetchNextChapter, false);
  assert.equal(merged.showPremiumFreeProgress, false);
});

test("cloneSettings copies new toggles", () => {
  const settings = mergeSettings({ prefetchNextChapter: false });
  const copy = cloneSettings(settings);
  assert.equal(copy.prefetchNextChapter, false);
  assert.equal(copy.showPremiumFreeProgress, true);
});

test("DEFAULT_SETTINGS exposes tightenChapterFeed enabled by default", () => {
  assert.equal(DEFAULT_SETTINGS.tightenChapterFeed, true);
});

test("mergeSettings respects explicit false for tightenChapterFeed", () => {
  const merged = mergeSettings({ tightenChapterFeed: false });
  assert.equal(merged.tightenChapterFeed, false);
});

test("cloneSettings copies tightenChapterFeed", () => {
  const settings = mergeSettings({ tightenChapterFeed: false });
  const copy = cloneSettings(settings);
  assert.equal(copy.tightenChapterFeed, false);
});

test("DEFAULT_SETTINGS exposes hideHeaderButtons with all keys defaulting to false", () => {
  assert.deepEqual(DEFAULT_SETTINGS.hideHeaderButtons, {
    logo: false,
    catalog: false,
    tops: false,
    forum: false,
    ellipsis: false,
    search: false,
    bookmarks: false,
    chat: false,
    notifications: false,
    avatar: false,
  });
});

test("DEFAULT_SETTINGS exposes hideHomeGameBanner defaulting to false", () => {
  assert.equal(DEFAULT_SETTINGS.hideHomeGameBanner, false);
});

test("DEFAULT_SETTINGS exposes hideHomePromoBanner defaulting to false", () => {
  assert.equal(DEFAULT_SETTINGS.hideHomePromoBanner, false);
});

test("mergeSettings respects explicit hideHomePromoBanner", () => {
  const merged = mergeSettings({ hideHomePromoBanner: true });
  assert.equal(merged.hideHomePromoBanner, true);

  const def = mergeSettings({});
  assert.equal(def.hideHomePromoBanner, false);
});

test("cloneSettings copies hideHomePromoBanner", () => {
  const settings = mergeSettings({ hideHomePromoBanner: true });
  const copy = cloneSettings(settings);
  assert.equal(copy.hideHomePromoBanner, true);
});

test("mergeSettings merges partial hideHeaderButtons overrides", () => {
  const merged = mergeSettings({
    hideHeaderButtons: { forum: true, chat: true },
  });
  assert.equal(merged.hideHeaderButtons.forum, true);
  assert.equal(merged.hideHeaderButtons.chat, true);
  assert.equal(merged.hideHeaderButtons.logo, false);
  assert.equal(merged.hideHeaderButtons.catalog, false);
});

test("mergeSettings respects explicit hideHomeGameBanner", () => {
  const merged = mergeSettings({ hideHomeGameBanner: true });
  assert.equal(merged.hideHomeGameBanner, true);

  const def = mergeSettings({});
  assert.equal(def.hideHomeGameBanner, false);
});

test("cloneSettings makes independent copy of hideHeaderButtons", () => {
  const original = mergeSettings({ hideHeaderButtons: { forum: true } });
  const copy = cloneSettings(original);
  assert.equal(copy.hideHeaderButtons.forum, true);
  copy.hideHeaderButtons.forum = false;
  assert.equal(original.hideHeaderButtons.forum, true);
});

test("DEFAULT_SETTINGS includes personalRecommendations defaulting to true", () => {
  assert.equal(DEFAULT_SETTINGS.personalRecommendations, true);
});

test("cloneSettings copies personalRecommendations", () => {
  const s = cloneSettings({ ...DEFAULT_SETTINGS, personalRecommendations: false });
  assert.equal(s.personalRecommendations, false);
});

test("mergeSettings falls back to default personalRecommendations", () => {
  const s = mergeSettings({});
  assert.equal(s.personalRecommendations, true);
});

test("mergeSettings uses provided personalRecommendations", () => {
  const s = mergeSettings({ personalRecommendations: false });
  assert.equal(s.personalRecommendations, false);
});
