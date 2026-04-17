import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("peek button is absolutely positioned inside content so its placement never depends on flex quirks", () => {
  const peekButtonCssMatch = readerEnhancerSource.match(
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-button"\]\s*\{([^}]+)\}/,
  );
  assert.ok(peekButtonCssMatch, "settings-peek-button CSS rule must exist");

  const cssBody = peekButtonCssMatch[1];

  assert.match(
    cssBody,
    /position:\s*absolute/,
    "peek button must be absolutely positioned inside content for deterministic placement",
  );
  assert.match(
    cssBody,
    /top:\s*0/,
    "peek button must be pinned to the top of content",
  );
  assert.match(
    cssBody,
    /right:\s*0/,
    "peek button must be pinned to the right edge of content",
  );
});

test("peek zone is re-synced when the browser fullscreen state changes", () => {
  assert.match(
    readerEnhancerSource,
    /fullscreenchange[\s\S]{0,800}syncReaderEnhancer|fullscreenchange[\s\S]{0,800}syncSettingsPeekZone/,
    "entering/leaving fullscreen must trigger peek zone re-layout so positions stay in sync",
  );
});
