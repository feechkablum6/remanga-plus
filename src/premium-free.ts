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

export type PremiumFreeBranch = {
  id: string;
  name: string;
  chaptersCount: number;
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
  branches?: PremiumFreeBranch[];
  selectedBranchId?: string;
  unverified?: boolean;
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
  | "install_required"
  | "resolve_timeout";

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

export type ProviderPhase = "connecting" | "searching" | "found" | "not_found";

export type ProviderChipStatus =
  | "pending"
  | "searching"
  | "found_title"
  | "loading_chapters"
  | "parsing"
  | "success"
  | "not_found"
  | "provider_error";

export type ProviderChipInfo = {
  name: string;
  displayName: string;
  status: ProviderChipStatus;
};

export type StatusBlockPhase = {
  phase: ProviderPhase;
  providers: ProviderChipInfo[];
};

export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  mangabuff: "Mangabuff",
  senkuro: "Senkuro",
  inkstory: "InkStory",
  telemanga: "Telemanga",
  teletype: "Teletype",
  usagi: "Usagi",
  wamanga: "WaManga",
};

export const mapServerProgressToChips = (
  providers: Record<string, { status: string; reason?: string; detail?: string }>,
): ProviderChipInfo[] => {
  const result: ProviderChipInfo[] = [];
  for (const [name, progress] of Object.entries(providers)) {
    let chipStatus: ProviderChipStatus;
    switch (progress.status) {
      case "pending":
        chipStatus = "pending";
        break;
      case "searching":
        chipStatus = "searching";
        break;
      case "found_title":
        chipStatus = "found_title";
        break;
      case "loading_chapters":
        chipStatus = "loading_chapters";
        break;
      case "parsing":
        chipStatus = "parsing";
        break;
      case "success":
        chipStatus = "success";
        break;
      case "failed":
        chipStatus = progress.reason === "no_match" ? "not_found" : "provider_error";
        break;
      default:
        chipStatus = "pending";
    }
    result.push({
      name,
      displayName: PROVIDER_DISPLAY_NAMES[name] ?? name,
      status: chipStatus,
    });
  }
  return result;
};

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

const displayProviderName = (provider: string): string =>
  PROVIDER_DISPLAY_NAMES[provider] ?? provider;

const createParserServerFailure = (
  reason: PremiumFreeClientFailureReason,
  detail?: string,
): PremiumFreeClientFailure => ({
  status: "failure",
  reason,
  provider: "unknown",
  manualUrl: "",
  ...(detail ? { detail } : {}),
});

const EXTENSION_CONTEXT_INVALIDATED_RE = /invalidated/i;

const isExtensionContextInvalidated = (): boolean => {
  if (typeof chrome === "undefined") return true;
  if (!chrome.runtime?.id) return true;
  return false;
};

export const EXTENSION_CONTEXT_INVALIDATED_DETAIL =
  "Extension context invalidated. Reload the page.";

export const isExtensionContextInvalidatedDetail = (detail: string | undefined): boolean =>
  typeof detail === "string" && detail.includes("Extension context invalidated");

