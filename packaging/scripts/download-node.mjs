#!/usr/bin/env node
import { mkdirSync, existsSync, createWriteStream, copyFileSync, chmodSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const buildDir = path.join(repoRoot, "packaging/build");
const cacheDir = path.join(repoRoot, "packaging/cache");
const outputBinary = path.join(buildDir, "node");

const NODE_VERSION = "v20.20.1";
const NODE_PLATFORM = "darwin-arm64";
const archiveName = `node-${NODE_VERSION}-${NODE_PLATFORM}.tar.gz`;
const downloadUrl = `https://nodejs.org/dist/${NODE_VERSION}/${archiveName}`;
const cachedArchive = path.join(cacheDir, archiveName);
const extractedDir = path.join(cacheDir, `node-${NODE_VERSION}-${NODE_PLATFORM}`);

mkdirSync(buildDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const ensureMinSize = (file, minBytes) => existsSync(file) && statSync(file).size >= minBytes;

if (!ensureMinSize(cachedArchive, 10_000_000)) {
  console.log(`Downloading ${downloadUrl}`);
  const response = await fetch(downloadUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download Node: HTTP ${response.status}`);
  }
  const tmpPath = `${cachedArchive}.tmp`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(tmpPath));
  // atomic replace
  spawnSync("mv", [tmpPath, cachedArchive], { stdio: "inherit" });
} else {
  console.log(`Using cached archive ${path.relative(repoRoot, cachedArchive)}`);
}

if (!existsSync(path.join(extractedDir, "bin/node"))) {
  console.log("Extracting Node archive…");
  await rm(extractedDir, { recursive: true, force: true });
  const extractResult = spawnSync(
    "tar",
    ["-xzf", cachedArchive, "-C", cacheDir],
    { stdio: "inherit" },
  );
  if (extractResult.status !== 0) {
    throw new Error("tar extraction failed");
  }
}

const sourceBinary = path.join(extractedDir, "bin/node");
if (!existsSync(sourceBinary)) {
  throw new Error(`Expected ${sourceBinary} after extraction`);
}

copyFileSync(sourceBinary, outputBinary);
chmodSync(outputBinary, 0o755);

console.log(`Node binary → ${path.relative(repoRoot, outputBinary)}`);
