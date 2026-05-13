import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readerEnhancerSource = readFileSync("src/reader-enhancer.ts", "utf8");
const domUtilsSource = readFileSync("src/reader-dom-utils.ts", "utf8");
const imageLoaderSource = readFileSync("src/premium-free-image-loader.ts", "utf8");
const readerModelSource = readFileSync("src/premium-free-reader-model.ts", "utf8");

test("reader-enhancer reuses shared DOM helpers instead of redefining them", () => {
  assert.match(readerEnhancerSource, /from "\.\/reader-dom-utils"/);
  assert.doesNotMatch(readerEnhancerSource, /const CONTROL_ATTRIBUTE = "data-rre-control"/);
  assert.doesNotMatch(readerEnhancerSource, /const HIDDEN_ATTRIBUTE = "data-rre-hidden"/);
  assert.doesNotMatch(readerEnhancerSource, /const normalizeText =/);
  assert.doesNotMatch(readerEnhancerSource, /const queryAllWithSelf =/);
  assert.doesNotMatch(readerEnhancerSource, /const markHidden =/);

  assert.match(domUtilsSource, /export const CONTROL_ATTRIBUTE/);
  assert.match(domUtilsSource, /export const markHidden/);
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
