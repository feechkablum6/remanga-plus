import {
  ENSURE_PARSER_SERVER_MESSAGE_TYPE,
  isParserServerEnsureResult,
  type ParserServerEnsureResult,
} from "./parser-server.js";

export type RemangaChapterReference = {
  titleDir: string;
  titleName: string;
  aliases: string[];
  tome?: number;
  chapter: string;
  chapterId?: number;
  chapterUrl: string;
};

export type PremiumFreeResolveSuccess = {
  status: "success";
  provider: string;
  matchedTitle: {
    titleId: string;
    slug: string;
    titleName: string;
    titleUrl: string;
  };
  matchedChapter: {
    chapterId: string;
    chapter: string;
    volume: number;
    chapterUrl: string;
  };
  manualUrl: string;
  nextChapter: {
    chapterId: string;
    chapter: string;
    volume: number;
    chapterUrl: string;
  } | null;
  totalPages: number;
  pages: Array<{
    index: number;
    proxyUrl: string;
  }>;
};

export type PremiumFreeResolveFailure = {
  status: "failure";
  reason: "no_match" | "chapter_not_found" | "provider_error";
  provider: string;
  manualUrl: string;
};

export type PremiumFreeResolveResult =
  | PremiumFreeResolveSuccess
  | PremiumFreeResolveFailure;

export type PremiumFreeClientFailureReason =
  | PremiumFreeResolveFailure["reason"]
  | "resolver_unavailable"
  | "install_required";

export type PremiumFreeClientFailure = {
  status: "failure";
  reason: PremiumFreeClientFailureReason;
  provider: string;
  manualUrl: string;
  detail?: string;
};

export type PremiumFreeClientResolveResult =
  | PremiumFreeResolveSuccess
  | PremiumFreeClientFailure;

export type PremiumFreeCacheEntry = {
  result: PremiumFreeClientResolveResult;
  expiresAt: number | null;
};

export type RemangaMetadataSnapshot = {
  href: string;
  canonicalHref: string | null;
  documentTitle: string;
  descriptionContent: string | null;
  headerTitle: string | null;
  headerChapterLabel: string | null;
};

export type PremiumFreeTargetReferenceOptions = {
  currentReference: RemangaChapterReference | null;
  hasNativeReaderPages: boolean;
  bannerText: string | null;
  nextChapterHref: string | null;
};

export type PremiumFreeStreamPrefetchOptions = {
  activePageIndex: number;
  totalPages: number;
  isLastStreamEntry: boolean;
  streamStatus: "idle" | "loading-next" | "error" | "exhausted";
};

export type PremiumFreeViewportPageCandidate = {
  key: string;
  pageIndex: number;
  top: number;
  bottom: number;
};

export type PremiumFreeViewportPrefetchOptions = {
  distanceToViewportBottom: number;
  hasNextChapter: boolean;
  streamStatus: "idle" | "loading-next" | "error" | "exhausted";
};

const PREMIUM_FREE_VIEWPORT_PREFETCH_DISTANCE_PX = 1400;

const normalizeWhitespace = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

const extractPathMetadata = (
  href: string,
  canonicalHref: string | null,
): { titleDir: string; chapterId: number } | null => {
  const target = canonicalHref || href;
  const match = target.match(/\/manga\/([^/]+)\/(\d+)/);
  if (!match) {
    return null;
  }

  return {
    titleDir: match[1],
    chapterId: Number(match[2]),
  };
};

const extractChapterIdFromHref = (href: string | null | undefined): number | undefined => {
  if (!href) {
    return undefined;
  }

  return extractPathMetadata(href, null)?.chapterId;
};

const extractTitleFromDocumentTitle = (documentTitle: string): string | null => {
  const match = normalizeWhitespace(documentTitle).match(
    /^читать\s+\S+\s+(.+?)\s+\d+\s+глава\s+\d+\s+том/i,
  );
  return match?.[1] ?? null;
};

const extractChapterLabel = (
  documentTitle: string,
  headerChapterLabel: string | null,
): { tome?: number; chapter: string } | null => {
  const label = normalizeWhitespace(headerChapterLabel);
  const headerMatch = label.match(/^(\d+)\s*-\s*([0-9.]+)$/);
  if (headerMatch) {
    return {
      tome: Number(headerMatch[1]),
      chapter: headerMatch[2],
    };
  }

  const titleMatch = normalizeWhitespace(documentTitle).match(/(\d+)\s+глава\s+(\d+)\s+том/i);
  if (!titleMatch) {
    return null;
  }

  return {
    chapter: titleMatch[1],
    tome: Number(titleMatch[2]),
  };
};

