import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("keeps a partially visible settings gear peeking from the right edge", () => {
  assert.match(
    readerEnhancerSource,
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-button"\]\s*\{[\s\S]*transform:\s*translateX\(/,
  );
});

test("slides the peeked settings gear fully into view on hover or focus", () => {
  assert.match(
    readerEnhancerSource,
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-zone"\]:hover \[\$\{CONTROL_ATTRIBUTE\}="settings-peek-button"\],[\s\S]*\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-zone"\]:focus-within \[\$\{CONTROL_ATTRIBUTE\}="settings-peek-button"\]\s*\{[\s\S]*transform:\s*translateX\(0\)/,
  );
});

test("sanitizes cloned toolbar buttons so peek controls do not inherit hidden motion state", () => {
  assert.match(readerEnhancerSource, /button\.removeAttribute\(HIDDEN_ATTRIBUTE\);/);
  assert.match(readerEnhancerSource, /button\.removeAttribute\(MOTION_ATTRIBUTE\);/);
  assert.match(readerEnhancerSource, /button\.removeAttribute\(MOTION_STATE_ATTRIBUTE\);/);
  assert.match(
    readerEnhancerSource,
    /button\.removeAttribute\(MOTION_INITIALIZED_ATTRIBUTE\);/,
  );
  assert.match(
    readerEnhancerSource,
    /button\.removeAttribute\(MOTION_TARGET_HIDDEN_ATTRIBUTE\);/,
  );
});

test("animates the shared settings wrapper when minimizing the settings entry point", () => {
  assert.match(
    readerEnhancerSource,
    /const settingsMotionTarget = readerDom\.settingsGroup \?\? readerDom\.settingsButton;/,
  );
  assert.match(readerEnhancerSource, /revealRightRailMotionContext\(settingsMotionTarget\);/);
  assert.match(
    readerEnhancerSource,
    /syncMotionVisibility\(settingsMotionTarget,\s*\{[\s\S]*mode:\s*"slide-right"/,
  );
});

test("temporarily revives a hidden settings wrapper before forwarding the peek-button click", () => {
  assert.match(
    readerEnhancerSource,
    /const openHiddenSettingsButton = \(\s*settingsButton: HTMLButtonElement,\s*settingsMotionTarget: HTMLElement \| null,/,
  );
  assert.match(
    readerEnhancerSource,
    /settingsMotionTarget\.style\.visibility = "hidden";[\s\S]*settingsMotionTarget\.style\.pointerEvents = "none";[\s\S]*markHidden\(settingsMotionTarget,\s*false\);[\s\S]*settingsButton\.click\(\);[\s\S]*requestAnimationFrame\(\(\) => \{[\s\S]*markHidden\(settingsMotionTarget,\s*wasHidden\);/,
  );
  assert.match(
    readerEnhancerSource,
    /openHiddenSettingsButton\(settingsButton,\s*settingsGroup \?\? settingsButton\);/,
  );
});
