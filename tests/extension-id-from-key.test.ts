import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeExtensionIdFromKey,
  resolveExtensionIds,
} from "../native-host/extension-id.js";

test("derives the Chrome extension ID from an empty DER public key", () => {
  assert.equal(
    computeExtensionIdFromKey(""),
    "odlameecjipmbmbejkplpemijjgpljce",
  );
});

test("derives the Chrome extension ID from a known DER public key", () => {
  assert.equal(
    computeExtensionIdFromKey("aGVsbG8="),
    "cmpcenlkfplakdaocgoidlckmfljocjo",
  );
});

test("resolveExtensionIds returns only the derived id when the manifest has a key", () => {
  assert.deepEqual(
    resolveExtensionIds("aGVsbG8=", []),
    ["cmpcenlkfplakdaocgoidlckmfljocjo"],
  );
});

test("resolveExtensionIds falls back to explicit ids when no key is given", () => {
  assert.deepEqual(
    resolveExtensionIds(null, ["legacyid"]),
    ["legacyid"],
  );
});

test("resolveExtensionIds keeps both derived and legacy ids", () => {
  assert.deepEqual(
    resolveExtensionIds("aGVsbG8=", ["legacyid"]),
    ["cmpcenlkfplakdaocgoidlckmfljocjo", "legacyid"],
  );
});

test("resolveExtensionIds deduplicates ids while preserving order", () => {
  assert.deepEqual(
    resolveExtensionIds("aGVsbG8=", [
      "cmpcenlkfplakdaocgoidlckmfljocjo",
      "other",
    ]),
    ["cmpcenlkfplakdaocgoidlckmfljocjo", "other"],
  );
});

test("resolveExtensionIds throws when neither a key nor an explicit id is given", () => {
  assert.throws(
    () => resolveExtensionIds(null, []),
    /at least one extension id/i,
  );
});