const extractAliases = (
  descriptionContent: string | null,
  titleName: string,
): string[] => {
  const description = normalizeWhitespace(descriptionContent);
  const aliasesMatch = description.match(/также известно как\s+(.+?)(?:\.|$)/i);
  if (!aliasesMatch) {
    return [];
  }

  return Array.from(
    new Set(
      aliasesMatch[1]
        .split(",")
        .flatMap((part) => part.split("/"))
        .map((part) => normalizeWhitespace(part))
        .filter((part) => part && part !== titleName),
    ),
  );
};

export const buildPremiumFreeSearchUrl = (titleName: string): string =>
  `https://mangabuff.ru/search?type=manga&q=${encodeURIComponent(titleName)}`;

export const isResolverUnavailableError = (error: unknown): boolean =>
  error instanceof TypeError;

const createParserServerFailure = (
  reason: PremiumFreeClientFailureReason,
  detail?: string,
): PremiumFreeClientFailure => ({
  status: "failure",
  reason,
  provider: "mangabuff",
  manualUrl: "",
  ...(detail ? { detail } : {}),
});

export const ensureParserServerReady = async (): Promise<ParserServerEnsureResult> => {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    return {
      status: "failed",
      detail: "Chrome runtime messaging недоступен.",
    };
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: ENSURE_PARSER_SERVER_MESSAGE_TYPE },
      (response: unknown) => {
        const runtimeError = chrome.runtime?.lastError?.message;
        if (runtimeError) {
          resolve({
            status: "failed",
            detail: runtimeError,
          });
          return;
        }

        if (!isParserServerEnsureResult(response)) {
          resolve({
            status: "failed",
            detail: "Background вернул некорректный ответ parser startup.",
          });
          return;
        }

        resolve(response);
      },
    );
  });
};

export const mapParserServerFailure = (
  result: ParserServerEnsureResult,
): PremiumFreeClientFailure | null => {
  if (result.status === "ready") {
    return null;
  }

  if (result.status === "install_required") {
    return createParserServerFailure("install_required", result.detail);
  }

  return createParserServerFailure("resolver_unavailable", result.detail);
};

export const describePremiumFreeFailure = (
  failure: PremiumFreeClientFailure,
  titleName: string,
): {
  title: string;
  copy: string;
  linkHref?: string;
  linkLabel?: string;
} => {
  const fallbackUrl = failure.manualUrl || buildPremiumFreeSearchUrl(titleName);

  if (failure.reason === "install_required") {
    return {
      title: "Premium Free",
      copy:
        "Native Messaging host не установлен. Выполни установку launcher-а и обнови страницу.",
      linkHref: fallbackUrl,
      linkLabel: "Открыть Mangabuff вручную",
    };
  }

  if (failure.reason === "resolver_unavailable") {
    const detail = failure.detail ? `\n${failure.detail}` : "";
    return {
      title: "Premium Free",
      copy: `Parser-server не запустился.${detail}`,
    };
  }

  if (failure.reason === "chapter_not_found") {
    return {
      title: "Premium Free",
      copy: "Тайтл найден, но нужная глава не обнаружена у текущего источника.",
      linkHref: fallbackUrl,
      linkLabel: "Открыть Mangabuff",
    };
  }

  if (failure.reason === "provider_error") {
    return {
      title: "Premium Free",
      copy: "Parser-server или внешний источник вернул ошибку. Можно открыть главу вручную.",
      linkHref: fallbackUrl,
      linkLabel: "Открыть Mangabuff",
    };
  }

  return {
    title: "Premium Free",
    copy: "Не удалось надёжно сопоставить главу. Можно открыть источник вручную.",
    linkHref: fallbackUrl,
    linkLabel: "Открыть Mangabuff",
  };
};

const PREMIUM_FREE_TRANSIENT_FAILURE_TTL_MS = 3_000;

export const createPremiumFreeCacheEntry = (
  result: PremiumFreeClientResolveResult,
  now = Date.now(),
): PremiumFreeCacheEntry => ({
  result,
  expiresAt:
    result.status === "failure" &&
    (result.reason === "resolver_unavailable" || result.reason === "install_required")
      ? now + PREMIUM_FREE_TRANSIENT_FAILURE_TTL_MS
      : null,
});

export const readPremiumFreeCacheEntry = (
  entry: PremiumFreeCacheEntry,
  now = Date.now(),
): PremiumFreeClientResolveResult | null => {
  if (entry.expiresAt !== null && now > entry.expiresAt) {
    return null;
  }

  return entry.result;
};

