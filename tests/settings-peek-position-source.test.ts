import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("positions peek button at the original settings button location instead of zone center", () => {
  const syncFnMatch = readerEnhancerSource.match(
    /const syncSettingsPeekZone[\s\S]*?^};/m,
  );
  assert.ok(syncFnMatch, "syncSettingsPeekZone must exist");

  const syncFnBody = syncFnMatch[0];

  // The peek content position must be set dynamically from the settings button
  // or settings group position, not hardcoded at 50% center
  assert.match(
    syncFnBody,
    /getBoundingClientRect/,
    "must use getBoundingClientRect to calculate position from rail elements",
  );

  assert.match(
    syncFnBody,
    /content\.style\.top/,
    "must set content top position dynamically",
  );
});

test("peek content CSS must not hardcode top 50% center position", () => {
  const peekContentCssMatch = readerEnhancerSource.match(
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-content"\]\s*\{([^}]+)\}/,
  );
  assert.ok(peekContentCssMatch, "settings-peek-content CSS rule must exist");

  const cssBody = peekContentCssMatch[1];

  assert.doesNotMatch(
    cssBody,
    /top:\s*50%/,
    "peek content must not use hardcoded top: 50%",
  );

  assert.doesNotMatch(
    cssBody,
    /translateY\(-50%\)/,
    "peek content must not use center-aligning translateY(-50%)",
  );
});
