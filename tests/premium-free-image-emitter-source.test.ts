import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const SOURCE = readFileSync("src/reader-enhancer.ts", "utf8");

test("reader-enhancer exposes a Premium Free image-load emitter", () => {
  assert.match(
    SOURCE,
    /export\s+const\s+subscribePremiumFreeImageLoad\s*=/,
    "missing exported subscribePremiumFreeImageLoad",
  );
});

test("fetchImageBlobUrl notifies subscribers on resolve", () => {
  assert.match(
    SOURCE,
    /notifyPremiumFreeImageLoad\s*\(/,
    "fetchImageBlobUrl never calls notifyPremiumFreeImageLoad",
  );
});