export const extractRemangaChapterReference = (
  snapshot: RemangaMetadataSnapshot,
): RemangaChapterReference | null => {
  const pathMetadata = extractPathMetadata(snapshot.href, snapshot.canonicalHref);
  if (!pathMetadata) {
    return null;
  }

  const titleName =
    normalizeWhitespace(snapshot.headerTitle) ||
    extractTitleFromDocumentTitle(snapshot.documentTitle);
  const chapterLabel = extractChapterLabel(
    snapshot.documentTitle,
    snapshot.headerChapterLabel,
  );

  if (!titleName || !chapterLabel) {
    return null;
  }

  return {
    titleDir: pathMetadata.titleDir,
    titleName,
    aliases: extractAliases(snapshot.descriptionContent, titleName),
    tome: chapterLabel.tome,
    chapter: chapterLabel.chapter,
    chapterId: pathMetadata.chapterId,
    chapterUrl: snapshot.href,
  };
};

const extractPremiumFreeBannerChapterLabel = (
  bannerText: string | null | undefined,
): { tome?: number; chapter: string } | null => {
  const normalized = normalizeWhitespace(bannerText).toLowerCase();
  const match = normalized.match(/том\s+(\d+)\s+глава\s+([0-9.]+)/i);
  if (!match) {
    return null;
  }

  return {
    tome: Number(match[1]),
    chapter: match[2],
  };
};

export const derivePremiumFreeTargetReference = (
  options: PremiumFreeTargetReferenceOptions,
): RemangaChapterReference | null => {
  const { currentReference, hasNativeReaderPages, bannerText, nextChapterHref } = options;
  if (!currentReference) {
    return null;
  }

  if (!hasNativeReaderPages) {
    return currentReference;
  }

  const bannerChapter = extractPremiumFreeBannerChapterLabel(bannerText);
  if (!bannerChapter) {
    return null;
  }

  return {
    titleDir: currentReference.titleDir,
    titleName: currentReference.titleName,
    aliases: currentReference.aliases,
    tome: bannerChapter.tome,
    chapter: bannerChapter.chapter,
    ...(extractChapterIdFromHref(nextChapterHref)
      ? { chapterId: extractChapterIdFromHref(nextChapterHref) }
      : {}),
    chapterUrl: nextChapterHref ?? currentReference.chapterUrl,
  };
};

export const createPremiumFreeStreamReference = (
  currentReference: RemangaChapterReference,
  nextChapter: NonNullable<PremiumFreeResolveSuccess["nextChapter"]>,
): RemangaChapterReference => ({
  titleDir: currentReference.titleDir,
  titleName: currentReference.titleName,
  aliases: currentReference.aliases,
  tome: nextChapter.volume,
  chapter: nextChapter.chapter,
  chapterUrl: currentReference.chapterUrl,
});

export const shouldPrefetchPremiumFreeNextChapter = (
  options: PremiumFreeStreamPrefetchOptions,
): boolean => {
  const { activePageIndex, totalPages, isLastStreamEntry, streamStatus } = options;

  if (!isLastStreamEntry || streamStatus !== "idle" || totalPages <= 0) {
    return false;
  }

  return activePageIndex >= totalPages - 1;
};

const getPremiumFreeViewportAnchorDistance = (
  candidate: PremiumFreeViewportPageCandidate,
  viewportAnchor: number,
): number => {
  if (candidate.top <= viewportAnchor && candidate.bottom >= viewportAnchor) {
    return 0;
  }

  return Math.min(
    Math.abs(candidate.top - viewportAnchor),
    Math.abs(candidate.bottom - viewportAnchor),
  );
};

export const pickPremiumFreeActivePage = (
  candidates: PremiumFreeViewportPageCandidate[],
  viewportHeight: number,
): Pick<PremiumFreeViewportPageCandidate, "key" | "pageIndex"> | null => {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return null;
  }

  const viewportAnchor = viewportHeight * 0.5;
  let activeCandidate: Pick<PremiumFreeViewportPageCandidate, "key" | "pageIndex"> | null = null;
  let shortestDistance = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    if (candidate.bottom <= 0 || candidate.top >= viewportHeight) {
      return;
    }

    const distance = getPremiumFreeViewportAnchorDistance(candidate, viewportAnchor);
    if (distance < shortestDistance) {
      shortestDistance = distance;
      activeCandidate = {
        key: candidate.key,
        pageIndex: candidate.pageIndex,
      };
    }
  });

  return activeCandidate;
};

export const shouldPrefetchPremiumFreeNextChapterByViewport = (
  options: PremiumFreeViewportPrefetchOptions,
): boolean => {
  const { distanceToViewportBottom, hasNextChapter, streamStatus } = options;

  if (
    !hasNextChapter ||
    streamStatus !== "idle" ||
    !Number.isFinite(distanceToViewportBottom)
  ) {
    return false;
  }

  return distanceToViewportBottom <= PREMIUM_FREE_VIEWPORT_PREFETCH_DISTANCE_PX;
};
