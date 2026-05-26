import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readSourceIfExists = (filePath: string): string => {
  const absolutePath = path.resolve(process.cwd(), filePath);
  return existsSync(absolutePath) ? readFileSync(absolutePath, "utf8") : "";
};

const readerEnhancerSource = readSourceIfExists("src/reader-enhancer.ts");
const popupCategoriesSource = readSourceIfExists("src/popup-categories.ts");
const readerModelSource = readSourceIfExists("src/premium-free-reader-model.ts");
const readerViewSource = readSourceIfExists("src/premium-free-reader-view.ts");
const domUtilsSource = readSourceIfExists("src/reader-dom-utils.ts");

test('uses "Premium Free" as the toggle label', () => {
  assert.match(popupCategoriesSource, /"premium-free": \{ label: "Premium Free"/);
});

test("tracks premium-free resolving, rendering, and error states", () => {
  assert.match(
    readerModelSource,
    /type PremiumFreeState = "idle" \| "resolving" \| "rendering" \| "error"/,
  );
  assert.match(readerEnhancerSource, /PREMIUM_FREE_STATE_ATTRIBUTE/);
});

test("collects live reader mode and width state for premium-free rendering", () => {
  assert.match(
    readerModelSource,
    /type PremiumFreeReaderMode = "feed" \| "pager"/,
  );
  assert.match(readerEnhancerSource, /collectPremiumFreeReaderState/);
  assert.match(readerEnhancerSource, /--reader-container-width/);
});

test("renders dedicated premium-free feed and pager readers", () => {
  assert.match(readerViewSource, /renderPremiumFreeFeedPages/);
  assert.match(readerViewSource, /renderPremiumFreePagerPages/);
  assert.match(readerViewSource, /premium-free-feed-reader/);
  assert.match(readerViewSource, /premium-free-pager-reader/);
});

test("uses a native-style clickable overlay for premium-free pager navigation", () => {
  assert.match(readerViewSource, /premium-free-clickable-area/);
  assert.match(readerViewSource, /premium-free-click-zone-prev/);
  assert.match(readerViewSource, /premium-free-click-zone-next/);
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

test("renders parser startup failures as parser-not-running instead of chapter-not-found", () => {
  const statusUiSource = readFileSync(
    path.resolve(process.cwd(), "src/premium-free-status-ui.ts"),
    "utf8",
  );

  assert.match(statusUiSource, /parser_down/);
  assert.match(statusUiSource, /Парсер не запущен/);
  assert.match(readerEnhancerSource, /result\.reason === "resolver_unavailable"/);
  assert.match(readerEnhancerSource, /phase: "parser_down"/);
});

test("warning status icon uses separate valid SVG paths", () => {
  const statusUiSource = readFileSync(
    path.resolve(process.cwd(), "src/premium-free-status-ui.ts"),
    "utf8",
  );

  assert.doesNotMatch(statusUiSource, /ICON_PATHS\.warning\.split\("m"\)/);
  assert.match(statusUiSource, /warningTriangle/);
  assert.match(statusUiSource, /warningMark/);
});

test("contains feed-only chapter stream rendering contracts", () => {
  assert.match(
    readerModelSource,
    /type PremiumFreeStreamStatus = "idle" \| "loading-next" \| "error" \| "exhausted"/,
  );
  assert.match(readerEnhancerSource, /premium-free-stream-chapter/);
  assert.match(readerEnhancerSource, /premium-free-stream-loader/);
  assert.match(readerEnhancerSource, /loadPremiumFreeNextChapter/);
});

test("stream timeout retry clears the cached failure and shows full resolve status", () => {
  const streamError = readerEnhancerSource.match(
    /const createPremiumFreeStreamError = \([\s\S]*?\n\};\n\nconst createPremiumFreeBranchSelector/u,
  );

  assert.ok(streamError, "expected createPremiumFreeStreamError function body");
  assert.doesNotMatch(streamError[0], /Показать карточку ReManga/);
  assert.doesNotMatch(streamError[0], /description\.linkHref/);
  assert.match(streamError[0], /createPremiumFreeKey\(nextReference\)/);
  assert.match(streamError[0], /premiumFreeResultCache\.delete\(nextKey\)/);
  assert.match(streamError[0], /createStatusBlock\("connecting"\)/);
});

test("timeout failures keep a single retry action without remanga/source links", () => {
  const remangaLink = readerEnhancerSource.match(
    /const appendPremiumFreeRemangaLink = \([\s\S]*?\n\};\n\nconst appendPremiumFreeRetryButton/u,
  );
  const retryButton = readerEnhancerSource.match(
    /const appendPremiumFreeRetryButton = \([\s\S]*?\n\};\n\nconst POLLING_INTERVAL_MS/u,
  );

  assert.ok(remangaLink, "expected appendPremiumFreeRemangaLink function body");
  assert.ok(retryButton, "expected appendPremiumFreeRetryButton function body");
  assert.match(remangaLink[0], /result\.reason === "resolve_timeout"/);
  assert.match(retryButton[0], /label = "Запустить парсер"/);
  assert.match(readerEnhancerSource, /result\.reason === "resolve_timeout" \? "Повторить"/);
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

test("appends premium-free stream chapters without replacing the existing feed", () => {
  const streamRender = readerEnhancerSource.match(
    /const renderPremiumFreeFeedStream = \([\s\S]*?\n\};\n\nconst observePremiumFreeLoadSentinel/u,
  );

  assert.ok(streamRender, "expected renderPremiumFreeFeedStream function body");
  assert.match(streamRender[0], /existingStreamReader/);
  assert.match(streamRender[0], /appendMissingPremiumFreeStreamChapters/);
  assert.match(
    streamRender[0],
    /if \(!existingStreamReader\) \{\s*container\.replaceChildren\(streamReader\);\s*\}/,
  );
});

test("keeps premium-free sync anchored to the existing root banner", () => {
  const bannerFinder = domUtilsSource.match(
    /export const findBuyChapterBanner = \(\): HTMLElement \| null => \{[\s\S]*?\n\};/,
  );

  assert.ok(bannerFinder, "expected findBuyChapterBanner function body in reader-dom-utils");
  assert.match(bannerFinder[0], /PREMIUM_FREE_ROOT_KEY/);
  assert.match(bannerFinder[0], /closest<HTMLElement>\("div\.h-screen"\)/);
  assert.doesNotMatch(bannerFinder[0], /PREMIUM_FREE_NATIVE_PAID_ATTRIBUTE/);
});

test("ignores zero-height premium-free root banners when selecting the paid banner", () => {
  const bannerFinder = domUtilsSource.match(
    /export const findBuyChapterBanner = \(\): HTMLElement \| null => \{[\s\S]*?\n\};/,
  );

  assert.ok(bannerFinder, "expected findBuyChapterBanner function body in reader-dom-utils");
  assert.match(bannerFinder[0], /isVisiblePremiumFreeBannerCandidate\(existingRootBanner\)/);
  assert.match(bannerFinder[0], /find\(isVisiblePremiumFreeBannerCandidate\)/);
});
