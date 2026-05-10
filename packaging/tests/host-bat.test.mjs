import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const hostBatPath = path.join(repoRoot, "packaging/templates/host.bat");

test("host.bat is self-relative and forwards args to bundled node", () => {
  const content = readFileSync(hostBatPath, "utf8");

  // Disable echo so Native Messaging stdout stays clean.
  assert.match(content, /^@echo off/m, "must start with @echo off");

  // Resolve all paths relative to the .bat's own directory.
  assert.match(content, /%~dp0parser-server\.js/, "must reference %~dp0parser-server.js");
  assert.match(content, /%~dp0node\.exe/, "must reference %~dp0node.exe");
  assert.match(content, /%~dp0host\.js/, "must reference %~dp0host.js");

  // Three env vars the existing host.ts expects.
  assert.match(content, /set\s+"REMANGA_PARSER_BUNDLE=/, "must set REMANGA_PARSER_BUNDLE");
  assert.match(content, /set\s+"REMANGA_NODE_BIN=/, "must set REMANGA_NODE_BIN");
  assert.match(content, /set\s+"REMANGA_PARSER_CACHE_DIR=/, "must set REMANGA_PARSER_CACHE_DIR");

  // Cache dir must live under per-user LOCALAPPDATA, not in the install dir.
  assert.match(content, /%LOCALAPPDATA%\\Remanga Plus\\cache/, "cache dir must be under %LOCALAPPDATA%");

  // Cache dir must be created if missing (mkdir is idempotent with `if not exist`).
  assert.match(content, /if not exist[^\r\n]+mkdir/i, "must create cache dir if missing");

  // Forward all args ( %* ) so Chrome's origin URL and parent window handle reach host.js.
  assert.match(content, /node\.exe"\s+"%~dp0host\.js"\s+%\*/, "must exec node host.js %*");

  // Quoting check: every %~dp0 reference must be inside double quotes (paths with spaces).
  const dpRefs = content.match(/%~dp0[A-Za-z0-9._-]+/g) ?? [];
  assert.ok(dpRefs.length >= 3, "expected at least 3 %~dp0 references");
  for (const ref of dpRefs) {
    const quoted = new RegExp(`"[^"\\n]*${ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"\\n]*"`);
    assert.match(content, quoted, `${ref} must be inside double quotes for paths with spaces`);
  }
});
