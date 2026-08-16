import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const launcherSourcePath = path.join(repoRoot, "native-host/windows-launcher.c");
const buildScriptPath = path.join(
  repoRoot,
  "packaging/scripts/build-windows-launcher.mjs",
);
const installerBuildScriptPath = path.join(
  repoRoot,
  "packaging/scripts/build-installer-windows.mjs",
);
const workflowPath = path.join(
  repoRoot,
  ".github/workflows/build-windows-installer.yml",
);
const packageJsonPath = path.join(repoRoot, "package.json");

test("windows launcher uses a real Win32 process with inherited native messaging streams", () => {
  assert.ok(existsSync(launcherSourcePath), "missing native-host/windows-launcher.c");

  const source = readFileSync(launcherSourcePath, "utf8");
  assert.match(source, /CreateProcessW\s*\(/, "must start bundled Node through CreateProcessW");
  assert.match(source, /STARTF_USESTDHANDLES/, "must explicitly pass Chrome standard streams");
  assert.match(source, /GetStdHandle\s*\(\s*STD_INPUT_HANDLE\s*\)/, "must inherit Chrome stdin");
  assert.match(source, /GetStdHandle\s*\(\s*STD_OUTPUT_HANDLE\s*\)/, "must inherit Chrome stdout");
  assert.match(source, /CREATE_NO_WINDOW/, "must not flash a console window");
  assert.match(source, /REMANGA_PARSER_BUNDLE/, "must configure the parser bundle path");
  assert.match(source, /REMANGA_NODE_BIN/, "must configure the bundled Node path");
  assert.match(source, /REMANGA_PARSER_CACHE_DIR/, "must configure a per-user cache path");
});

test("windows launcher build script cross-compiles host.exe with MinGW-w64", () => {
  assert.ok(
    existsSync(buildScriptPath),
    "missing packaging/scripts/build-windows-launcher.mjs",
  );

  const source = readFileSync(buildScriptPath, "utf8");
  assert.match(source, /x86_64-w64-mingw32-gcc/, "must use the x64 MinGW-w64 compiler");
  assert.match(source, /windows-launcher\.c/, "must compile the Win32 launcher source");
  assert.match(source, /host\.exe/, "must produce host.exe");
  assert.match(source, /-municode/, "must use the Unicode Windows entry point");
  assert.match(source, /-mwindows/, "must build without a console window");
});

test("Windows installer build compiles and copies host.exe", () => {
  const source = readFileSync(installerBuildScriptPath, "utf8");
  assert.match(
    source,
    /build-windows-launcher\.mjs/,
    "must build the Windows native launcher",
  );
  assert.match(
    source,
    /sharedBuildDir,\s*"host\.exe"/,
    "must copy the compiled launcher from the shared build directory",
  );
});

test("Windows installer workflow installs the MinGW-w64 compiler", () => {
  const workflow = readFileSync(workflowPath, "utf8");
  assert.match(
    workflow,
    /gcc-mingw-w64-x86-64/,
    "CI must install the x64 MinGW-w64 compiler",
  );
  assert.match(
    workflow,
    /x86_64-w64-mingw32-gcc\s+--version/,
    "CI must verify the cross-compiler",
  );
});

test("Windows packaging tests run sequentially because they share build output", () => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  assert.match(
    packageJson.scripts["pkg:windows:test"],
    /--test-concurrency=1/,
    "packaging tests must not write packaging/build-windows concurrently",
  );
});
