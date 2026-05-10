import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, statSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const bundleScript = path.join(repoRoot, "packaging/scripts/bundle-parser.mjs");
const outputPath = path.join(repoRoot, "packaging/build/parser-server.js");

test("bundle-parser script produces a single executable JS bundle", () => {
  rmSync(outputPath, { force: true });

  const result = spawnSync(process.execPath, [bundleScript], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `bundling failed: ${result.stderr}`);
  assert.ok(existsSync(outputPath), "bundle output missing");

  const stats = statSync(outputPath);
  assert.ok(stats.size > 100_000, `bundle suspiciously small: ${stats.size} bytes`);

  const contents = readFileSync(outputPath, "utf8");
  assert.match(contents, /fastify/i, "bundle should contain inlined fastify");
  assert.match(contents, /manga-chapter-parser|buildApp/, "bundle should contain parser-server entry");
});
