import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("peek-zone does not intercept pointer events so fullscreen button stays clickable", () => {
  const peekZoneCssMatch = readerEnhancerSource.match(
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-zone"\]\s*\{([^}]+)\}/,
  );
  assert.ok(peekZoneCssMatch, "settings-peek-zone CSS rule must exist");

  const cssBody = peekZoneCssMatch[1];

  assert.match(
    cssBody,
    /pointer-events:\s*none/,
    "peek zone must be transparent to clicks so the fullscreen button underneath remains interactive",
  );
});

test("peek-content receives pointer events so hover detection still works", () => {
  const peekContentCssMatch = readerEnhancerSource.match(
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-content"\]\s*\{([^}]+)\}/,
  );
  assert.ok(peekContentCssMatch, "settings-peek-content CSS rule must exist");

  const cssBody = peekContentCssMatch[1];

  assert.match(
    cssBody,
    /pointer-events:\s*auto/,
    "peek content must accept pointer events to trigger the button reveal on hover",
  );
});

test("hover reveal rule targets peek-content, not peek-zone", () => {
  const hoverRuleRegex =
    /\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-content"\]:hover\s+\[\$\{CONTROL_ATTRIBUTE\}="settings-peek-button"\]/;
  assert.match(
    readerEnhancerSource,
    hoverRuleRegex,
    "hover reveal must hang off peek-content so peek-zone can stay pointer-events: none",
  );
});
