import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("renders a clickable additional settings header and syncs its stored expanded state", () => {
  assert.match(readerEnhancerSource, /settings-section-toggle/);
  assert.match(readerEnhancerSource, /isAdditionalSettingsExpanded/);
  assert.match(readerEnhancerSource, /aria-expanded/);
  assert.match(
    readerEnhancerSource,
    /markHidden\(rows,\s*!settings\.isAdditionalSettingsExpanded\)/,
  );
});

test("applies the stored collapsed state before inserting the section into the drawer", () => {
  assert.match(
    readerEnhancerSource,
    /const ensureSettingsSection = \(\s*settingsPanel: HTMLElement,\s*nativeToggleList: HTMLElement,\s*settings: ReaderEnhancerSettings,/,
  );
  assert.match(
    readerEnhancerSource,
    /markHidden\(rows,\s*!settings\.isAdditionalSettingsExpanded\);[\s\S]*nativeToggleList\.insertAdjacentElement\("afterend",\s*extensionSection\)/,
  );
});

test("animates additional settings collapse through a dedicated helper after initial render", () => {
  assert.match(readerEnhancerSource, /const syncSettingsRowsCollapse = \(/);
  assert.match(
    readerEnhancerSource,
    /syncSettingsRowsCollapse\(rows,\s*expanded\)/,
  );
});
