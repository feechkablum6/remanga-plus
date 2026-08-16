import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("mounts the custom fullscreen rail button outside the shared settings button group", () => {
  assert.match(
    readerEnhancerSource,
    /const syncMainFullscreenButton = \(readerDom: ReaderDom\): void => \{/,
  );
  assert.match(
    readerEnhancerSource,
    /settingsGroup\.before\(fullscreenButton\);/,
  );
});

test("delegates fullscreen to the MAIN bridge and keeps a native fallback", () => {
  assert.match(readerEnhancerSource, /from ["']\.\/fullscreen-controller["']/);
  assert.match(readerEnhancerSource, /button\.onclick = handleFullscreenButtonClick;/);
  assert.match(readerEnhancerSource, /button\.onpointerup = handleFullscreenButtonClick;/);
  assert.match(
    readerEnhancerSource,
    /FULLSCREEN_BRIDGE_ATTRIBUTE\s*=\s*["']data-rre-fullscreen-bridge["']/,
  );
  const bridgeGuardIndex = readerEnhancerSource.indexOf(
    'getAttribute(FULLSCREEN_BRIDGE_ATTRIBUTE) === "1"',
  );
  const fallbackRequestIndex = readerEnhancerSource.indexOf(
    "document.documentElement.requestFullscreen()",
    bridgeGuardIndex,
  );
  assert.ok(bridgeGuardIndex >= 0);
  assert.ok(fallbackRequestIndex > bridgeGuardIndex);
  assert.match(readerEnhancerSource, /document\.exitFullscreen\(\)/);
  assert.match(readerEnhancerSource, /new MutationObserver\(/);
  assert.match(
    readerEnhancerSource,
    /FULLSCREEN_DENIED_ATTRIBUTE\s*=\s*["']data-rre-fullscreen-denied["']/,
  );
  assert.match(
    readerEnhancerSource,
    /attributeFilter:\s*\[FULLSCREEN_DENIED_ATTRIBUTE\]/,
  );
  assert.match(readerEnhancerSource, /data-rre-fullscreen-denied-reason/);
  assert.match(readerEnhancerSource, /data-rre-fullscreen-denied-attempt/);
  assert.match(readerEnhancerSource, /resolvePseudoFullscreenAfterNativeDenial\(/);
  assert.match(readerEnhancerSource, /document\.addEventListener\(["']fullscreenchange["']/);
  assert.match(
    readerEnhancerSource,
    /fullscreenchange[\s\S]*?setPseudoFullscreen\(false\)/,
  );
  assert.match(readerEnhancerSource, /resolvePseudoFullscreenAfterNativeSuccess\(/);
  assert.match(readerEnhancerSource, /handleFullscreenDeniedSignal\(\)/);
  assert.doesNotMatch(readerEnhancerSource, /rreFullscreenHandledAt/);
  assert.doesNotMatch(readerEnhancerSource, /createObjectURL\(blob\)/);
});
