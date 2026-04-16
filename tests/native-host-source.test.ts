import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

test("native host launcher targets parser-server dist entrypoint", () => {
  const hostSource = readFileSync(
    path.resolve(process.cwd(), "native-host/host.ts"),
    "utf8",
  );

  assert.match(hostSource, /parser-server\/dist\/index\.js/);
  assert.match(hostSource, /spawn/);
  assert.match(hostSource, /127\.0\.0\.1/);
});

test("macos install script and manifest template exist for native messaging", () => {
  const installSource = readFileSync(
    path.resolve(process.cwd(), "native-host/install-macos.ts"),
    "utf8",
  );
  const manifestSource = readFileSync(
    path.resolve(process.cwd(), "native-host/native-host-manifest.json"),
    "utf8",
  );

  assert.match(installSource, /Library\/Application Support\/Google\/Chrome\/NativeMessagingHosts/);
  assert.match(installSource, /extension-id|extensionId/);
  assert.match(manifestSource, /allowed_origins/);
  assert.match(manifestSource, /__EXTENSION_ID__/);
});
