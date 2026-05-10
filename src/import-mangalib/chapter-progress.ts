export interface RemangaChapter {
  id: number;
  index: number;
}

export function selectChaptersToMark(
  chapters: RemangaChapter[],
  lastRead: number | null,
): number[] {
  if (lastRead === null || lastRead <= 0) return [];
  const out: number[] = [];
  for (const ch of chapters) {
    if (!Number.isFinite(ch.index)) continue;
    if (ch.index <= lastRead) out.push(ch.id);
  }
  return out;
}
