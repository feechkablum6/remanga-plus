#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { resolveExtensionIds } from "./extension-id.js";
import { rewriteShebangInterpreter } from "./shebang.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const nativeHostDirectory = currentDirectory;
const repositoryRoot = path.resolve(currentDirectory, "..");
const chromeNativeHostDirectory = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome/NativeMessagingHosts",
);
const nativeHostName = "org.remanga.parser_host";
const defaultManifestPath = path.join(repositoryRoot, "public/manifest.json");

const printHelp = (): void => {
  console.log(`Usage:
  npm run native:install
  npm run native:install -- --extension-id <chrome-extension-id>
  npm run native:install -- --from-manifest <path>

Options:
  --extension-id <id>     Extra Chrome extension id to allow in addition to the derived one
                          (can be passed multiple times)
  --from-manifest <path>  Derive the id from the manifest "key" (default: public/manifest.json)
  --help                  Show this help
`);
};

const getArgumentValue = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
};

const collectArgumentValues = (flag: string): string[] => {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && index + 1 < process.argv.length) {
      values.push(process.argv[index + 1]);
    }
  }
  return values;
};

const readManifestKey = (manifestPath: string): string | null => {
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as { key?: unknown };
  return typeof parsed.key === "string" && parsed.key.length > 0
    ? parsed.key
    : null;
};

const resolveInstallerIds = (): string[] => {
  const manifestPath = getArgumentValue("--from-manifest") ?? defaultManifestPath;
  const manifestKey = existsSync(manifestPath) ? readManifestKey(manifestPath) : null;
  const explicitIds = collectArgumentValues("--extension-id");
  return resolveExtensionIds(manifestKey, explicitIds);
};

if (process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

if (process.platform !== "darwin") {
  console.error("install-macos.ts supports only macOS.");
  process.exit(1);
}

let extensionIds: string[];
try {
  extensionIds = resolveInstallerIds();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  printHelp();
  process.exit(1);
}

const run = (command: string, args: string[], cwd = repositoryRoot): void => {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
  });
};

const buildNativeHost = (): string => {
  run("npx", ["tsc", "-p", "native-host/tsconfig.json"]);
  const builtHostPath = path.join(nativeHostDirectory, "dist/host.js");
  const patched = rewriteShebangInterpreter(
    readFileSync(builtHostPath, "utf8"),
    process.execPath,
  );
  writeFileSync(builtHostPath, patched);
  chmodSync(builtHostPath, 0o755);
  return builtHostPath;
};

const ensureParserServerDependencies = (): void => {
  const parserNodeModules = path.join(repositoryRoot, "parser-server/node_modules");
  if (existsSync(parserNodeModules)) {
    return;
  }

  run("npm", ["install"], path.join(repositoryRoot, "parser-server"));
};

const buildParserServer = (): void => {
  ensureParserServerDependencies();
  run("npm", ["run", "build"], path.join(repositoryRoot, "parser-server"));
};

const installManifest = (hostPath: string): string => {
  mkdirSync(chromeNativeHostDirectory, { recursive: true });
  const templatePath = path.join(nativeHostDirectory, "native-host-manifest.json");
  const manifestOutputPath = path.join(
    chromeNativeHostDirectory,
    `${nativeHostName}.json`,
  );

  const template = JSON.parse(readFileSync(templatePath, "utf8")) as Record<
    string,
    unknown
  >;
  template.path = hostPath;
  template.allowed_origins = extensionIds.map((id) => `chrome-extension://${id}/`);

  writeFileSync(manifestOutputPath, `${JSON.stringify(template, null, 2)}\n`);
  return manifestOutputPath;
};

buildParserServer();
const builtHostPath = buildNativeHost();
const manifestPath = installManifest(builtHostPath);

console.log(`Native host installed.
Extension ids: ${extensionIds.join(", ")}
Host executable: ${builtHostPath}
Chrome manifest: ${manifestPath}`);
