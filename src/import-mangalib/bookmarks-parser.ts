import type { MangalibBookmark } from "./types.js";

interface RawBookmark {
  id?: number;
  status?: number;
  progress?: string | number | null;
  media?: {
    id?: number;
    name?: string;
    rus_name?: string;
    eng_name?: string;
    slug?: string;
    slug_url?: string;
    items_count?: { total?: number };
  };
}

export function parseMangalibBookmarks(payload: unknown): MangalibBookmark[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: RawBookmark[] }).data;
  if (!Array.isArray(data)) return [];

  const out: MangalibBookmark[] = [];
  for (const row of data) {
    const media = row.media;
    if (!media) continue;
    const slug = String(media.slug ?? "").trim();
    if (!slug) continue;
    const progressRaw = row.progress;
    const progress =
      progressRaw === null || progressRaw === undefined
        ? null
        : Number(progressRaw);
    const lastReadChapter =
      Number.isFinite(progress) && (progress as number) > 0 ? (progress as number) : null;

    out.push({
      bookmarkId: Number(row.id ?? 0),
      mangaId: Number(media.id ?? 0),
      slug,
      slugUrl: String(media.slug_url ?? slug),
      rusName: String(media.rus_name ?? "").trim(),
      engName: String(media.eng_name ?? "").trim(),
      shortName: String(media.name ?? "").trim(),
      status: Number(row.status ?? 0),
      lastReadChapter,
      itemsTotal: Number.isFinite(Number(media.items_count?.total))
        ? Number(media.items_count?.total)
        : null,
    });
  }
  return out;
}
