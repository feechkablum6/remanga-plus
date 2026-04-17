#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { computeExtensionIdFromKey } from "./extension-id.js";

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
  --extension-id <id>     Explicit Chrome extension id for allowed_origins
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

const readManifestKey = (manifestPath: string): string => {
  const raw = readFileSync(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as { key?: unknown };
  if (typeof parsed.key !== "string" || parsed.key.length === 0) {
    throw new Error(
      `Manifest ${manifestPath} does not contain a "key" field required for a deterministic extension id.`,
    );
  }
  return parsed.key;
};

const resolveExtensionId = (): string => {
  const explicit = getArgumentValue("--extension-id");
  if (explicit) {
    return explicit;
  }

  const manifestPath = getArgumentValue("--from-manifest") ?? defaultManifestPath;
  return computeExtensionIdFromKey(readManifestKey(manifestPath));
};

if (process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

if (process.platform !== "darwin") {
  console.error("install-macos.ts supports only macOS.");
  process.exit(1);
}

let extensionId: string;
try {
  extensionId = resolveExtensionId();
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

  const manifest = readFileSync(templatePath, "utf8")
    .replace(/__HOST_PATH__/g, hostPath)
    .replace(/__EXTENSION_ID__/g, extensionId);

  writeFileSync(manifestOutputPath, manifest);
  return manifestOutputPath;
};

buildParserServer();
const builtHostPath = buildNativeHost();
const manifestPath = installManifest(builtHostPath);

console.log(`Native host installed.
Extension id: ${extensionId}
Host executable: ${builtHostPath}
Chrome manifest: ${manifestPath}`);
