#!/usr/bin/env node

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const sourcePath = path.join(repoRoot, "native-host/windows-launcher.c");
const outputDirectory = path.join(repoRoot, "packaging/build");
const outputPath = path.join(outputDirectory, "host.exe");
const compiler = process.env.REMANGA_MINGW_CC ?? "x86_64-w64-mingw32-gcc";

if (!existsSync(sourcePath)) {
  throw new Error(`Missing Windows launcher source: ${sourcePath}`);
}

const compilerCheck = spawnSync(compiler, ["--version"], { encoding: "utf8" });
if (compilerCheck.status !== 0) {
  console.error(
    `${compiler} not found. Install MinGW-w64 with:\n` +
      "  sudo apt-get install -y gcc-mingw-w64-x86-64\n",
  );
  process.exit(1);
}

mkdirSync(outputDirectory, { recursive: true });

const result = spawnSync(
  compiler,
  [
    "-std=c11",
    "-Os",
    "-s",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-municode",
    "-mwindows",
    "-static-libgcc",
    sourcePath,
    "-o",
    outputPath,
  ],
  { cwd: repoRoot, stdio: "inherit" },
);

if (result.status !== 0) {
  throw new Error(`${compiler} exited ${result.status}`);
}

if (!existsSync(outputPath)) {
  throw new Error(`Expected Windows launcher at ${outputPath}`);
}

console.log(`Built ${path.relative(repoRoot, outputPath)}`);
