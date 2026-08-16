import assert from "node:assert/strict";
import test from "node:test";

import {
  decideFullscreenAction,
  resolvePseudoFullscreenAfterNativeDenial,
  resolvePseudoFullscreenAfterNativeSuccess,
  shouldClearPseudoFullscreenOnChange,
  type FullscreenDecision,
} from "../src/fullscreen-controller.js";

const decide = (
  overrides: Partial<Parameters<typeof decideFullscreenAction>[0]> = {},
): FullscreenDecision =>
  decideFullscreenAction({
    realFullscreenActive: false,
    pseudoFullscreenActive: false,
    lastActionAt: null,
    now: 1_000,
    transitionInProgress: false,
    ...overrides,
  });

test("a retry after a denied request always clears pseudo mode and enters native fullscreen", () => {
  assert.equal(decide(), "enter");

  assert.equal(
    decide({
      pseudoFullscreenActive: true,
      lastActionAt: 1_000,
      now: 1_500,
    }),
    "clear-pseudo-and-enter",
  );
  assert.equal(
    decide({
      pseudoFullscreenActive: true,
      lastActionAt: 1_500,
      now: 2_000,
    }),
    "clear-pseudo-and-enter",
  );
});

test("a deliberate retry after 500 ms is not treated as a duplicate gesture", () => {
  assert.equal(
    decide({
      lastActionAt: 1_000,
      now: 1_500,
    }),
    "enter",
  );
});

test("pointerup and click from one gesture produce one fullscreen toggle", () => {
  const pointerupDecision = decide({ now: 2_000 });
  const clickDecision = decide({
    lastActionAt: 2_000,
    now: 2_040,
  });

  assert.equal(pointerupDecision, "enter");
  assert.equal(clickDecision, "ignore-duplicate");
});

test("native fullscreen success removes pseudo fullscreen mode", () => {
  assert.equal(resolvePseudoFullscreenAfterNativeSuccess(true, true), false);
});

test("stable native denial alternates pseudo fullscreen across four deliberate clicks", () => {
  let pseudoFullscreenActive = false;
  let lastActionAt: number | null = null;

  for (const [index, expectedPseudoFullscreen] of [true, false, true, false].entries()) {
    const now = 2_000 + index * 500;
    const decision = decide({
      pseudoFullscreenActive,
      lastActionAt,
      now,
    });
    const attempt = decision === "clear-pseudo-and-enter"
      ? "retry-after-pseudo"
      : "normal";

    if (decision === "clear-pseudo-and-enter") {
      pseudoFullscreenActive = false;
    }
    pseudoFullscreenActive = resolvePseudoFullscreenAfterNativeDenial(attempt);
    lastActionAt = now;

    assert.equal(pseudoFullscreenActive, expectedPseudoFullscreen);
  }
});

test("denied retry after pseudo fullscreen keeps pseudo mode disabled", () => {
  assert.equal(
    resolvePseudoFullscreenAfterNativeDenial("retry-after-pseudo"),
    false,
  );
});

test("denied normal entry enables pseudo fullscreen", () => {
  assert.equal(resolvePseudoFullscreenAfterNativeDenial("normal"), true);
});

test("fullscreenchange clears pseudo mode only after native fullscreen becomes active", () => {
  assert.equal(shouldClearPseudoFullscreenOnChange(false, true), false);
  assert.equal(shouldClearPseudoFullscreenOnChange(true, true), true);
});
