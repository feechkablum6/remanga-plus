#!/usr/bin/env node
import { mkdirSync, existsSync, createWriteStream, copyFileSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const buildDir = path.join(repoRoot, "packaging/build-windows");
const cacheDir = path.join(repoRoot, "packaging/cache");
const outputBinary = path.join(buildDir, "node.exe");

const NODE_VERSION = "v20.20.1";
const NODE_PLATFORM = "win-x64";
const archiveName = `node-${NODE_VERSION}-${NODE_PLATFORM}.zip`;
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
  spawnSync("mv", [tmpPath, cachedArchive], { stdio: "inherit" });
} else {
  console.log(`Using cached archive ${path.relative(repoRoot, cachedArchive)}`);
}

const extractedNodeExe = path.join(extractedDir, "node.exe");

if (!existsSync(extractedNodeExe)) {
  console.log("Extracting Node archive (unzip)…");
  await rm(extractedDir, { recursive: true, force: true });
  // Use macOS / Linux unzip; available on all Macs by default.
  const unzip = spawnSync("unzip", ["-q", cachedArchive, "-d", cacheDir], {
    stdio: "inherit",
  });
  if (unzip.status !== 0) {
    throw new Error("unzip extraction failed");
  }
}

if (!existsSync(extractedNodeExe)) {
  throw new Error(`Expected ${extractedNodeExe} after extraction`);
}

copyFileSync(extractedNodeExe, outputBinary);
console.log(`Node binary → ${path.relative(repoRoot, outputBinary)}`);
