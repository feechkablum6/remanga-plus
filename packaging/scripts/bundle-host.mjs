#!/usr/bin/env node
import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const buildDir = path.join(repoRoot, "packaging/build");
const entryPoint = path.join(repoRoot, "native-host/host.ts");
const outputPath = path.join(buildDir, "host.js");

mkdirSync(buildDir, { recursive: true });

const require = createRequire(path.join(repoRoot, "parser-server/package.json"));
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
      "import { createRequire as __cr } from 'node:module';",
      "const require = __cr(import.meta.url);",
    ].join("\n"),
  },
  minify: false,
  sourcemap: false,
  logLevel: "info",
});

console.log(`Bundled native host → ${path.relative(repoRoot, outputPath)}`);
