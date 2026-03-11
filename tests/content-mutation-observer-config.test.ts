import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const contentSource = readFileSync(path.resolve(process.cwd(), "src/content.ts"), "utf8");

test("observes settings drawer attribute changes so the rail can return without reload", () => {
  const observerCall = contentSource.match(
    /observer\.observe\(document\.documentElement,\s*\{([\s\S]*?)\}\s*\);/,
  );

  assert.ok(observerCall, "expected MutationObserver.observe() call in src/content.ts");

  const observerOptions = observerCall[1];

  assert.match(observerOptions, /attributes:\s*true/);
  assert.match(observerOptions, /attributeFilter:\s*\[/);

  ["class", "style", "data-state", "aria-hidden"].forEach((attributeName) => {
    assert.match(observerOptions, new RegExp(`["']${attributeName}["']`));
  });
});
