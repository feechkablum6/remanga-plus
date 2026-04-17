import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

const syncFnBody = (() => {
  const match = readerEnhancerSource.match(
    /const syncSettingsPeekZone[\s\S]*?^};/m,
  );
  assert.ok(match, "syncSettingsPeekZone must exist");
  return match[0];
})();

test("peek content gets an explicit height so hover covers the rail area, not just the button bounds", () => {
  assert.match(
    syncFnBody,
    /content\.style\.height\s*=/,
    "peek content height must be set so hover region is larger than the button itself",
  );
});

test("peek content gets an explicit width spanning the zone so hover works along the rail edge", () => {
  assert.match(
    syncFnBody,
    /content\.style\.width\s*=/,
    "peek content width must be set explicitly so hover area reaches the zone edges",
  );
});

test("peek content keeps button at its natural size via align-items flex-start", () => {
  const peekContentCssMatch = readerEnhancerSource.match(
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-content"\]\s*\{([^}]+)\}/,
  );
  assert.ok(peekContentCssMatch, "settings-peek-content CSS rule must exist");

  const cssBody = peekContentCssMatch[1];

  assert.match(
    cssBody,
    /align-items:\s*flex-start/,
    "peek content must align children to flex-start so the button doesn't stretch inside an enlarged hover box",
  );
});
