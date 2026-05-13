import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync("src/premium-free-image-loader.ts", "utf8");

test("premium-free image loader exposes an image-load emitter", () => {
  assert.match(
    SOURCE,
    /export\s+const\s+subscribePremiumFreeImageLoad\s*=/,
    "missing exported subscribePremiumFreeImageLoad",
  );
});

test("fetchPremiumFreeImageBlobUrl notifies subscribers on resolve", () => {
  assert.match(
    SOURCE,
    /notifyPremiumFreeImageLoad\s*\(/,
    "fetchPremiumFreeImageBlobUrl never calls notifyPremiumFreeImageLoad",
  );
});
