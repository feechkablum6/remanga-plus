import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const postinstallScript = path.join(repoRoot, "packaging/templates/postinstall");

// Sample manifest "key" with known computed extension id.
// "key" is the base64 RSA pubkey embedded in public/manifest.json.
const SAMPLE_MANIFEST = JSON.parse(readFileSync(path.join(repoRoot, "public/manifest.json"), "utf8"));
const SAMPLE_KEY = SAMPLE_MANIFEST.key;

// Compute expected id via the same algorithm in JS for assertion.
const { createHash } = await import("node:crypto");
const expectedId = createHash("sha256")
  .update(Buffer.from(SAMPLE_KEY, "base64"))
  .digest("hex")
  .slice(0, 32)
  .replace(/[0-9a-f]/g, (h) => String.fromCharCode(97 + Number.parseInt(h, 16)));

test("postinstall computes extension id and writes NM manifest for active Chromium browsers", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "remanga-pkg-"));
  const fakeHome = path.join(tmp, "home");
  const installDir = path.join(tmp, "Remanga Plus");
  const extensionDir = path.join(installDir, "extension");

  mkdirSync(extensionDir, { recursive: true });
  writeFileSync(
    path.join(extensionDir, "manifest.json"),
    JSON.stringify({ key: SAMPLE_KEY }),
  );
  writeFileSync(path.join(installDir, "host"), "#!/bin/bash\necho stub\n");

  // Create two fake browser profile roots, leave others absent.
  const chromeRoot = path.join(fakeHome, "Library/Application Support/Google/Chrome");
  const braveRoot = path.join(fakeHome, "Library/Application Support/BraveSoftware/Brave-Browser");
  mkdirSync(chromeRoot, { recursive: true });
  mkdirSync(braveRoot, { recursive: true });

  const result = spawnSync("bash", [postinstallScript], {
    encoding: "utf8",
    env: {
      ...process.env,
      REMANGA_INSTALL_DIR: installDir,
      REMANGA_TARGET_HOME: fakeHome,
      REMANGA_TARGET_USER: process.env.USER ?? "tester",
      REMANGA_SKIP_CHOWN: "1",
    },
  });

  assert.equal(result.status, 0, `postinstall failed: ${result.stderr}\n${result.stdout}`);

  for (const root of [chromeRoot, braveRoot]) {
    const manifestPath = path.join(root, "NativeMessagingHosts/org.remanga.parser_host.json");
    assert.ok(existsSync(manifestPath), `expected NM manifest at ${manifestPath}`);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.name, "org.remanga.parser_host");
    assert.equal(manifest.path, path.join(installDir, "host"));
    assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${expectedId}/`]);
  }

  // Edge profile dir is absent → must NOT create it.
  const edgeManifest = path.join(
    fakeHome,
    "Library/Application Support/Microsoft Edge/NativeMessagingHosts/org.remanga.parser_host.json",
  );
  assert.ok(!existsSync(edgeManifest), "should not register for absent browser");

  rmSync(tmp, { recursive: true, force: true });
});
