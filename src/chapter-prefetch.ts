export type BranchChapter = {
  id: number;
  index: number;
};

// Remanga returns the branch list paginated, 30 chapters per page.
const BRANCH_PAGE_SIZE = 30;

export const extractCurrentChapterIdFromUrl = (url: string): number | null => {
  const match = url.match(/\/manga\/[^/]+\/(\d+)(?:[/?#]|$)/);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const findChapterByIndex = (
  chapters: ReadonlyArray<BranchChapter>,
  targetIndex: number,
): BranchChapter | null =>
  chapters.find((c) => c.index === targetIndex) ?? null;

export const computeBranchPageForIndex = (chapterIndex: number): number => {
  if (!Number.isFinite(chapterIndex) || chapterIndex < 1) return 1;
  return Math.max(1, Math.ceil(chapterIndex / BRANCH_PAGE_SIZE));
};

// Kept for backwards compatibility with the old contract; unused by the
// orchestrator now that we look up the next chapter by `index` directly.
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
  // No crossorigin: Remanga's native <img> tags don't set it, and a mismatch
  // would prevent the browser from reusing this preload from cache.
  link.setAttribute("data-rre-control", "chapter-prefetch-image");
  document.head.appendChild(link);
};

export const prewarmChapter = async (chapterId: number): Promise<void> => {
  if (!Number.isInteger(chapterId) || chapterId <= 0) return;
  try {
    // No credentials: api.remanga.org/api/titles/chapters/<id>/ does not send
    // Access-Control-Allow-Credentials, so the browser rejects credentialed
    // CORS requests with a network error. The endpoint works for anonymous
    // requests for free chapters, which is exactly what we need to read
    // pages[].link for image preload.
    const response = await fetch(REMANGA_CHAPTER_URL(chapterId));
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

// `ordering=index` is critical: the default order is reverse-chronological
// and pages are 30-deep, so without it any chapter outside the most recent
// 30 falls off the first page and the lookup fails.
const REMANGA_BRANCH_LIST_URL = (branchId: number, page: number = 1): string =>
  `https://api.remanga.org/api/titles/chapters/?branch_id=${branchId}&ordering=index&page=${page}`;

let prewarmedChapterIds = new Set<number>();
let activeTitleDir: string | null = null;

export const resetPrefetchDedup = (): void => {
  prewarmedChapterIds = new Set();
  activeTitleDir = null;
};

const fetchChapterMeta = async (
  chapterId: number,
): Promise<{ branch_id?: number; index?: number } | null> => {
  try {
    const res = await fetch(REMANGA_CHAPTER_URL(chapterId));
    if (!res.ok) return null;
    const body = (await res.json()) as {
      content?: { branch_id?: number; index?: number };
    };
    return body.content ?? null;
  } catch {
    return null;
  }
};

const fetchBranchChapters = async (
  branchId: number,
  page: number = 1,
): Promise<BranchChapter[]> => {
  try {
    const res = await fetch(REMANGA_BRANCH_LIST_URL(branchId, page));
    if (!res.ok) return [];
    const body = (await res.json()) as { content?: unknown };
    if (!Array.isArray(body.content)) return [];
    return body.content.flatMap((item) => {
      if (
        item &&
        typeof item === "object" &&
        "id" in item &&
        "index" in item &&
        typeof (item as { id: unknown }).id === "number" &&
        typeof (item as { index: unknown }).index === "number"
      ) {
        return [{ id: (item as { id: number }).id, index: (item as { index: number }).index }];
      }
      return [];
    });
  } catch {
    return [];
  }
};

export const prefetchNextChapter = async (
  titleDir: string,
  currentChapterId: number,
): Promise<void> => {
  if (activeTitleDir !== null && activeTitleDir !== titleDir) {
    resetPrefetchDedup();
  }
  activeTitleDir = titleDir;

  if (prewarmedChapterIds.has(currentChapterId)) return;
  prewarmedChapterIds.add(currentChapterId);

  const meta = await fetchChapterMeta(currentChapterId);
  if (
    !meta ||
    typeof meta.branch_id !== "number" ||
    typeof meta.index !== "number"
  ) {
    return;
  }

  const nextIndex = meta.index + 1;
  const page = computeBranchPageForIndex(nextIndex);
  const list = await fetchBranchChapters(meta.branch_id, page);
  const next = findChapterByIndex(list, nextIndex);
  if (!next) return;

  await prewarmChapter(next.id);
};
