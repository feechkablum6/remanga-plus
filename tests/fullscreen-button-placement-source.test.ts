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
