import assert from "node:assert/strict";
import test from "node:test";
import "./setup-dom.js";

import {
  CONTROL_ATTRIBUTE,
  HIDDEN_ATTRIBUTE,
  markHidden,
  normalizeText,
  queryAllWithSelf,
} from "../src/reader-dom-utils.js";

test("exports the shared reader control attributes", () => {
  assert.equal(CONTROL_ATTRIBUTE, "data-rre-control");
  assert.equal(HIDDEN_ATTRIBUTE, "data-rre-hidden");
});

test("markHidden toggles the shared hidden marker", () => {
  const node = document.createElement("div");

  markHidden(node, true);
  assert.equal(node.getAttribute(HIDDEN_ATTRIBUTE), "true");

  markHidden(node, false);
  assert.equal(node.hasAttribute(HIDDEN_ATTRIBUTE), false);
});

test("queryAllWithSelf includes the root when it matches", () => {
  const root = document.createElement("section");
  root.className = "target";
  const child = document.createElement("div");
  child.className = "target";
  root.append(child);

  assert.deepEqual(queryAllWithSelf(root, ".target"), [root, child]);
});

test("normalizeText trims and lowercases text", () => {
  assert.equal(normalizeText("  Привет   МИР  "), "привет мир");
  assert.equal(normalizeText(null), "");
});
