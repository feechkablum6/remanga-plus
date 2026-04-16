import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("syncRightRailGroups does not revive wrappers explicitly hidden via motion", () => {
  // Root cause of the settings-button duplication: syncRightRailGroups walks
  // rail children and unconditionally calls markHidden(child, !emptyInside).
  // When we hide the settings group via finalizeMotionVisibility — which
  // marks the wrapper with data-rre-motion-target-hidden="true" but leaves
  // the inner button unmarked — the heuristic saw a "visible" button inside
  // and called markHidden(group, false), reviving the group.
  //
  // The fix: before unhiding a wrapper, respect an explicit
  // MOTION_TARGET_HIDDEN_ATTRIBUTE="true". That attribute is the signal
  // from finalize/syncMotion code paths that the wrapper must stay hidden.
  const fnMatch = readerEnhancerSource.match(
    /const syncRightRailGroups[\s\S]*?^};/m,
  );
  assert.ok(fnMatch, "syncRightRailGroups must exist");

  const body = fnMatch[0];

  assert.match(
    body,
    /MOTION_TARGET_HIDDEN_ATTRIBUTE/,
    "syncRightRailGroups must consult the explicit motion-target-hidden marker",
  );
});
