#!/usr/bin/env node
import { existsSync, mkdirSync, copyFileSync, chmodSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const buildDir = path.join(repoRoot, "packaging/build");
const payloadRoot = path.join(buildDir, "payload-root");
const installDirRel = "Applications/Remanga Plus";
const installDir = path.join(payloadRoot, installDirRel);
const scriptsDir = path.join(buildDir, "pkg-scripts");
const componentPkg = path.join(buildDir, "core.pkg");
const finalPkg = path.join(buildDir, "Remanga-Plus.pkg");
const distributionTemplate = path.join(repoRoot, "packaging/templates/Distribution.xml");
const distributionFile = path.join(buildDir, "Distribution.xml");

const run = (cmd, args, opts = {}) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: repoRoot, ...opts });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}`);
  }
};

const log = (msg) => console.log(`▸ ${msg}`);

// 1. Build the extension (vite) so dist/ is fresh.
log("Building extension (vite)…");
run("npm", ["run", "build"]);

// 2. Bundle parser-server and host.
log("Bundling parser-server…");
run(process.execPath, [path.join(repoRoot, "packaging/scripts/bundle-parser.mjs")]);

log("Bundling native host…");
run(process.execPath, [path.join(repoRoot, "packaging/scripts/bundle-host.mjs")]);

// 3. Download/cache Node binary.
log("Ensuring Node binary…");
run(process.execPath, [path.join(repoRoot, "packaging/scripts/download-node.mjs")]);

// 4. Assemble payload.
log("Assembling payload…");
rmSync(payloadRoot, { recursive: true, force: true });
mkdirSync(installDir, { recursive: true });

copyFileSync(path.join(buildDir, "node"), path.join(installDir, "node"));
chmodSync(path.join(installDir, "node"), 0o755);

copyFileSync(path.join(buildDir, "parser-server.js"), path.join(installDir, "parser-server.js"));
copyFileSync(path.join(buildDir, "host.js"), path.join(installDir, "host.js"));

copyFileSync(path.join(repoRoot, "packaging/templates/host-shim.sh"), path.join(installDir, "host"));
chmodSync(path.join(installDir, "host"), 0o755);

const distSource = path.join(repoRoot, "dist");
if (!existsSync(distSource)) {
  throw new Error("dist/ missing after vite build");
}
cpSync(distSource, path.join(installDir, "extension"), { recursive: true });

// Pretty README inside install dir for the user.
writeFileSync(
  path.join(installDir, "README.txt"),
  [
    "ReManga Plus",
    "",
    "Эта папка содержит локальный parser-server для Premium Free.",
    "Если хотите удалить полностью — удалите всю папку 'Remanga Plus'",
    "из /Applications и удалите файл",
    "  ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/org.remanga.parser_host.json",
    "(аналогично для других Chromium-браузеров).",
    "",
    "Расширение для Chrome лежит в подпапке 'extension'.",
    "Откройте chrome://extensions, включите режим разработчика и",
    "перетащите туда папку 'extension'.",
    "",
  ].join("\n"),
);

// 5. Stage scripts dir.
log("Staging postinstall script…");
rmSync(scriptsDir, { recursive: true, force: true });
mkdirSync(scriptsDir, { recursive: true });
copyFileSync(
  path.join(repoRoot, "packaging/templates/postinstall"),
  path.join(scriptsDir, "postinstall"),
);
chmodSync(path.join(scriptsDir, "postinstall"), 0o755);

// 6. Resolve version from package.json.
const pkgJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const version = pkgJson.version;

// 7. pkgbuild → component .pkg
log("Running pkgbuild…");
run("pkgbuild", [
  "--root", payloadRoot,
  "--identifier", "org.remanga.plus.core",
  "--version", version,
  "--scripts", scriptsDir,
  "--install-location", "/",
  componentPkg,
]);

// 8. productbuild → final distribution .pkg
log("Running productbuild…");
const distContent = readFileSync(distributionTemplate, "utf8").replace(
  /(<pkg-ref [^>]*?version=")[^"]+(")/g,
  `$1${version}$2`,
);
writeFileSync(distributionFile, distContent);

run("productbuild", [
  "--distribution", distributionFile,
  "--package-path", buildDir,
  finalPkg,
]);

log(`✅ Built ${path.relative(repoRoot, finalPkg)}`);
