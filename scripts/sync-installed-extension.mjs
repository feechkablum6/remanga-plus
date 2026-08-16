import {
  cpSync,
  existsSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFilePath), "..");
const defaultSourceDirectory = path.join(repoRoot, "dist");

export const resolveInstalledExtensionDirectory = (env = process.env) => {
  const override = env.REMANGA_EXTENSION_INSTALL_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }

  const localAppData = env.LOCALAPPDATA?.trim();
  if (!localAppData) {
    return null;
  }

  return path.join(
    localAppData,
    "Programs",
    "Remanga Plus",
    "extension",
  );
};

export const syncInstalledExtension = ({
  sourceDirectory = defaultSourceDirectory,
  destinationDirectory = resolveInstalledExtensionDirectory(),
  processId = process.pid,
  log = console.log,
} = {}) => {
  const source = path.resolve(sourceDirectory);
  if (
    !existsSync(source) ||
    !statSync(source).isDirectory() ||
    !existsSync(path.join(source, "manifest.json"))
  ) {
    throw new Error(`В dist отсутствует manifest.json: ${source}`);
  }

  if (!destinationDirectory) {
    log("LOCALAPPDATA недоступен — установленная копия не обновлена, dist готов.");
    return { status: "skipped", destinationDirectory: null };
  }

  const destination = path.resolve(destinationDirectory);
  if (
    !existsSync(destination) ||
    !statSync(destination).isDirectory()
  ) {
    log(`Папка установленного расширения не найдена — dist готов: ${destination}`);
    return { status: "skipped", destinationDirectory: destination };
  }

  if (source === destination) {
    throw new Error("Папка dist совпадает с папкой установленного расширения.");
  }

  const temporaryDirectory = `${destination}.next-${processId}`;
  const backupDirectory = `${destination}.previous-${processId}`;
  rmSync(temporaryDirectory, { recursive: true, force: true });
  rmSync(backupDirectory, { recursive: true, force: true });
  cpSync(source, temporaryDirectory, { recursive: true });

  let originalMoved = false;
  try {
    renameSync(destination, backupDirectory);
    originalMoved = true;
    renameSync(temporaryDirectory, destination);
  } catch (error) {
    if (
      originalMoved &&
      existsSync(backupDirectory) &&
      !existsSync(destination)
    ) {
      renameSync(backupDirectory, destination);
    }
    throw error;
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }

  rmSync(backupDirectory, { recursive: true, force: true });
  log(`Установленное расширение обновлено: ${destination}`);
  return { status: "synced", destinationDirectory: destination };
};

if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
  try {
    syncInstalledExtension();
  } catch (error) {
    console.error(
      `Не удалось обновить установленное расширение: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
  }
}
