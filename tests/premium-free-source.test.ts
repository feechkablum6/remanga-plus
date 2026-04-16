import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test('uses "Premium Free" as the toggle label', () => {
  assert.match(readerEnhancerSource, /label: "Premium Free"/);
});

test("tracks premium-free resolving, rendering, and error states", () => {
  assert.match(
    readerEnhancerSource,
    /type PremiumFreeState = "idle" \| "resolving" \| "rendering" \| "error"/,
  );
  assert.match(readerEnhancerSource, /PREMIUM_FREE_STATE_ATTRIBUTE/);
});

test("collects live reader mode and width state for premium-free rendering", () => {
  assert.match(
    readerEnhancerSource,
    /type PremiumFreeReaderMode = "feed" \| "pager"/,
  );
  assert.match(readerEnhancerSource, /collectPremiumFreeReaderState/);
  assert.match(readerEnhancerSource, /--reader-container-width/);
});

test("renders dedicated premium-free feed and pager readers", () => {
  assert.match(readerEnhancerSource, /renderPremiumFreeFeedPages/);
  assert.match(readerEnhancerSource, /renderPremiumFreePagerPages/);
  assert.match(readerEnhancerSource, /premium-free-feed-reader/);
  assert.match(readerEnhancerSource, /premium-free-pager-reader/);
});

test("uses a native-style clickable overlay for premium-free pager navigation", () => {
  assert.match(readerEnhancerSource, /premium-free-clickable-area/);
  assert.match(readerEnhancerSource, /premium-free-click-zone-prev/);
  assert.match(readerEnhancerSource, /premium-free-click-zone-next/);
  assert.match(readerEnhancerSource, /premiumFreePageIndex/);
});

test("does not render the old external-source placeholder copy", () => {
  assert.doesNotMatch(
    readerEnhancerSource,
    /Глава будет загружена из внешнего источника/,
  );
});

test("contains parser startup specific premium-free copy", () => {
  const premiumFreeSource = readFileSync(
    path.resolve(process.cwd(), "src/premium-free.ts"),
    "utf8",
  );

  assert.match(premiumFreeSource, /resolver_unavailable/);
  assert.match(premiumFreeSource, /install_required/);
  assert.match(premiumFreeSource, /Parser-server не запустился/);
  assert.match(premiumFreeSource, /derivePremiumFreeTargetReference/);
  assert.match(premiumFreeSource, /createPremiumFreeStreamReference/);
  assert.match(premiumFreeSource, /nextChapter/);
});

test("contains feed-only chapter stream rendering contracts", () => {
  assert.match(
    readerEnhancerSource,
    /type PremiumFreeStreamStatus = "idle" \| "loading-next" \| "error" \| "exhausted"/,
  );
  assert.match(readerEnhancerSource, /premium-free-stream-chapter/);
  assert.match(readerEnhancerSource, /premium-free-stream-loader/);
  assert.match(readerEnhancerSource, /loadPremiumFreeNextChapter/);
});

test("synchronizes visible reader indicators for active premium-free stream chapters", () => {
  assert.match(readerEnhancerSource, /syncPremiumFreeReaderIndicators/);
  assert.match(readerEnhancerSource, /IntersectionObserver/);
  assert.match(readerEnhancerSource, /history\.replaceState/);
});

test("falls back to viewport geometry when observer-only premium-free prefetch is unreliable", () => {
  const visiblePageSync = readerEnhancerSource.match(
    /const syncPremiumFreeVisibleStreamPage = \(\): void => \{([\s\S]*?)\n\};\n\nconst observePremiumFreeStreamPages/u,
  );

  assert.ok(visiblePageSync, "expected syncPremiumFreeVisibleStreamPage function body");
  assert.match(
    visiblePageSync[1],
    /pickPremiumFreeActivePage[\s\S]*shouldPrefetchPremiumFreeNextChapterByViewport[\s\S]*loadPremiumFreeNextChapter/,
  );
  assert.match(readerEnhancerSource, /requestPremiumFreeViewportSync/);
  assert.match(readerEnhancerSource, /window\.addEventListener\(\s*"scroll"/);
});
