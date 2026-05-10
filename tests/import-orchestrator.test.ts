import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runImport,
  type ImportDependencies,
  type PreviewRow,
} from "../src/import-mangalib/orchestrator.js";
import {
  MANGALIB_STATUS_READING,
  MANGALIB_STATUS_READ,
  REMANGA_CATEGORY_READING,
  REMANGA_CATEGORY_READ,
} from "../src/import-mangalib/status-mapping.js";

function makeDeps(over: Partial<ImportDependencies> = {}): ImportDependencies {
  return {
    fetchBookmarks: async () => [
      {
        bookmarkId: 1,
        mangaId: 100,
        slug: "solo-leveling",
        slugUrl: "100--solo-leveling",
        rusName: "Solo Leveling",
        engName: "",
        shortName: "",
        status: MANGALIB_STATUS_READING,
        lastReadChapter: 5,
        itemsTotal: 100,
      },
      {
        bookmarkId: 2,
        mangaId: 200,
        slug: "no-such",
        slugUrl: "200--no-such",
        rusName: "Совершенно неизвестный",
        engName: "",
        shortName: "",
        status: MANGALIB_STATUS_READ,
        lastReadChapter: null,
        itemsTotal: null,
      },
    ],
    fetchBookmarkTypes: async () => [
      { id: 100, name: REMANGA_CATEGORY_READING },
      { id: 200, name: REMANGA_CATEGORY_READ },
    ],
    fetchExistingBookmarks: async () => new Set<number>(),
    searchRemanga: async (q) =>
      q.includes("Solo")
        ? [{ id: 100, dir: "solo-leveling", main_name: "Solo Leveling", secondary_name: "", another_name: "" }]
        : [],
    fetchTitleDetail: async (dir) => ({ id: 100, dir, activeBranch: 555 }),
    fetchChapters: async () => [
      { id: 901, index: 1 }, { id: 902, index: 2 }, { id: 903, index: 5 }, { id: 904, index: 6 },
    ],
    addBookmark: async () => {},
    markChapterViewed: async () => {},
    sleepMs: async () => {},
    ...over,
  };
}

test("buildPreview matches certain row and resolves bookmark type id", async () => {
  const preview = await runImport.buildPreview(makeDeps());
  const certain = preview.find((r) => r.match.kind === "certain");
  assert.ok(certain);
  assert.equal(certain!.targetBookmarkTypeId, 100);
  const notFound = preview.find((r) => r.match.kind === "not_found");
  assert.ok(notFound);
});

test("execute writes only selected and reports", async () => {
  const calls: number[] = [];
  const deps = makeDeps({ addBookmark: async (id) => { calls.push(id); } });
  const preview = await runImport.buildPreview(deps);
  const certain = preview.find((r) => r.match.kind === "certain")!;
  certain.selected = true;
  const report = await runImport.execute(deps, preview);
  assert.deepEqual(calls, [100]);
  assert.equal(report.added.length, 1);
});

test("execute marks chapters with index ≤ lastRead", async () => {
  const viewed: number[] = [];
  const deps = makeDeps({ markChapterViewed: async (id) => { viewed.push(id); } });
  const preview = await runImport.buildPreview(deps);
  const c = preview.find((r) => r.match.kind === "certain")!;
  c.selected = true;
  await runImport.execute(deps, preview);
  // lastReadChapter = 5 → ids with index 1,2,5 → [901, 902, 903]
  assert.deepEqual(viewed.sort(), [901, 902, 903]);
});

test("duplicate is unselected by default", async () => {
  const deps = makeDeps({ fetchExistingBookmarks: async () => new Set([100]) });
  const preview = await runImport.buildPreview(deps);
  const c = preview.find((r) => r.match.kind === "certain")!;
  assert.equal(c.alreadyExists, true);
  assert.equal(c.selected, false);
});

test("execute SAFETY GUARD: even if row.selected, never call addBookmark for a title that exists in remanga", async () => {
  const adds: number[] = [];
  const views: number[] = [];
  const deps = makeDeps({
    fetchExistingBookmarks: async () => new Set<number>([100]),
    addBookmark: async (id) => { adds.push(id); },
    markChapterViewed: async (id) => { views.push(id); },
  });
  const preview = await runImport.buildPreview(deps);
  const c = preview.find((r) => r.match.kind === "certain")!;
  c.selected = true;
  const report = await runImport.execute(deps, preview);
  assert.deepEqual(adds, [], "must not call addBookmark for existing title");
  assert.deepEqual(views, [], "must not mark any chapter for existing title");
  assert.ok(report.skipped.includes("solo-leveling"));
  assert.equal(report.added.length, 0);
});

test("execute records failures and continues", async () => {
  const deps = makeDeps({
    addBookmark: async () => { throw new Error("HTTP 500"); },
  });
  const preview = await runImport.buildPreview(deps);
  const c = preview.find((r) => r.match.kind === "certain")!;
  c.selected = true;
  const report = await runImport.execute(deps, preview);
  assert.equal(report.failed.length, 1);
  assert.equal(report.added.length, 0);
});
