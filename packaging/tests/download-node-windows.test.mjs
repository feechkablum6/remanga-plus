import { test } from "node:test";
import assert from "node:assert/strict";
import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const downloadScript = path.join(repoRoot, "packaging/scripts/download-node-windows.mjs");
const cacheDir = path.join(repoRoot, "packaging/cache");
const nodeExePath = path.join(repoRoot, "packaging/build-windows/node.exe");

test("download-node-windows accepts an explicit offline Windows Node binary", () => {
  const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "remanga-node-override-"));
  const sourceBinary = path.join(tempDirectory, "node.exe");
  const sourceFd = openSync(sourceBinary, "w");
  try {
    writeSync(sourceFd, Buffer.from("MZ"), 0, 2, 0);
    ftruncateSync(sourceFd, 30_000_001);
  } finally {
    closeSync(sourceFd);
  }

  rmSync(nodeExePath, { force: true });
  const result = spawnSync(process.execPath, [downloadScript], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      REMANGA_WINDOWS_NODE_BIN: sourceBinary,
    },
  });

  try {
    assert.equal(result.status, 0, `offline copy failed: ${result.stderr}\n${result.stdout}`);
    assert.equal(statSync(nodeExePath).size, 30_000_001);
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test("download-node-windows fetches win-x64 Node and extracts node.exe", { timeout: 180_000 }, () => {
  rmSync(nodeExePath, { force: true });

  const result = spawnSync(process.execPath, [downloadScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `download failed: ${result.stderr}\n${result.stdout}`);
  assert.ok(existsSync(nodeExePath), "node.exe not placed at packaging/build-windows/node.exe");

  const stats = statSync(nodeExePath);
  // Windows node.exe ~50 MB.
  assert.ok(stats.size > 30_000_000, `node.exe suspiciously small: ${stats.size}`);

  // PE header check: every Windows .exe starts with "MZ".
  const fd = openSync(nodeExePath, "r");
  try {
    const buf = Buffer.alloc(2);
    readSync(fd, buf, 0, 2, 0);
    assert.equal(buf.toString("ascii"), "MZ", "node.exe must have PE/MZ magic header");
  } finally {
    closeSync(fd);
  }

  assert.ok(existsSync(cacheDir), "cache dir should exist");
});
