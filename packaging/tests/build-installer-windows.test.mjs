import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, rmSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const buildScript = path.join(repoRoot, "packaging/scripts/build-installer-windows.mjs");
const buildDir = path.join(repoRoot, "packaging/build-windows");
const installerExe = path.join(buildDir, "Remanga-Plus-Setup.exe");

// "Working" makensis means it can compile a minimal script — not just answer -VERSION.
// macOS Tahoe arm64 Homebrew bottle 3.12 returns a version but throws std::bad_alloc
// on every script (see build-windows-installer.yml workflow + nsi commit message).
const hasWorkingMakensis = (() => {
  if (spawnSync("makensis", ["-VERSION"], { encoding: "utf8" }).status !== 0) {
    return false;
  }
  const probeDir = mkdtempSync(path.join(os.tmpdir(), "remanga-makensis-probe-"));
  try {
    const probeScript = path.join(probeDir, "probe.nsi");
    writeFileSync(
      probeScript,
      'OutFile "probe.exe"\nName "probe"\nSection\nSectionEnd\n',
    );
    const compile = spawnSync("makensis", [probeScript], {
      cwd: probeDir,
      encoding: "utf8",
      timeout: 15_000,
    });
    return compile.status === 0;
  } finally {
    rmSync(probeDir, { recursive: true, force: true });
  }
})();

test("build-installer-windows produces payload + Setup.exe", { timeout: 360_000 }, (t) => {
  if (!hasWorkingMakensis) {
    t.skip("makensis missing or non-functional (e.g. Homebrew arm64 makensis 3.12 std::bad_alloc) -- run via .github/workflows/build-windows-installer.yml on Linux instead");
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
  // zlib-compressed installer should be ~25-40 MB (LZMA OOMs on arm64; see installer.nsi comment).
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
  // Only meaningful when makensis genuinely isn't installed (or is broken). When a
  // working makensis is present, the preflight passes and we can't observe the error
  // message; skip rather than asserting nothing.
  const installed = spawnSync("makensis", ["-VERSION"], { encoding: "utf8" }).status === 0;
  if (installed) {
    return;
  }

  const result = spawnSync(process.execPath, [buildScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0, "must fail when makensis missing");
  assert.match(
    result.stderr + result.stdout,
    /brew install makensis|apt-get install -y nsis/,
    "error message must point at the platform install command",
  );
});
