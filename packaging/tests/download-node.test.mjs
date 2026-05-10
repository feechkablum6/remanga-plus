import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const downloadScript = path.join(repoRoot, "packaging/scripts/download-node.mjs");
const cacheDir = path.join(repoRoot, "packaging/cache");
const nodeBinPath = path.join(repoRoot, "packaging/build/node");

test("download-node fetches arm64 darwin Node binary into build dir", { timeout: 120_000 }, () => {
  rmSync(nodeBinPath, { force: true });

  const result = spawnSync(process.execPath, [downloadScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `download failed: ${result.stderr}\n${result.stdout}`);
  assert.ok(existsSync(nodeBinPath), "node binary not placed at packaging/build/node");

  const stats = statSync(nodeBinPath);
  assert.ok(stats.size > 30_000_000, `node binary suspiciously small: ${stats.size}`);
  assert.ok((stats.mode & 0o111) !== 0, "node binary should be executable");

  const versionResult = spawnSync(nodeBinPath, ["--version"], { encoding: "utf8" });
  assert.equal(versionResult.status, 0, `node --version failed: ${versionResult.stderr}`);
  assert.match(versionResult.stdout.trim(), /^v(20|21|22|23)\./);

  assert.ok(existsSync(cacheDir), "cache dir should exist");
});
