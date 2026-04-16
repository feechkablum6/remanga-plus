import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("openHiddenSettingsButton does not re-hide the motion target after clicking", () => {
  const fnMatch = readerEnhancerSource.match(
    /const openHiddenSettingsButton[\s\S]*?^};/m,
  );
  assert.ok(fnMatch, "openHiddenSettingsButton must exist");

  const fnBody = fnMatch[0];

  // Must not call markHidden(target, true) inside requestAnimationFrame,
  // because applyVisibilitySettings now handles visibility correctly
  // and re-hiding would kill the motion animation.
  assert.doesNotMatch(
    fnBody,
    /markHidden\(settingsMotionTarget,\s*wasHidden\)/,
    "must not re-hide motion target — applyVisibilitySettings handles visibility",
  );
});
