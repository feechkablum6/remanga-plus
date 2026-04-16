import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const manifestSource = readFileSync(
  path.resolve(process.cwd(), "public/manifest.json"),
  "utf8",
);

test("manifest declares background service worker and native messaging permission", () => {
  const manifest = JSON.parse(manifestSource) as {
    background?: { service_worker?: string };
    permissions?: string[];
  };

  assert.equal(manifest.background?.service_worker, "background.js");
  assert.ok(manifest.permissions?.includes("nativeMessaging"));
});

test("background worker owns parser startup coordination", () => {
  const backgroundSource = readFileSync(
    path.resolve(process.cwd(), "src/background.ts"),
    "utf8",
  );

  assert.match(backgroundSource, /ensureParserServer/);
  assert.match(backgroundSource, /connectNative|sendNativeMessage/);
  assert.match(backgroundSource, /buildParserServerHealthcheckUrl|PARSER_SERVER_HEALTHCHECK_URL/);
});
