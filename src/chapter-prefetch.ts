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

const REMANGA_CHAPTER_URL = (id: number): string =>
  `https://api.remanga.org/api/titles/chapters/${id}/`;

const flattenPages = (pages: unknown): Array<{ link: string }> => {
  if (!Array.isArray(pages)) return [];
  const flat: Array<{ link: string }> = [];
  for (const item of pages) {
    if (Array.isArray(item)) {
      for (const inner of item) {
        if (
          inner &&
          typeof inner === "object" &&
          "link" in inner &&
          typeof (inner as { link: unknown }).link === "string"
        ) {
          flat.push({ link: (inner as { link: string }).link });
        }
      }
    } else if (
      item &&
      typeof item === "object" &&
      "link" in item &&
      typeof (item as { link: unknown }).link === "string"
    ) {
      flat.push({ link: (item as { link: string }).link });
    }
  }
  return flat;
};

const addImagePreload = (href: string): void => {
  if (!document.head) return;
  const link = document.createElement("link") as HTMLLinkElement;
  link.rel = "preload";
  link.as = "image";
  link.href = href;
  link.setAttribute("crossorigin", "anonymous");
  link.setAttribute("data-rre-control", "chapter-prefetch-image");
  document.head.appendChild(link);
};

export const prewarmChapter = async (chapterId: number): Promise<void> => {
  if (!Number.isInteger(chapterId) || chapterId <= 0) return;
  try {
    const response = await fetch(REMANGA_CHAPTER_URL(chapterId), {
      credentials: "include",
    });
    if (!response.ok) return;
    const body = (await response.json()) as {
      content?: { is_paid?: boolean; pages?: unknown };
    };
    const content = body.content;
    if (!content || content.is_paid) return;
    for (const page of flattenPages(content.pages)) {
      addImagePreload(page.link);
    }
  } catch {
    /* silent — prefetch is best-effort */
  }
};