export const ensureParserServerReady = async (): Promise<ParserServerEnsureResult> => {
  if (isExtensionContextInvalidated()) {
    return {
      status: "failed",
      detail: "Extension context invalidated. Reload the page.",
    };
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: ENSURE_PARSER_SERVER_MESSAGE_TYPE },
      (response: unknown) => {
        const runtimeError = chrome.runtime?.lastError?.message;
        if (runtimeError) {
          if (EXTENSION_CONTEXT_INVALIDATED_RE.test(runtimeError)) {
            return resolve({
              status: "install_required",
              detail: "Extension context invalidated. Reload the page.",
            });
          }
          resolve({
            status: "failed",
            detail: runtimeError,
          });
          return;
        }

        if (isExtensionContextInvalidated()) {
          resolve({
            status: "install_required",
            detail: "Extension context invalidated. Reload the page.",
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

const buildOpenLabel = (provider: string, { manual = false }: { manual?: boolean } = {}): string => {
  if (provider === "unknown") {
    return manual ? "Открыть источник вручную" : "Открыть источник";
  }
  const name = displayProviderName(provider);
  return manual ? `Открыть ${name} вручную` : `Открыть ${name}`;
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
    if (isExtensionContextInvalidatedDetail(failure.detail)) {
      return {
        title: "Premium Free",
        copy: "Расширение обновилось. Перезагрузите страницу.",
      };
    }
    return {
      title: "Premium Free",
      copy:
        "Native Messaging host не установлен. Выполни установку launcher-а и обнови страницу.",
      linkHref: fallbackUrl,
      linkLabel: buildOpenLabel(failure.provider, { manual: true }),
    };
  }

  if (failure.reason === "resolver_unavailable") {
    const detail = failure.detail ? `\n${failure.detail}` : "";
    return {
      title: "Premium Free",
      copy: `Parser-server не запустился.${detail}`,
    };
  }

  if (failure.reason === "resolve_timeout") {
    return {
      title: "Premium Free",
      copy: "Поиск главы занял слишком много времени. Можно попробовать снова.",
    };
  }

  if (failure.reason === "chapter_not_found") {
    return {
      title: "Premium Free",
      copy: "Тайтл найден, но нужная глава не обнаружена у текущего источника.",
      linkHref: fallbackUrl,
      linkLabel: buildOpenLabel(failure.provider),
    };
  }

  if (failure.reason === "provider_error") {
    return {
      title: "Premium Free",
      copy: "Parser-server или внешний источник вернул ошибку. Можно открыть главу вручную.",
      linkHref: fallbackUrl,
      linkLabel: buildOpenLabel(failure.provider),
    };
  }

  return {
    title: "Premium Free",
    copy: "Не удалось надёжно сопоставить главу. Можно открыть источник вручную.",
    linkHref: fallbackUrl,
    linkLabel: buildOpenLabel(failure.provider),
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

const incrementPremiumFreeChapterLabel = (chapter: string): string | null => {
  const normalized = normalizeWhitespace(chapter);
  const match = normalized.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    return null;
  }

  return String(Number(match[1]) + 1);
};

export const createPremiumFreeSyntheticNextReference = (
  currentReference: RemangaChapterReference,
): RemangaChapterReference | null => {
  const nextChapter = incrementPremiumFreeChapterLabel(currentReference.chapter);
  if (!nextChapter) {
    return null;
  }

  return {
    titleDir: currentReference.titleDir,
    titleName: currentReference.titleName,
    aliases: currentReference.aliases,
    tome: currentReference.tome,
    chapter: nextChapter,
    chapterUrl: currentReference.chapterUrl,
  };
};

const normalizeChapterForCompare = (chapter: string): string =>
  normalizeWhitespace(chapter);

export const isPremiumFreeResolveUsableForReference = (
  reference: RemangaChapterReference,
  result: PremiumFreeResolveSuccess,
): boolean => {
  if (result.totalPages <= 0 || result.pages.length <= 0) {
    return false;
  }

  if (
    normalizeChapterForCompare(result.matchedChapter.chapter) !==
    normalizeChapterForCompare(reference.chapter)
  ) {
    return false;
  }

  return (
    typeof reference.tome !== "number" ||
    result.matchedChapter.volume === reference.tome
  );
};

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

/**
 * Per-title user preference for which translation branch to use.
 *
 * Keyed by plain `titleDir` (not provider+titleDir) because the client sends
 * the preference *before* it knows which provider will win the resolve.
 * The value carries `provider` so we can detect staleness: if the preference
 * was set when source X was used but the resolver now returns source Y,
 * the provider-specific `branchId` will simply not match any real branch in Y
 * and the provider-side extractor will fall back to its default pick
 * (see `extractInkstoryTitleDetails.chosenBranchId` fallback logic).
 */
export type PremiumFreeBranchPreference = {
  provider: string;
  branchId: string;
};

export const PREMIUM_FREE_BRANCH_PREF_STORAGE_KEY =
  "premiumFreeBranchPreferences";

export const readPremiumFreeBranchPreference = (
  map: Record<string, PremiumFreeBranchPreference> | null | undefined,
  titleDir: string,
): PremiumFreeBranchPreference | null => {
  if (!map) return null;
  const entry = map[titleDir];
  if (!entry || !entry.branchId || !entry.provider) return null;
  return entry;
};

export const writePremiumFreeBranchPreference = (
  map: Record<string, PremiumFreeBranchPreference> | null | undefined,
  titleDir: string,
  pref: PremiumFreeBranchPreference,
): Record<string, PremiumFreeBranchPreference> => {
  const next = { ...(map ?? {}) };
  next[titleDir] = { provider: pref.provider, branchId: pref.branchId };
  return next;
};

/**
 * Return a new preference map with the stored entry for `titleDir` removed
 * if the client-sent `requestedBranchId` was NOT honored by the server.
 *
 * Only purges when:
 *   1. we actually sent a forcedBranchId this request (not just an initial open),
 *   2. the server returned a success with branch information, and
 *   3. the `selectedBranchId` differs from the branch we asked for.
 *
 * In all other cases the map is returned unchanged so that:
 *   - a one-off failure doesn't wipe user choice,
 *   - opening the same title via a different provider that has no branches
 *     (Mangabuff/Senkuro) keeps the InkStory pref intact for next time.
 */
export const clearStalePremiumFreeBranchPreference = (
  map: Record<string, PremiumFreeBranchPreference> | null | undefined,
  titleDir: string,
  requestedBranchId: string | null | undefined,
  result: {
    status: string;
    branches?: PremiumFreeBranch[];
    selectedBranchId?: string;
  } | null | undefined,
): Record<string, PremiumFreeBranchPreference> => {
  const current = map ?? {};
  if (!requestedBranchId) return current;
  if (!result || result.status !== "success") return current;
  if (!result.branches || result.branches.length === 0) return current;
  if (result.selectedBranchId === requestedBranchId) return current;

  const next = { ...current };
  delete next[titleDir];
  return next;
};

export const REMANGA_MARK_VIEWED_URL =
  "https://api.remanga.org/api/activity/views/";

export type MarkChapterViewedRequest = {
  url: string;
  method: "POST";
  headers: {
    Authorization: string;
    "Content-Type": "application/json";
  };
  body: string;
  credentials: "omit";
};

export const readRemangaAuthToken = (cookie: string): string | null => {
  if (!cookie) {
    return null;
  }

  for (const part of cookie.split(";")) {
    const [rawKey, ...rest] = part.split("=");
    if (rawKey?.trim() !== "token") {
      continue;
    }

    const rawValue = rest.join("=").trim();
    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
};

export const buildMarkChapterViewedRequest = (
  chapterId: number,
  token: string,
): MarkChapterViewedRequest | null => {
  if (!Number.isInteger(chapterId) || chapterId <= 0) {
    return null;
  }

  if (!token) {
    return null;
  }

  return {
    url: REMANGA_MARK_VIEWED_URL,
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chapter: chapterId }),
    credentials: "omit",
  };
};

export type MarkRemangaChapterAsViewedOptions = {
  chapterId: number;
  cookie: string;
  fetchImpl: typeof fetch;
};

export const markRemangaChapterAsViewed = async (
  options: MarkRemangaChapterAsViewedOptions,
): Promise<boolean> => {
  const token = readRemangaAuthToken(options.cookie);
  if (!token) {
    return false;
  }

  const request = buildMarkChapterViewedRequest(options.chapterId, token);
  if (!request) {
    return false;
  }

  try {
    const response = await options.fetchImpl(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      credentials: request.credentials,
    });

    return response.ok;
  } catch {
    return false;
  }
};
