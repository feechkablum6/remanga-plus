import type { MangalibBookmark } from "./types.js";
import { matchTitle, type MatchResult, type RemangaCandidate } from "./title-matcher.js";
import { selectChaptersToMark, type RemangaChapter } from "./chapter-progress.js";
import { mapMangalibStatusToRemangaCategoryName } from "./status-mapping.js";
import type { RemangaBookmarkType, RemangaTitleDetail } from "./remanga-client.js";

export interface ImportDependencies {
  fetchBookmarks: () => Promise<MangalibBookmark[]>;
  fetchBookmarkTypes: () => Promise<RemangaBookmarkType[]>;
  fetchExistingBookmarks: () => Promise<Set<number>>;
  searchRemanga: (query: string) => Promise<RemangaCandidate[]>;
  fetchTitleDetail: (dir: string) => Promise<RemangaTitleDetail | null>;
  fetchChapters: (branchId: number) => Promise<RemangaChapter[]>;
  addBookmark: (titleId: number, typeId: number) => Promise<void>;
  markChapterViewed: (chapterId: number) => Promise<void>;
  sleepMs: (ms: number) => Promise<void>;
}

export interface PreviewRow {
  bookmark: MangalibBookmark;
  match: MatchResult;
  alreadyExists: boolean;
  selected: boolean;
  targetBookmarkTypeId: number | null;
  targetCategoryName: string;
}

export type ImportProgress =
  | { phase: "fetching"; current: number; total: number }
  | { phase: "matching"; current: number; total: number }
  | { phase: "executing"; current: number; total: number; slug: string }
  | { phase: "done" };

export interface ExecutionReport {
  added: string[];
  skipped: string[];
  failed: Array<{ slug: string; reason: string }>;
}

const RPS_DELAY_MS = 220;

async function buildPreview(
  deps: ImportDependencies,
  onProgress: (p: ImportProgress) => void = () => {},
): Promise<PreviewRow[]> {
  const bookmarks = await deps.fetchBookmarks();
  onProgress({ phase: "fetching", current: bookmarks.length, total: bookmarks.length });

  const [types, existing] = await Promise.all([
    deps.fetchBookmarkTypes(),
    deps.fetchExistingBookmarks(),
  ]);
  const typeIdByName = new Map(types.map((t) => [t.name, t.id]));

  const rows: PreviewRow[] = [];
  for (let i = 0; i < bookmarks.length; i += 1) {
    const b = bookmarks[i];
    onProgress({ phase: "matching", current: i, total: bookmarks.length });
    const query = b.rusName || b.engName || b.shortName || b.slug;
    const candidates = await deps.searchRemanga(query);
    const match = matchTitle(query, candidates);
    const titleId = match.kind === "certain" ? match.chosen.id : null;
    const alreadyExists = titleId !== null && existing.has(titleId);
    const categoryName = mapMangalibStatusToRemangaCategoryName(b.status);
    const targetBookmarkTypeId = typeIdByName.get(categoryName) ?? null;
    rows.push({
      bookmark: b,
      match,
      alreadyExists,
      selected: match.kind === "certain" && !alreadyExists && targetBookmarkTypeId !== null,
      targetBookmarkTypeId,
      targetCategoryName: categoryName,
    });
  }
  onProgress({ phase: "matching", current: bookmarks.length, total: bookmarks.length });
  return rows;
}

async function execute(
  deps: ImportDependencies,
  preview: PreviewRow[],
  onProgress: (p: ImportProgress) => void = () => {},
): Promise<ExecutionReport> {
  const report: ExecutionReport = { added: [], skipped: [], failed: [] };
  const targets = preview.filter((r) => r.selected && r.match.kind === "certain" && r.targetBookmarkTypeId !== null);
  for (let i = 0; i < targets.length; i += 1) {
    const row = targets[i];
    if (row.match.kind !== "certain") continue;
    const candidate = row.match.chosen;
    onProgress({ phase: "executing", current: i, total: targets.length, slug: row.bookmark.slug });
    try {
      await deps.addBookmark(candidate.id, row.targetBookmarkTypeId!);
      if (row.bookmark.lastReadChapter !== null) {
        const detail = await deps.fetchTitleDetail(candidate.dir);
        if (detail?.activeBranch) {
          const chapters = await deps.fetchChapters(detail.activeBranch);
          const ids = selectChaptersToMark(chapters, row.bookmark.lastReadChapter);
          for (const id of ids) {
            await deps.markChapterViewed(id);
            await deps.sleepMs(RPS_DELAY_MS);
          }
        }
      }
      report.added.push(row.bookmark.slug);
    } catch (e) {
      report.failed.push({ slug: row.bookmark.slug, reason: e instanceof Error ? e.message : String(e) });
    }
    await deps.sleepMs(RPS_DELAY_MS);
  }
  for (const r of preview) if (!r.selected) report.skipped.push(r.bookmark.slug);
  onProgress({ phase: "done" });
  return report;
}

export const runImport = { buildPreview, execute };
