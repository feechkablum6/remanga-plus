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

test("handles fullscreen clicks without a page-injected blob bridge", () => {
  assert.match(readerEnhancerSource, /button\.onclick = handleFullscreenButtonClick;/);
  assert.match(readerEnhancerSource, /button\.onpointerup = handleFullscreenButtonClick;/);
  assert.match(readerEnhancerSource, /document\.documentElement\.requestFullscreen\(\)/);
  assert.match(readerEnhancerSource, /PSEUDO_FULLSCREEN_ATTRIBUTE/);
  assert.doesNotMatch(readerEnhancerSource, /createObjectURL\(blob\)/);
  assert.doesNotMatch(readerEnhancerSource, /data-rre-fullscreen-bridge/);
});
