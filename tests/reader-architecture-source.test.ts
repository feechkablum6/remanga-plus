import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const readerEnhancerSource = readFileSync("src/reader-enhancer.ts", "utf8");
const domUtilsSource = readFileSync("src/reader-dom-utils.ts", "utf8");
const imageLoaderSource = readFileSync("src/premium-free-image-loader.ts", "utf8");
const readerModelSource = readFileSync("src/premium-free-reader-model.ts", "utf8");
const readerViewSource = existsSync("src/premium-free-reader-view.ts")
  ? readFileSync("src/premium-free-reader-view.ts", "utf8")
  : "";

test("reader-enhancer reuses shared DOM helpers instead of redefining them", () => {
  assert.match(readerEnhancerSource, /from "\.\/reader-dom-utils"/);
  assert.doesNotMatch(readerEnhancerSource, /const CONTROL_ATTRIBUTE = "data-rre-control"/);
  assert.doesNotMatch(readerEnhancerSource, /const HIDDEN_ATTRIBUTE = "data-rre-hidden"/);
  assert.doesNotMatch(readerEnhancerSource, /const normalizeText =/);
  assert.doesNotMatch(readerEnhancerSource, /const queryAllWithSelf =/);
  assert.doesNotMatch(readerEnhancerSource, /const markHidden =/);
  assert.doesNotMatch(readerEnhancerSource, /const findSettingsPanel =/);
  assert.doesNotMatch(readerEnhancerSource, /const findBuyChapterBanner =/);
  assert.doesNotMatch(readerEnhancerSource, /const isVisiblePremiumFreeBannerCandidate =/);
  assert.doesNotMatch(readerEnhancerSource, /const PREMIUM_FREE_ROOT_KEY =/);
  assert.doesNotMatch(readerEnhancerSource, /const PREMIUM_FREE_KEY_ATTRIBUTE =/);
  assert.doesNotMatch(readerEnhancerSource, /const PREMIUM_FREE_BANNER_ATTRIBUTE =/);
  assert.doesNotMatch(readerEnhancerSource, /const PREMIUM_FREE_STATE_ATTRIBUTE =/);
  assert.doesNotMatch(readerEnhancerSource, /const PREMIUM_FREE_NATIVE_PAID_ATTRIBUTE =/);

  assert.match(domUtilsSource, /export const CONTROL_ATTRIBUTE/);
  assert.match(domUtilsSource, /export const markHidden/);
  assert.match(domUtilsSource, /export const findSettingsPanel/);
  assert.match(domUtilsSource, /export const findBuyChapterBanner/);
  assert.match(domUtilsSource, /export const PREMIUM_FREE_ROOT_KEY/);
});

test("reader-enhancer does not own Premium Free image transport", () => {
  assert.doesNotMatch(readerEnhancerSource, /PROXY_IMAGE_MESSAGE_TYPE/);
  assert.doesNotMatch(readerEnhancerSource, /const imageBlobCache =/);
  assert.doesNotMatch(readerEnhancerSource, /const pendingImageLoads =/);
  assert.doesNotMatch(readerEnhancerSource, /const fetchImageBlobUrl =/);

  assert.match(imageLoaderSource, /PROXY_IMAGE_MESSAGE_TYPE/);
  assert.match(imageLoaderSource, /fetchPremiumFreeImageBlobUrl/);
});

test("reader-enhancer reuses the Premium Free stream model", () => {
  assert.match(readerEnhancerSource, /from "\.\/premium-free-reader-model"/);
  assert.doesNotMatch(readerEnhancerSource, /type PremiumFreeChapterStream =/);
  assert.doesNotMatch(readerEnhancerSource, /const createPremiumFreeKey =/);
  assert.doesNotMatch(readerEnhancerSource, /const createPremiumFreeStreamEntry =/);

  assert.match(readerModelSource, /export type PremiumFreeChapterStream/);
  assert.match(readerModelSource, /export const createPremiumFreeKey/);
  assert.match(readerModelSource, /export const createPremiumFreeStreamEntry/);
});

test("reader-enhancer delegates Premium Free page rendering to the reader view module", () => {
  assert.match(readerEnhancerSource, /from "\.\/premium-free-reader-view"/);
  assert.doesNotMatch(readerEnhancerSource, /const PREMIUM_FREE_READER_WIDTH_CLASS =/);
  assert.doesNotMatch(readerEnhancerSource, /const createPremiumFreeImage =/);
  assert.doesNotMatch(readerEnhancerSource, /const createPremiumFreePageFrame =/);
  assert.doesNotMatch(readerEnhancerSource, /const renderPremiumFreeFeedPages =/);
  assert.doesNotMatch(readerEnhancerSource, /const renderPremiumFreePagerPages =/);
  assert.doesNotMatch(readerEnhancerSource, /const collectPremiumFreeViewportPages =/);
  assert.doesNotMatch(readerEnhancerSource, /const PREMIUM_FREE_CLICKABLE_AREA_CLASS =/);
  assert.doesNotMatch(readerEnhancerSource, /const PREMIUM_FREE_CLICK_ZONE_CLASS =/);

  assert.match(readerViewSource, /export const PREMIUM_FREE_READER_WIDTH_CLASS/);
  assert.match(readerViewSource, /export const renderPremiumFreeFeedPages/);
  assert.match(readerViewSource, /export const renderPremiumFreePagerPages/);
  assert.match(readerViewSource, /export const collectPremiumFreeViewportPages/);
});
