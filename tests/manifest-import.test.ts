import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("public/manifest.json"), "utf8"));

test("host_permissions cover api.cdnlibs.org, mangalib.me, api.remanga.org", () => {
  const hp = manifest.host_permissions as string[];
  assert.ok(hp.some((p) => p.includes("api.cdnlibs.org")));
  assert.ok(hp.some((p) => p.includes("mangalib.me")));
  assert.ok(hp.some((p) => p.includes("api.remanga.org")));
});

test("permissions include cookies", () => {
  const p = manifest.permissions as string[];
  assert.ok(p.includes("cookies"));
  assert.ok(p.includes("storage"));
  assert.ok(p.includes("nativeMessaging"));
});

test("content_scripts has both remanga and mangalib entries", () => {
  const cs = manifest.content_scripts as Array<{ matches: string[]; js: string[] }>;
  assert.ok(cs.some((s) => s.matches.some((m) => m.includes("remanga.org")) && s.js.includes("content.js")));
  assert.ok(cs.some((s) => s.matches.some((m) => m.includes("mangalib.me")) && s.js.includes("mangalib-bridge.js")));
});

test("manifest preserves existing key field", () => {
  assert.ok(typeof manifest.key === "string" && manifest.key.length > 0);
});
