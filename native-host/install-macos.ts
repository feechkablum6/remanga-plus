#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const nativeHostDirectory = currentDirectory;
const repositoryRoot = path.resolve(currentDirectory, "..");
const chromeNativeHostDirectory = path.join(
  os.homedir(),
  "Library/Application Support/Google/Chrome/NativeMessagingHosts",
);
const nativeHostName = "org.remanga.parser_host";

const printHelp = (): void => {
  console.log(`Usage:
  npm run native:install -- --extension-id <chrome-extension-id>

Options:
  --extension-id <id>   Required Chrome extension id used in allowed_origins
  --help                Show this help
`);
};

const getArgumentValue = (flag: string): string | null => {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
};

const extensionId = getArgumentValue("--extension-id");

if (process.argv.includes("--help")) {
  printHelp();
  process.exit(0);
}

if (process.platform !== "darwin") {
  console.error("install-macos.ts supports only macOS.");
  process.exit(1);
}

if (!extensionId) {
  console.error("Missing required --extension-id <id>.");
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
