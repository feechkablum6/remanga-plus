const STORAGE_KEY = "mangalibImportState";

export type ImportPhase = "fetching" | "matching" | "preview" | "executing" | "done";

export interface ImportState {
  startedAt: number;
  phase: ImportPhase;
  totalSelected: number;
  doneIds: string[];
  failedIds: string[];
}

export async function saveImportState(state: ImportState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function loadImportState(): Promise<ImportState | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const value = result[STORAGE_KEY];
  if (!value || typeof value !== "object") return null;
  return value as ImportState;
}

export async function clearImportState(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
