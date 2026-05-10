import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadImportState,
  saveImportState,
  clearImportState,
  type ImportState,
} from "../src/import-mangalib/state.js";

interface FakeStore { data: Record<string, unknown> }

function installFakeChrome(): FakeStore {
  const store: FakeStore = { data: {} };
  const local = {
    async get(key: string) {
      return key in store.data ? { [key]: store.data[key] } : {};
    },
    async set(values: Record<string, unknown>) {
      Object.assign(store.data, values);
    },
    async remove(key: string) {
      delete store.data[key];
    },
  };
  (globalThis as unknown as { chrome: { storage: { local: typeof local } } }).chrome = {
    storage: { local },
  };
  return store;
}

const sample: ImportState = {
  startedAt: 1,
  phase: "executing",
  totalSelected: 5,
  doneIds: ["a"],
  failedIds: [],
};

test("save then load roundtrips", async () => {
  installFakeChrome();
  await saveImportState(sample);
  assert.deepEqual(await loadImportState(), sample);
});

test("loadImportState returns null when nothing stored", async () => {
  installFakeChrome();
  assert.equal(await loadImportState(), null);
});

test("clearImportState removes the entry", async () => {
  const s = installFakeChrome();
  await saveImportState(sample);
  await clearImportState();
  assert.equal(s.data["mangalibImportState"], undefined);
});
