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
  assert.match(
    contentSource,
    /const requestSettingsPanelSettledRefresh = \(\) => \{\s*clearSettledRefreshes\(\);\s*\[120,\s*280\]\.forEach\(scheduleSettledRefresh\);\s*\};/,
  );
});

test("routes settings drawer childList mutations through the fast settings refresh path and transition attributes through settled-only refresh", () => {
  assert.match(
    contentSource,
    /if \(mutations\.some\(shouldRequestImmediateSettingsPanelRefreshForMutation\)\) \{\s*requestSettingsPanelRefresh\(\);\s*return;\s*\}/,
  );
  assert.match(
    contentSource,
    /if \(mutations\.some\(shouldRequestSettledSettingsPanelRefreshForMutation\)\) \{\s*requestSettingsPanelSettledRefresh\(\);\s*return;\s*\}/,
  );
  assert.match(
    contentSource,
    /function shouldRequestImmediateSettingsPanelRefreshForMutation\(\s*mutation: MutationRecord,\s*\): boolean \{/,
  );
  assert.match(
    contentSource,
    /function shouldRequestSettledSettingsPanelRefreshForMutation\(\s*mutation: MutationRecord,\s*\): boolean \{/,
  );
});

test("ignores RRE-owned settings controls when watching panel aria mutations", () => {
  assert.match(
    contentSource,
    /if \(target\.closest\(`\[\$\{CONTROL_ATTRIBUTE\}\]`\)\) \{\s*return false;\s*\}/,
  );
});
