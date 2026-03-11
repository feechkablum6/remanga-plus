import assert from "node:assert/strict";
import test from "node:test";

import {
  POPUP_CLOSE_BUTTON_SELECTORS,
  POPUP_SELECTORS,
  isLikelyCornerCloseButton,
} from "../src/popup-dismissal.js";

test("gift promo dismissal inspects modal dialogs in addition to toast containers", () => {
  assert.ok(
    POPUP_SELECTORS.some(
      (selector) =>
        selector.includes('[role="dialog"]') || selector.includes('[aria-modal="true"]'),
    ),
  );
});

test("gift promo dismissal covers localized and dialog-specific close buttons", () => {
  const combinedSelectors = POPUP_CLOSE_BUTTON_SELECTORS.join(", ");

  assert.match(combinedSelectors, /\[data-radix-dialog-close\]/);
  assert.match(combinedSelectors, /aria-label="Закрыть"/);
});

test("an icon-only button in the top-right corner is treated as a close control", () => {
  assert.equal(
    isLikelyCornerCloseButton({
      text: "",
      ariaLabel: null,
      title: null,
      hasSvg: true,
      relativeTop: 0.03,
      relativeRight: 0.04,
      widthRatio: 0.08,
      heightRatio: 0.08,
    }),
    true,
  );
});

test("the primary gift action button is not mistaken for a close control", () => {
  assert.equal(
    isLikelyCornerCloseButton({
      text: "Выбрать",
      ariaLabel: null,
      title: null,
      hasSvg: false,
      relativeTop: 0.85,
      relativeRight: 0.12,
      widthRatio: 0.42,
      heightRatio: 0.12,
    }),
    false,
  );
});
