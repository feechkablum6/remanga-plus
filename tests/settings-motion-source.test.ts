import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const readerEnhancerSource = readFileSync(
  path.resolve(process.cwd(), "src/reader-enhancer.ts"),
  "utf8",
);

test("defines staged motion helpers and supported motion modes", () => {
  assert.match(readerEnhancerSource, /type MotionMode = "slide-right" \| "dissolve"/);
  assert.match(readerEnhancerSource, /const syncMotionVisibility = \(/);
  assert.match(
    readerEnhancerSource,
    /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/,
  );
});

test("declares motion style hooks for slide and dissolve animations", () => {
  assert.match(readerEnhancerSource, /const MOTION_ATTRIBUTE = "data-rre-motion"/);
  assert.match(readerEnhancerSource, /const MOTION_STATE_ATTRIBUTE = "data-rre-motion-state"/);
  assert.match(readerEnhancerSource, /\[\$\{MOTION_ATTRIBUTE\}="slide-right"\]/);
  assert.match(readerEnhancerSource, /\[\$\{MOTION_ATTRIBUTE\}="dissolve"\]/);
});

test("routes right rail and native settings menu items through staged motion visibility", () => {
  assert.match(
    readerEnhancerSource,
    /syncMotionVisibility\(\s*readerDom\.pageCounterButton,\s*\{[\s\S]*mode:\s*"slide-right"/,
  );
  assert.match(
    readerEnhancerSource,
    /syncMotionVisibility\(\s*node,\s*\{[\s\S]*mode:\s*"dissolve"/,
  );
});
