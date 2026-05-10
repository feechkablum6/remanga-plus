#!/usr/bin/env node
import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const parserRoot = path.join(repoRoot, "parser-server");
const outputDir = path.join(repoRoot, "packaging/build");
const outputPath = path.join(outputDir, "parser-server.js");
const entryPoint = path.join(parserRoot, "src/index.ts");

mkdirSync(outputDir, { recursive: true });

const require = createRequire(path.join(parserRoot, "package.json"));
const esbuild = require("esbuild");

await esbuild.build({
  entryPoints: [entryPoint],
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
