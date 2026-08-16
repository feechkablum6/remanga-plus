import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const source = readFileSync(resolve("src/fullscreen-bridge.ts"), "utf8");

test("fullscreen bridge owns native fullscreen execution and reports denied requests", () => {
  assert.match(source, /from ["']\.\/fullscreen-controller(?:\.js)?["']/);
  assert.match(source, /FULLSCREEN_BRIDGE_ATTRIBUTE\s*=\s*["']data-rre-fullscreen-bridge["']/);
  assert.match(
    source,
    /setAttribute\(FULLSCREEN_BRIDGE_ATTRIBUTE,\s*["']1["']\)/,
  );
  assert.match(source, /["']pointerup["']/);
  assert.match(source, /["']click["']/);
  assert.match(source, /decideFullscreenAction\(/);
  assert.match(source, /lastFullscreenActionAt/);
  assert.match(source, /fullscreenTransitionInProgress/);
  assert.match(source, /document\.documentElement\.requestFullscreen\(\)/);
  assert.match(source, /document\.exitFullscreen\(\)/);
  assert.match(source, /data-rre-fullscreen-denied/);
  assert.match(source, /data-rre-fullscreen-denied-reason/);
  assert.match(source, /stopImmediatePropagation\(\)/);
  assert.match(source, /setAttribute\(FULLSCREEN_DENIED_REASON_ATTRIBUTE,\s*reason\)/);
  assert.match(
    source,
    /setAttribute\(FULLSCREEN_DENIED_ATTRIBUTE,\s*String\(Date\.now\(\)\)\)/,
  );
  assert.match(source, /resolvePseudoFullscreenAfterNativeSuccess\(/);
  assert.match(source, /resolvePseudoFullscreenAfterNativeDenial\(/);
  assert.match(source, /data-rre-fullscreen-denied-attempt/);
  assert.doesNotMatch(source, /rreFullscreenHandledAt/);
  assert.doesNotMatch(source, /\.catch\(\(\) => \{\}\)/);
});
