import { test } from "node:test";
import assert from "node:assert/strict";

import { computeExtensionIdFromKey } from "../native-host/extension-id.js";

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
