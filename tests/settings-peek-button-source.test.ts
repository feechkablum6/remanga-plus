import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

const peekButtonCssBody = (() => {
  const match = readerEnhancerSource.match(
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-button"\]\s*\{([^}]+)\}/,
  );
  assert.ok(match, "settings-peek-button CSS rule must exist");
  return match[1];
})();

test("peek button is fully hidden by default — no protruding slice on the edge", () => {
  // No translateX-based protrusion trick.
  assert.doesNotMatch(
    peekButtonCssBody,
    /transform:\s*translateX\(/,
    "peek button must not rely on translateX protrusion",
  );

  // Default state: invisible and non-interactive.
  assert.match(
    peekButtonCssBody,
    /opacity:\s*0\b/,
    "peek button must start fully transparent",
  );
  assert.match(
    peekButtonCssBody,
    /pointer-events:\s*none/,
    "peek button must not intercept pointer events while hidden",
  );
});

test("peek button reveals via opacity on edge-zone hover or focus", () => {
  const hoverRuleMatch = readerEnhancerSource.match(
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-zone"\]:hover \[\$\{CONTROL_ATTRIBUTE\}="settings-peek-button"\],\s*\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-zone"\]:focus-within \[\$\{CONTROL_ATTRIBUTE\}="settings-peek-button"\]\s*\{([^}]+)\}/,
  );
  assert.ok(hoverRuleMatch, "hover/focus reveal rule must exist");
  const body = hoverRuleMatch[1];

  assert.match(body, /opacity:\s*1\b/, "hover must restore full opacity");
  assert.match(
    body,
    /pointer-events:\s*auto/,
    "hover must re-enable pointer events",
  );
  assert.doesNotMatch(
    body,
    /transform:\s*translateX/,
    "hover must not use translateX anymore",
  );
});

test("peek button transitions opacity smoothly", () => {
  assert.match(
    peekButtonCssBody,
    /transition:\s*opacity\s+\d+ms/,
    "peek button must transition opacity for a soft fade",
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

test("temporarily revives a hidden settings wrapper before forwarding the peek-button click", () => {
  assert.match(
    readerEnhancerSource,
    /const openHiddenSettingsButton = \(\s*settingsButton: HTMLButtonElement,\s*settingsMotionTarget: HTMLElement \| null,/,
  );
  assert.match(
    readerEnhancerSource,
    /settingsMotionTarget\.style\.visibility = "hidden";[\s\S]*settingsMotionTarget\.style\.pointerEvents = "none";[\s\S]*markHidden\(settingsMotionTarget,\s*false\);[\s\S]*settingsButton\.click\(\);/,
  );
  assert.match(
    readerEnhancerSource,
    /openHiddenSettingsButton\(settingsButton,\s*settingsGroup \?\? settingsButton\);/,
  );
});
