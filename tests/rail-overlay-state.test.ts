import assert from "node:assert/strict";
import test from "node:test";

import { getRailOverlayState } from "../src/rail-overlay-state.js";

test("keeps the native rail visible while hiding the minimized settings overlay", () => {
  assert.deepEqual(
    getRailOverlayState({
      isSettingsPanelOpen: true,
      hideRightRail: true,
      minimizeSettingsButton: true,
      hasRailContainer: true,
      hasSettingsButton: true,
    }),
    {
      hideRailContainer: false,
      showSettingsPeekZone: false,
    },
  );
});

test("keeps the minimized settings entry point when drawer is closed", () => {
  assert.deepEqual(
    getRailOverlayState({
      isSettingsPanelOpen: false,
      hideRightRail: true,
      minimizeSettingsButton: true,
      hasRailContainer: true,
      hasSettingsButton: true,
    }),
    {
      hideRailContainer: false,
      showSettingsPeekZone: true,
    },
  );
});
