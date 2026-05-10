import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const nsiPath = path.join(repoRoot, "packaging/templates/installer.nsi");

const HOST_NAME = "org.remanga.parser_host";

const BROWSER_REG_KEYS = [
  "Software\\Google\\Chrome",
  "Software\\Google\\Chrome Beta",
  "Software\\Google\\Chrome Dev",
  "Software\\Google\\Chrome SxS",
  "Software\\Microsoft\\Edge",
  "Software\\BraveSoftware\\Brave-Browser",
  "Software\\Vivaldi",
  "Software\\Chromium",
  "Software\\Yandex\\YandexBrowser",
  "Software\\Opera Software\\Opera Stable",
];

test("installer.nsi has correct top-level config", () => {
  const nsi = readFileSync(nsiPath, "utf8");

  assert.match(nsi, /RequestExecutionLevel\s+user/, "must request user-level (no UAC)");
  assert.match(nsi, /InstallDir\s+"\$LOCALAPPDATA\\Programs\\Remanga Plus"/, "default InstallDir under LOCALAPPDATA");
  assert.match(nsi, /OutFile\s+"Remanga-Plus-Setup\.exe"/, "must produce Remanga-Plus-Setup.exe");
  assert.match(nsi, /SetCompressor\s+\/SOLID\s+lzma/, "use solid LZMA compression");
  assert.match(nsi, /!define\s+APPNAME\s+"Remanga Plus"/, "must define APPNAME");
  assert.match(nsi, new RegExp(`!define\\s+HOSTNAME\\s+"${HOST_NAME.replace(/\./g, "\\.")}"`), "must define HOSTNAME");
});

test("installer.nsi install section copies all payload files", () => {
  const nsi = readFileSync(nsiPath, "utf8");

  // The install section must File-include each artefact.
  for (const f of ["node.exe", "parser-server.js", "host.js", "host.bat"]) {
    assert.match(nsi, new RegExp(`File\\s+"${f}"`), `install section must File "${f}"`);
  }
  assert.match(nsi, /File\s+\/r\s+"extension"/, "install section must File /r extension");
});

test("installer.nsi generates nm-manifest.json with EXTENSION_ID and abs host path", () => {
  const nsi = readFileSync(nsiPath, "utf8");

  // Manifest write block.
  assert.match(nsi, /FileOpen\s+\$0\s+"\$INSTDIR\\nm-manifest\.json"\s+w/, "must open nm-manifest.json for writing");
  assert.match(nsi, /\$\{HOSTNAME\}/, "manifest body must reference HOSTNAME");
  assert.match(nsi, /\$INSTDIR\\\\host\.bat/, "manifest body must reference $INSTDIR\\host.bat");
  assert.match(nsi, /chrome-extension:\/\/\$\{EXTENSION_ID\}\//, "manifest body must reference EXTENSION_ID");
  assert.match(nsi, /FileClose\s+\$0/, "must close manifest file");
});

test("installer.nsi registers Native Messaging in HKCU for all known Chromium browsers", () => {
  const nsi = readFileSync(nsiPath, "utf8");

  for (const key of BROWSER_REG_KEYS) {
    const escaped = key.replace(/\\/g, "\\\\").replace(/[.*+?^${}()|[\]]/g, "\\$&");
    const writeRe = new RegExp(
      `WriteRegStr\\s+HKCU\\s+"${escaped}\\\\NativeMessagingHosts\\\\\\$\\{HOSTNAME\\}"\\s+""\\s+"\\$INSTDIR\\\\nm-manifest\\.json"`,
    );
    assert.match(nsi, writeRe, `must WriteRegStr HKCU for ${key}`);
  }
});

test("installer.nsi registers Add/Remove Programs uninstall entry", () => {
  const nsi = readFileSync(nsiPath, "utf8");

  assert.match(
    nsi,
    /WriteRegStr\s+HKCU\s+"Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\\$\{APPNAME\}"\s+"DisplayName"/,
    "must register DisplayName under Uninstall",
  );
  assert.match(
    nsi,
    /WriteRegStr\s+HKCU\s+"Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\\$\{APPNAME\}"\s+"UninstallString"/,
    "must register UninstallString",
  );
  assert.match(
    nsi,
    /WriteRegStr\s+HKCU\s+"Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\\$\{APPNAME\}"\s+"DisplayVersion"\s+"\$\{VERSION\}"/,
    "must register DisplayVersion = ${VERSION}",
  );
  assert.match(nsi, /WriteUninstaller\s+"\$INSTDIR\\Uninstall\.exe"/, "must write Uninstall.exe");
});

test("installer.nsi uninstall section is symmetric — removes everything install creates", () => {
  const nsi = readFileSync(nsiPath, "utf8");

  // Files removed.
  for (const f of ["node.exe", "parser-server.js", "host.js", "host.bat", "nm-manifest.json", "Uninstall.exe"]) {
    assert.match(nsi, new RegExp(`Delete\\s+"\\$INSTDIR\\\\${f.replace(/\./g, "\\.")}"`), `uninstall must Delete ${f}`);
  }
  // Extension dir + install dir + cache dir removed.
  assert.match(nsi, /RMDir\s+\/r\s+"\$INSTDIR\\extension"/, "uninstall must RMDir /r extension");
  assert.match(nsi, /RMDir\s+"\$INSTDIR"/, "uninstall must RMDir install dir (last, after files)");
  assert.match(nsi, /RMDir\s+\/r\s+"\$LOCALAPPDATA\\Remanga Plus"/, "uninstall must RMDir /r cache");

  // Registry keys removed for every browser.
  for (const key of BROWSER_REG_KEYS) {
    const escaped = key.replace(/\\/g, "\\\\").replace(/[.*+?^${}()|[\]]/g, "\\$&");
    const deleteRe = new RegExp(
      `DeleteRegKey\\s+HKCU\\s+"${escaped}\\\\NativeMessagingHosts\\\\\\$\\{HOSTNAME\\}"`,
    );
    assert.match(nsi, deleteRe, `uninstall must DeleteRegKey for ${key}`);
  }

  // Add/Remove Programs entry removed.
  assert.match(
    nsi,
    /DeleteRegKey\s+HKCU\s+"Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\\$\{APPNAME\}"/,
    "uninstall must DeleteRegKey for Add/Remove Programs entry",
  );
});

test("installer.nsi declares Russian and English UI languages", () => {
  const nsi = readFileSync(nsiPath, "utf8");
  assert.match(nsi, /!insertmacro\s+MUI_LANGUAGE\s+"Russian"/, "must include Russian UI");
  assert.match(nsi, /!insertmacro\s+MUI_LANGUAGE\s+"English"/, "must include English UI");
});
