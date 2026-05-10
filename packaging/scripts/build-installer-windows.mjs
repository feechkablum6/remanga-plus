#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync, cpSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const buildDir = path.join(repoRoot, "packaging/build-windows");
const templatesDir = path.join(repoRoot, "packaging/templates");
const installerExe = path.join(buildDir, "Remanga-Plus-Setup.exe");

const log = (msg) => console.log(`▸ ${msg}`);

const run = (cmd, args, opts = {}) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: repoRoot, ...opts });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}`);
  }
};

const computeExtensionIdFromKey = (base64Key) =>
  createHash("sha256")
    .update(Buffer.from(base64Key, "base64"))
    .digest("hex")
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (h) => String.fromCharCode(97 + Number.parseInt(h, 16)));

// Pre-flight: makensis must be installed. Fail fast and helpful.
const makensisCheck = spawnSync("makensis", ["-VERSION"], { encoding: "utf8" });
if (makensisCheck.status !== 0) {
  const installHint =
    process.platform === "linux"
      ? "  sudo apt-get install -y nsis"
      : "  brew install makensis";
  console.error(
    `makensis not found. Install with:\n${installHint}\n` +
      "Then re-run `npm run pkg:windows`.\n\n" +
      "Note: on macOS Tahoe arm64, the Homebrew makensis 3.12 bottle is broken " +
      "(std::bad_alloc on every script). Build via the GitHub Actions workflow " +
      ".github/workflows/build-windows-installer.yml instead — it runs on Linux " +
      "where nsis works.",
  );
  process.exit(1);
}

// 1. Build extension (vite).
log("Building extension (vite)…");
run("npm", ["run", "build"]);

// 2. Bundle parser-server and host (reuse macOS bundlers — platform-neutral output).
log("Bundling parser-server…");
run(process.execPath, [path.join(repoRoot, "packaging/scripts/bundle-parser.mjs")]);

log("Bundling native host…");
run(process.execPath, [path.join(repoRoot, "packaging/scripts/bundle-host.mjs")]);

// 3. Download Windows Node binary into packaging/build-windows/.
log("Ensuring Windows Node binary…");
run(process.execPath, [path.join(repoRoot, "packaging/scripts/download-node-windows.mjs")]);

// 4. Assemble payload directory layout that installer.nsi expects.
log("Assembling Windows payload…");
mkdirSync(buildDir, { recursive: true });

// Bundles produced by step 2-3 land in packaging/build/* — copy into build-windows/.
const sharedBuildDir = path.join(repoRoot, "packaging/build");
copyFileSync(path.join(sharedBuildDir, "parser-server.js"), path.join(buildDir, "parser-server.js"));
copyFileSync(path.join(sharedBuildDir, "host.js"), path.join(buildDir, "host.js"));
copyFileSync(path.join(templatesDir, "host.bat"), path.join(buildDir, "host.bat"));

const distSource = path.join(repoRoot, "dist");
if (!existsSync(distSource)) {
  throw new Error("dist/ missing after vite build");
}
const targetExtension = path.join(buildDir, "extension");
rmSync(targetExtension, { recursive: true, force: true });
cpSync(distSource, targetExtension, { recursive: true });

// 5. Resolve extension id from the extension's manifest.json (the same source the macOS postinstall uses).
const extensionManifest = JSON.parse(
  readFileSync(path.join(targetExtension, "manifest.json"), "utf8"),
);
if (typeof extensionManifest.key !== "string" || extensionManifest.key.length === 0) {
  throw new Error('extension/manifest.json must include a "key" field for stable extension id');
}
const extensionId = computeExtensionIdFromKey(extensionManifest.key);

// 6. Resolve version from package.json.
const pkgJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const version = pkgJson.version;

// 7. Copy installer.nsi into payload dir so File "..." paths resolve relative to it.
const nsiSource = path.join(templatesDir, "installer.nsi");
const nsiInPayload = path.join(buildDir, "installer.nsi");
copyFileSync(nsiSource, nsiInPayload);

// 8. Run makensis with -DEXTENSION_ID and -DVERSION.
log(`Running makensis (extension id = ${extensionId}, version = ${version})…`);
run(
  "makensis",
  [
    `-DEXTENSION_ID=${extensionId}`,
    `-DVERSION=${version}`,
    "installer.nsi",
  ],
  { cwd: buildDir },
);

if (!existsSync(installerExe)) {
  throw new Error(`Expected installer at ${installerExe}, but it was not produced`);
}

log(`✅ Built ${path.relative(repoRoot, installerExe)}`);
