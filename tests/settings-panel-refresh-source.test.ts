import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const contentSource = readFileSync(path.resolve(process.cwd(), "src/content.ts"), "utf8");

test("runs an immediate settings refresh and keeps separate settled follow-up refreshes", () => {
  assert.match(
    contentSource,
    /const scheduleSettledRefresh = \(delay: number\) => \{/,
  );
  assert.match(
    contentSource,
    /const requestImmediateRefresh = \(\) => \{\s*window\.clearTimeout\(refreshHandle\);\s*runRefresh\(\);\s*\};/,
  );
  assert.match(
    contentSource,
    /const requestSettingsPanelRefresh = \(\) => \{\s*clearSettledRefreshes\(\);\s*requestImmediateRefresh\(\);\s*\[120,\s*280\]\.forEach\(scheduleSettledRefresh\);\s*\};/,
  );
});

test("routes settings drawer childList mutations through the fast settings refresh path", () => {
  assert.match(
    contentSource,
    /if \(mutations\.some\(shouldRequestSettingsPanelRefreshForMutation\)\) \{\s*requestSettingsPanelRefresh\(\);\s*return;\s*\}/,
  );
  assert.match(
    contentSource,
    /function shouldRequestSettingsPanelRefreshForMutation\(mutation: MutationRecord\): boolean \{/,
  );
});
