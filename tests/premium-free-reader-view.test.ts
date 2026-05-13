import assert from "node:assert/strict";
import test from "node:test";

import "./setup-dom.js";
import {
  collectPremiumFreeViewportPages,
  renderPremiumFreePagerPages,
  renderPremiumFreeFeedPages,
} from "../src/premium-free-reader-view.js";
import type { PremiumFreeSuccessResult } from "../src/premium-free-reader-model.js";

const success: PremiumFreeSuccessResult = {
  status: "success",
  provider: "mangabuff",
  matchedTitle: {
    titleId: "demo",
    slug: "demo",
    titleName: "Демо",
    titleUrl: "https://example.test/demo",
  },
  matchedChapter: {
    chapterId: "3-148",
    chapter: "148",
    volume: 3,
    chapterUrl: "https://example.test/demo/3/148",
  },
  manualUrl: "https://example.test/demo/3/148",
  nextChapter: null,
  totalPages: 2,
  pages: [
    { index: 0, proxyUrl: "/api/images/demo:1:0" },
    { index: 1, proxyUrl: "/api/images/demo:1:1" },
  ],
};

const installChromeProxyStub = (): void => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage(_message: unknown, callback: (response: unknown) => void) {
        callback({ data: "not-a-data-url" });
      },
    },
  };
};

test("renderPremiumFreeFeedPages renders feed pages with reader vars and stream metadata", () => {
  installChromeProxyStub();
  const container = document.createElement("div");

  renderPremiumFreeFeedPages(
    container,
    success,
    {
      mode: "feed",
      containerWidthVar: "70vw",
      brightnessVar: "brightness(0.8)",
    },
    "demo-title:3:148",
  );

  const reader = container.querySelector<HTMLElement>(
    '[data-rre-control="premium-free-feed-reader"]',
  );
  const shells = Array.from(
    container.querySelectorAll<HTMLElement>('[data-rre-control="premium-free-page-shell"]'),
  );
  const frames = Array.from(
    container.querySelectorAll<HTMLElement>('[data-rre-control="premium-free-page-frame"]'),
  );
  const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));

  assert.ok(reader);
  assert.equal(shells.length, 2);
  assert.equal(shells[0]?.dataset.rrePremiumFreeStreamKey, "demo-title:3:148");
  assert.equal(shells[0]?.dataset.rrePremiumFreePageIndex, "0");
  assert.equal(frames[0]?.style.getPropertyValue("--reader-container-width"), "70vw");
  assert.equal(frames[0]?.style.getPropertyValue("--reader-brightness"), "brightness(0.8)");
  assert.equal(images[0]?.alt, "Страница 1");
  assert.equal(images[1]?.alt, "Страница 2");
});

test("collectPremiumFreeViewportPages returns geometry for stream page shells only", () => {
  installChromeProxyStub();
  const container = document.createElement("div");
  renderPremiumFreeFeedPages(
    container,
    success,
    { mode: "feed", containerWidthVar: null, brightnessVar: null },
    "demo-title:3:148",
  );

  const shells = Array.from(
    container.querySelectorAll<HTMLElement>('[data-rre-control="premium-free-page-shell"]'),
  );
  shells[0]!.getBoundingClientRect = () =>
    ({ top: 10, bottom: 110 }) as DOMRect;
  shells[1]!.getBoundingClientRect = () =>
    ({ top: 120, bottom: 220 }) as DOMRect;

  assert.deepEqual(collectPremiumFreeViewportPages(container), [
    { key: "demo-title:3:148", pageIndex: 0, top: 10, bottom: 110 },
    { key: "demo-title:3:148", pageIndex: 1, top: 120, bottom: 220 },
  ]);
});

test("renderPremiumFreePagerPages renders the selected page and delegates navigation", () => {
  installChromeProxyStub();
  const container = document.createElement("div");
  const pageChanges: number[] = [];

  renderPremiumFreePagerPages({
    container,
    result: success,
    state: {
      mode: "pager",
      containerWidthVar: "64vw",
      brightnessVar: "brightness(0.9)",
    },
    currentPageIndex: 1,
    onPageChange: (nextIndex) => pageChanges.push(nextIndex),
  });

  const reader = container.querySelector<HTMLElement>(
    '[data-rre-control="premium-free-pager-reader"]',
  );
  const clickableArea = container.querySelector<HTMLElement>(
    '[data-rre-control="premium-free-clickable-area"]',
  );
  const image = container.querySelector<HTMLImageElement>("img");
  const previousZone = container.querySelector<HTMLButtonElement>(
    '[data-rre-control="premium-free-click-zone-prev"]',
  );
  const nextZone = container.querySelector<HTMLButtonElement>(
    '[data-rre-control="premium-free-click-zone-next"]',
  );

  assert.ok(reader);
  assert.equal(image?.alt, "Страница 2");
  assert.equal(
    clickableArea?.style.getPropertyValue("--reader-container-width"),
    "64vw",
  );

  previousZone?.click();
  nextZone?.click();

  assert.deepEqual(pageChanges, [0, 2]);
});
