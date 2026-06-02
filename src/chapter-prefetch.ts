export type BranchChapter = {
  id: number;
  index: number;
  tome?: number;
  chapter?: string;
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
  `https://api.remanga.org/api/v2/titles/chapters/?branch_id=${branchId}&ordering=index&page=${page}&count=100&user_data=1`;
const REMANGA_TITLE_DETAIL_URL = (titleDir: string): string =>
  `https://api.remanga.org/api/v2/titles/${encodeURIComponent(titleDir)}/`;

let prewarmedChapterIds = new Set<number>();
let activeTitleDir: string | null = null;

export const resetPrefetchDedup = (): void => {
  prewarmedChapterIds = new Set();
  activeTitleDir = null;
};

type RemangaChapterLookupOptions = {
  authToken?: string | null;
};

const buildLookupFetchInit = (
  options?: RemangaChapterLookupOptions,
): RequestInit | undefined => {
  const token = options?.authToken?.trim();
  if (!token) {
    return undefined;
  }

  return {
    headers: {
      Authorization: `bearer ${token}`,
    },
  };
};

const fetchChapterMeta = async (
  chapterId: number,
  options?: RemangaChapterLookupOptions,
): Promise<{ branch_id?: number; index?: number } | null> => {
  try {
    const res = await fetch(REMANGA_CHAPTER_URL(chapterId), buildLookupFetchInit(options));
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
  options?: RemangaChapterLookupOptions,
): Promise<BranchChapter[]> => {
  try {
    const res = await fetch(
      REMANGA_BRANCH_LIST_URL(branchId, page),
      buildLookupFetchInit(options),
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { content?: unknown; results?: unknown };
    const items = Array.isArray(body.content)
      ? body.content
      : Array.isArray(body.results)
        ? body.results
        : [];
    return items.flatMap((item) => {
      if (
        item &&
        typeof item === "object" &&
        "id" in item &&
        "index" in item &&
        typeof (item as { id: unknown }).id === "number" &&
        typeof (item as { index: unknown }).index === "number"
      ) {
        const raw = item as {
          id: number;
          index: number;
          tome?: unknown;
          chapter?: unknown;
        };
        return [
          {
            id: raw.id,
            index: raw.index,
            ...(typeof raw.tome === "number" ? { tome: raw.tome } : {}),
            ...(typeof raw.chapter === "string" || typeof raw.chapter === "number"
              ? { chapter: String(raw.chapter) }
              : {}),
          },
        ];
      }
      return [];
    });
  } catch {
    return [];
  }
};

export type PaidNextChapterMeta = {
  titleDir: string;
  chapterId: number;
  chapter: string;
  tome: number;
};

export type RemangaChapterMeta = PaidNextChapterMeta & {
  index: number;
};

export type PrefetchNextChapterOptions = {
  onPaidNextChapter?: (meta: PaidNextChapterMeta) => void | Promise<void>;
  authToken?: string | null;
};

const fetchChapterDetail = async (
  chapterId: number,
  options?: RemangaChapterLookupOptions,
): Promise<
  | {
      is_paid: boolean;
      chapter?: unknown;
      tome?: unknown;
      pages?: unknown;
    }
  | null
> => {
  try {
    const res = await fetch(REMANGA_CHAPTER_URL(chapterId), buildLookupFetchInit(options));
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: unknown };
    if (!body.content || typeof body.content !== "object") return null;
    return body.content as {
      is_paid: boolean;
      chapter?: unknown;
      tome?: unknown;
      pages?: unknown;
    };
  } catch {
    return null;
  }
};

const fetchActiveBranchId = async (
  titleDir: string,
  options?: RemangaChapterLookupOptions,
): Promise<number | null> => {
  try {
    const res = await fetch(REMANGA_TITLE_DETAIL_URL(titleDir), buildLookupFetchInit(options));
    if (!res.ok) return null;
    const body = (await res.json()) as {
      active_branch?: unknown;
      branches?: Array<{ id?: unknown }>;
    };
    if (typeof body.active_branch === "number") {
      return body.active_branch;
    }

    const firstBranchId = body.branches?.find((branch) => typeof branch.id === "number")?.id;
    return typeof firstBranchId === "number" ? firstBranchId : null;
  } catch {
    return null;
  }
};

const normalizeChapterLabel = (chapter: string): string => chapter.trim();

const chapterMatches = (
  candidate: BranchChapter,
  tome: number | undefined,
  chapter: string,
): boolean => {
  if (candidate.chapter !== normalizeChapterLabel(chapter)) {
    return false;
  }

  return typeof tome !== "number" || candidate.tome === tome;
};

export const resolveRemangaChapterMetaByLabel = async (
  titleDir: string,
  tome: number | undefined,
  chapter: string,
  options?: RemangaChapterLookupOptions,
): Promise<RemangaChapterMeta | null> => {
  const branchId = await fetchActiveBranchId(titleDir, options);
  if (branchId === null) {
    return null;
  }

  let page = 1;
  for (;;) {
    const chapters = await fetchBranchChapters(branchId, page, options);
    const matched =
      chapters.find((candidate) => chapterMatches(candidate, tome, chapter)) ??
      (typeof tome === "number"
        ? chapters.find((candidate) => chapterMatches(candidate, undefined, chapter))
        : null);
    if (matched) {
      return {
        titleDir,
        chapterId: matched.id,
        chapter: matched.chapter ?? chapter,
        tome: matched.tome ?? tome ?? 0,
        index: matched.index,
      };
    }

    if (chapters.length === 0 || chapters.length < 100) {
      return null;
    }

    page += 1;
  }
};

const resolveNextRemangaChapterWithDetail = async (
  titleDir: string,
  currentChapterId: number,
  options?: RemangaChapterLookupOptions,
): Promise<{
  meta: PaidNextChapterMeta;
  detail: NonNullable<Awaited<ReturnType<typeof fetchChapterDetail>>>;
} | null> => {
  const meta = await fetchChapterMeta(currentChapterId, options);
  if (
    !meta ||
    typeof meta.branch_id !== "number" ||
    typeof meta.index !== "number"
  ) {
    return null;
  }

  const nextIndex = meta.index + 1;
  const page = computeBranchPageForIndex(nextIndex);
  const list = await fetchBranchChapters(meta.branch_id, page, options);
  const next = findChapterByIndex(list, nextIndex);
  if (!next) return null;

  const detail = await fetchChapterDetail(next.id, options);
  if (!detail) return null;

  const chapterStr =
    typeof detail.chapter === "string"
      ? detail.chapter
      : typeof detail.chapter === "number"
        ? String(detail.chapter)
        : "";
  const tomeNum =
    typeof detail.tome === "number" && Number.isFinite(detail.tome)
      ? detail.tome
      : 0;

  return {
    meta: {
      titleDir,
      chapterId: next.id,
      chapter: chapterStr,
      tome: tomeNum,
    },
    detail,
  };
};

export const resolveNextRemangaChapterMeta = async (
  titleDir: string,
  currentChapterId: number,
  options?: RemangaChapterLookupOptions,
): Promise<PaidNextChapterMeta | null> =>
  (await resolveNextRemangaChapterWithDetail(titleDir, currentChapterId, options))?.meta ??
  null;

export const prefetchNextChapter = async (
  titleDir: string,
  currentChapterId: number,
  options?: PrefetchNextChapterOptions,
): Promise<void> => {
  if (activeTitleDir !== null && activeTitleDir !== titleDir) {
    resetPrefetchDedup();
  }
  activeTitleDir = titleDir;

  if (prewarmedChapterIds.has(currentChapterId)) return;
  prewarmedChapterIds.add(currentChapterId);

  const nextChapter = await resolveNextRemangaChapterWithDetail(
    titleDir,
    currentChapterId,
    options,
  );
  if (!nextChapter) return;
  const { meta: nextMeta, detail } = nextChapter;

  if (detail.is_paid) {
    if (options?.onPaidNextChapter) {
      await options.onPaidNextChapter(nextMeta);
    }
    return;
  }

  for (const pageEntry of flattenPages(detail.pages)) {
    addImagePreload(pageEntry.link);
  }
};
