import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
const syncScriptPath = path.join(repoRoot, "scripts/sync-installed-extension.mjs");
const packageJsonPath = path.join(repoRoot, "package.json");

const loadSyncModule = async () =>
  import(`${pathToFileURL(syncScriptPath).href}?test=${Date.now()}-${Math.random()}`);

test("build runs installed extension sync as its final step", () => {
  assert.ok(existsSync(syncScriptPath), "missing scripts/sync-installed-extension.mjs");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  assert.match(
    packageJson.scripts.build,
    /&& node scripts\/sync-installed-extension\.mjs$/,
  );
});

test("installed extension path uses override before LOCALAPPDATA", async () => {
  assert.ok(existsSync(syncScriptPath), "missing scripts/sync-installed-extension.mjs");
  const { resolveInstalledExtensionDirectory } = await loadSyncModule();

  assert.equal(
    resolveInstalledExtensionDirectory({
      REMANGA_EXTENSION_INSTALL_DIR: "/custom/extension",
      LOCALAPPDATA: "/mnt/c/Users/Test/AppData/Local",
    }),
    path.resolve("/custom/extension"),
  );
  assert.equal(
    resolveInstalledExtensionDirectory({
      LOCALAPPDATA: "/mnt/c/Users/Test/AppData/Local",
    }),
    path.join(
      "/mnt/c/Users/Test/AppData/Local",
      "Programs",
      "Remanga Plus",
      "extension",
    ),
  );
});

test("sync skips a missing installed extension without creating it", async () => {
  assert.ok(existsSync(syncScriptPath), "missing scripts/sync-installed-extension.mjs");
  const { syncInstalledExtension } = await loadSyncModule();
  const root = mkdtempSync(path.join(os.tmpdir(), "remanga-sync-skip-"));
  const sourceDirectory = path.join(root, "dist");
  const destinationDirectory = path.join(root, "installed", "extension");
  mkdirSync(sourceDirectory, { recursive: true });
  writeFileSync(path.join(sourceDirectory, "manifest.json"), "{}", "utf8");

  try {
    const result = syncInstalledExtension({
      sourceDirectory,
      destinationDirectory,
      log: () => {},
    });
    assert.equal(result.status, "skipped");
    assert.equal(existsSync(destinationDirectory), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sync replaces installed files and removes stale output", async () => {
  assert.ok(existsSync(syncScriptPath), "missing scripts/sync-installed-extension.mjs");
  const { syncInstalledExtension } = await loadSyncModule();
  const root = mkdtempSync(path.join(os.tmpdir(), "remanga-sync-copy-"));
  const sourceDirectory = path.join(root, "dist");
  const destinationDirectory = path.join(root, "installed", "extension");
  mkdirSync(path.join(sourceDirectory, "icons"), { recursive: true });
  mkdirSync(destinationDirectory, { recursive: true });
  writeFileSync(path.join(sourceDirectory, "manifest.json"), '{"version":"2"}', "utf8");
  writeFileSync(path.join(sourceDirectory, "content.js"), "new-content", "utf8");
  writeFileSync(path.join(sourceDirectory, "icons", "icon.png"), "new-icon", "utf8");
  writeFileSync(path.join(destinationDirectory, "manifest.json"), '{"version":"1"}', "utf8");
  writeFileSync(path.join(destinationDirectory, "stale.js"), "stale", "utf8");

  try {
    const result = syncInstalledExtension({
      sourceDirectory,
      destinationDirectory,
      processId: 4242,
      log: () => {},
    });
    assert.equal(result.status, "synced");
    assert.equal(readFileSync(path.join(destinationDirectory, "content.js"), "utf8"), "new-content");
    assert.equal(readFileSync(path.join(destinationDirectory, "icons", "icon.png"), "utf8"), "new-icon");
    assert.equal(existsSync(path.join(destinationDirectory, "stale.js")), false);
    assert.deepEqual(
      readdirSync(path.dirname(destinationDirectory)).sort(),
      ["extension"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
