import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const buildScript = path.join(repoRoot, "packaging/scripts/build-pkg.mjs");
const payloadRoot = path.join(repoRoot, "packaging/build/payload-root");
const installDir = path.join(payloadRoot, "Applications/Remanga Plus");
const pkgPath = path.join(repoRoot, "packaging/build/Remanga-Plus.pkg");

test("build-pkg produces a payload with all required components", { timeout: 240_000 }, () => {
  rmSync(payloadRoot, { recursive: true, force: true });
  rmSync(pkgPath, { force: true });

  const result = spawnSync(process.execPath, [buildScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `build-pkg failed: ${result.stderr}\n${result.stdout}`);

  // Payload structure
  for (const f of ["node", "host.js", "host", "parser-server.js", "extension/manifest.json"]) {
    const p = path.join(installDir, f);
    assert.ok(existsSync(p), `missing payload file: ${f}`);
  }

  // host shim is executable
  const hostShimMode = statSync(path.join(installDir, "host")).mode;
  assert.ok((hostShimMode & 0o111) !== 0, "host shim must be executable");

  // node binary is executable
  const nodeMode = statSync(path.join(installDir, "node")).mode;
  assert.ok((nodeMode & 0o111) !== 0, "node binary must be executable");

  // Extension contains its built content scripts (vite output)
  const extManifest = JSON.parse(
    readFileSync(path.join(installDir, "extension/manifest.json"), "utf8"),
  );
  assert.equal(extManifest.manifest_version, 3);
  assert.ok(typeof extManifest.key === "string" && extManifest.key.length > 0);

  // Final .pkg file exists and is non-trivial in size
  assert.ok(existsSync(pkgPath), "missing final .pkg");
  assert.ok(statSync(pkgPath).size > 30_000_000, "final .pkg suspiciously small");
});
