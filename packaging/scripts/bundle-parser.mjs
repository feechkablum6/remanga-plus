#!/usr/bin/env node
import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const parserRoot = path.join(repoRoot, "parser-server");
const outputDir = path.join(repoRoot, "packaging/build");
const outputPath = path.join(outputDir, "parser-server.js");
// Bundle from the tsc-compiled JS, not from .ts sources. parser-server uses
// NodeNext-style imports with explicit ".js" extensions ("./cache/file-cache.js"),
// which esbuild cannot resolve to .ts source files on a fresh checkout.
const compiledEntry = path.join(parserRoot, "dist/index.js");

mkdirSync(outputDir, { recursive: true });

const require = createRequire(path.join(parserRoot, "package.json"));
const esbuild = require("esbuild");

// Always refresh parser-server/dist before bundling so installers never ship a
// stale parser-server.js from a previous local build.
const tsc = spawnSync("npx", ["tsc", "-p", "tsconfig.json"], {
  cwd: parserRoot,
  stdio: "inherit",
});
if (tsc.status !== 0) {
  throw new Error(`tsc -p parser-server/tsconfig.json exited ${tsc.status}`);
}

await esbuild.build({
  entryPoints: [compiledEntry],
  outfile: outputPath,
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  banner: {
    js: [
      "// manga-chapter-parser bundle (esbuild)",
      "import { createRequire as __cr } from 'node:module';",
      "const require = __cr(import.meta.url);",
    ].join("\n"),
  },
  external: [],
  minify: false,
  sourcemap: false,
  logLevel: "info",
});

console.log(`Bundled parser-server → ${path.relative(repoRoot, outputPath)}`);
