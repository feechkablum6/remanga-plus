export type BranchChapter = {
  id: number;
  index: number;
};

export const extractCurrentChapterIdFromUrl = (url: string): number | null => {
  const match = url.match(/\/manga\/[^/]+\/(\d+)(?:[/?#]|$)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const findNextChapterId = (
  chapters: ReadonlyArray<BranchChapter>,
  currentId: number,
): number | null => {
  if (chapters.length === 0) return null;
  const sorted = [...chapters].sort((a, b) => a.id - b.id);
  const currentIdx = sorted.findIndex((c) => c.id === currentId);
  if (currentIdx === -1 || currentIdx === sorted.length - 1) return null;
  return sorted[currentIdx + 1].id;
};
