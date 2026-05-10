import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const buildScript = path.join(repoRoot, "packaging/scripts/build-installer-windows.mjs");
const buildDir = path.join(repoRoot, "packaging/build-windows");
const installerExe = path.join(buildDir, "Remanga-Plus-Setup.exe");

const hasMakensis = spawnSync("makensis", ["-VERSION"], { encoding: "utf8" }).status === 0;

test("build-installer-windows produces payload + Setup.exe", { timeout: 360_000 }, (t) => {
  if (!hasMakensis) {
    t.skip("makensis not installed — run `brew install makensis` to enable this test");
    return;
  }

  rmSync(installerExe, { force: true });

  const result = spawnSync(process.execPath, [buildScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `build failed: ${result.stderr}\n${result.stdout}`);

  // Payload must include all the artefacts the NSIS script File-includes.
  for (const f of ["node.exe", "parser-server.js", "host.js", "host.bat", "extension/manifest.json"]) {
    assert.ok(existsSync(path.join(buildDir, f)), `missing payload file: ${f}`);
  }

  // Final installer.
  assert.ok(existsSync(installerExe), "Remanga-Plus-Setup.exe not produced");
  // LZMA-compressed installer should be ~20-30 MB.
  const installerSize = statSync(installerExe).size;
  assert.ok(installerSize > 15_000_000, `installer suspiciously small: ${installerSize}`);
  assert.ok(installerSize < 80_000_000, `installer suspiciously large: ${installerSize}`);

  // The extension manifest must still carry the "key" field — needed for stable extension id.
  const extManifest = JSON.parse(
    readFileSync(path.join(buildDir, "extension/manifest.json"), "utf8"),
  );
  assert.equal(extManifest.manifest_version, 3);
  assert.ok(typeof extManifest.key === "string" && extManifest.key.length > 0);
});

test("build-installer-windows fails fast with helpful message when makensis missing", () => {
  if (hasMakensis) {
    return; // can't simulate "missing" reliably without uninstalling
  }

  const result = spawnSync(process.execPath, [buildScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0, "must fail when makensis missing");
  assert.match(
    result.stderr + result.stdout,
    /brew install makensis/,
    "error message must point at `brew install makensis`",
  );
});
