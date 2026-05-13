import type { TitleOverride } from "./config.js";
import type {
  ExternalChapterParseResult,
  ExternalResolveFailure,
  ExternalResolveResult,
  ExternalResolveSuccess,
  RemangaChapterReference,
  SourceProvider,
  SourceTitleDetails,
} from "./providers/provider.interface.js";
import { isExternalSourceProvider } from "./providers/provider.interface.js";
import type { ProviderProgress, ProviderResolveStatus } from "./resolve-session.js";

export interface ResolveExternalChapterArgs {
  remanga: RemangaChapterReference;
  providers: readonly SourceProvider[];
  providerPriority: readonly string[];
  titleOverrides: Record<string, TitleOverride>;
  forcedBranchId?: string;
  onProgress?: (
    providerName: string,
    status: ProviderResolveStatus,
    extra?: { reason?: ProviderProgress["reason"]; detail?: string },
  ) => void;
}

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const unique = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean)));

const buildSearchUrl = (query: string): string =>
  `https://mangabuff.ru/search?type=manga&q=${encodeURIComponent(query)}`;

const buildNormalizedDirQuery = (titleDir: string): string =>
  titleDir.replace(/[_-]+/g, " ").trim();

const matchesExactTitle = (
  details: SourceTitleDetails,
  remanga: RemangaChapterReference,
): boolean => {
  const sourceNames = unique([details.titleName, ...details.aliases]).map(normalize);
  const remangaNames = unique([remanga.titleName, ...remanga.aliases]).map(normalize);

  return remangaNames.some((name) => sourceNames.includes(name));
};

const resolveChapterMatch = (
  details: SourceTitleDetails,
  remanga: RemangaChapterReference,
) => {
  const byChapter = details.chapters.filter((chapter) => chapter.chapter === remanga.chapter);

  if (typeof remanga.tome === "number") {
    const byTome = byChapter.find((chapter) => chapter.volume === remanga.tome);
    if (byTome) return byTome;
  }

  return byChapter[0] ?? null;
};

const resolveNextChapterMatch = (
  details: SourceTitleDetails,
  matchedChapterId: string,
): ExternalResolveSuccess["nextChapter"] => {
  const matchedIndex = details.chapters.findIndex(
    (chapter) => chapter.chapterId === matchedChapterId,
  );
  if (matchedIndex <= 0) {
    return null;
  }

  const nextChapter = details.chapters[matchedIndex - 1];
  if (!nextChapter) {
    return null;
  }

  return {
    chapterId: nextChapter.chapterId,
    chapter: nextChapter.chapter,
    volume: nextChapter.volume,
    chapterUrl: nextChapter.chapterUrl,
  };
};

const createSuccessResult = (
  provider: string,
  details: SourceTitleDetails,
  parsedChapter: ExternalChapterParseResult,
): ExternalResolveSuccess => {
  const matchedChapter = resolveChapterMatch(details, {
    titleDir: "",
    titleName: details.titleName,
    aliases: details.aliases,
    tome: parsedChapter.volume,
    chapter: parsedChapter.chapter,
    chapterUrl: parsedChapter.chapterUrl,
  });

  return {
    status: "success",
    provider,
    matchedTitle: {
      titleId: details.titleId,
      slug: details.slug,
      titleName: details.titleName,
      titleUrl: details.titleUrl,
    },
    matchedChapter: {
      chapterId: matchedChapter?.chapterId ?? `${parsedChapter.volume}-${parsedChapter.chapter}`,
      chapter: matchedChapter?.chapter ?? parsedChapter.chapter,
      volume: matchedChapter?.volume ?? parsedChapter.volume,
      chapterUrl: matchedChapter?.chapterUrl ?? parsedChapter.chapterUrl,
    },
    manualUrl: parsedChapter.chapterUrl,
    nextChapter: matchedChapter
      ? resolveNextChapterMatch(details, matchedChapter.chapterId)
      : null,
    totalPages: parsedChapter.pages.length,
    pages: parsedChapter.pages,
    ...(details.branches ? { branches: details.branches } : {}),
    ...(details.selectedBranchId ? { selectedBranchId: details.selectedBranchId } : {}),
  };
};

const createFailureResult = (
  reason: ExternalResolveFailure["reason"],
  provider: string,
  manualUrl: string,
): ExternalResolveFailure => ({
  status: "failure",
  reason,
  provider,
  manualUrl,
});

// Higher rank = more informative failure. chapter_not_found means we found
// the title but the requested chapter is missing (most actionable), no_match
// means we couldn't confirm the title at all, provider_error is the least
// specific (upstream transport failure).
const failureRank = (reason: ExternalResolveFailure["reason"]): number => {
  if (reason === "chapter_not_found") return 2;
  if (reason === "no_match") return 1;
  return 0;
};

const resolveManualSearchUrl = (
  provider: SourceProvider,
  query: string,
): string => provider.manualSearchUrl?.(query) ?? buildSearchUrl(query);

type ResolveOneResult = ExternalResolveSuccess | ExternalResolveFailure;

async function resolveWithProvider(
  provider: SourceProvider,
  args: ResolveExternalChapterArgs,
  signal: AbortSignal,
): Promise<ResolveOneResult> {
  const { remanga, titleOverrides, forcedBranchId, onProgress } = args;
  const providerSearchUrl = resolveManualSearchUrl(provider, remanga.titleName);

  const abort = (): boolean => signal.aborted;

  try {
    if (typeof provider.resolveChapterDirectly === "function") {
      onProgress?.(provider.name, "searching");
      try {
        const directResult = await provider.resolveChapterDirectly(remanga);
        if (abort()) return createFailureResult("provider_error", provider.name, providerSearchUrl);
        return directResult;
      } catch {
        if (abort()) return createFailureResult("provider_error", provider.name, providerSearchUrl);
        return createFailureResult("provider_error", provider.name, providerSearchUrl);
      }
    }

    if (!isExternalSourceProvider(provider)) {
      return createFailureResult("no_match", provider.name, providerSearchUrl);
    }

    const override = titleOverrides[remanga.titleDir];
    if (override?.provider === provider.name) {
      onProgress?.(provider.name, "searching");
      if (abort()) return createFailureResult("provider_error", provider.name, providerSearchUrl);

      const details = await provider.getTitleDetails(override.titleId, { forcedBranchId });
      onProgress?.(provider.name, "loading_chapters");
      if (abort()) return createFailureResult("provider_error", provider.name, providerSearchUrl);

      const chapterMatch = resolveChapterMatch(details, remanga);
      if (!chapterMatch) {
        return createFailureResult("chapter_not_found", provider.name, details.titleUrl);
      }

      onProgress?.(provider.name, "parsing");
      if (abort()) return createFailureResult("provider_error", provider.name, providerSearchUrl);
      const parsedChapter = await provider.parseChapter(chapterMatch.chapterUrl);
      return createSuccessResult(provider.name, details, parsedChapter);
    }

    const candidateRefs = new Set<string>();
    let exactTitleWithoutChapter: SourceTitleDetails | null = null;
    let ambiguous = false;

    const queries = unique([
      remanga.titleName,
      ...remanga.aliases,
      buildNormalizedDirQuery(remanga.titleDir),
    ]);

    let successFromSearch: ExternalResolveSuccess | null = null;
    let exactMatchCount = 0;

    onProgress?.(provider.name, "searching");
    if (abort()) return createFailureResult("provider_error", provider.name, providerSearchUrl);

    searchLoop: for (const query of queries) {
      if (abort()) return createFailureResult("provider_error", provider.name, providerSearchUrl);
      const searchResults = await provider.searchTitles(query);

      for (const result of searchResults) {
        if (abort()) return createFailureResult("provider_error", provider.name, providerSearchUrl);
        const titleRef = result.slug || result.titleId;
        if (!titleRef || candidateRefs.has(titleRef)) continue;
        candidateRefs.add(titleRef);

        let details: SourceTitleDetails;
        try {
          onProgress?.(provider.name, "found_title");
          details = await provider.getTitleDetails(titleRef, { forcedBranchId });
        } catch {
          continue;
        }

        if (!matchesExactTitle(details, remanga)) continue;

        const chapterMatch = resolveChapterMatch(details, remanga);
        if (!chapterMatch) {
          exactTitleWithoutChapter ??= details;
          continue;
        }

        exactMatchCount += 1;
        if (exactMatchCount > 1) {
          ambiguous = true;
          break searchLoop;
        }

        onProgress?.(provider.name, "parsing");
        if (abort()) return createFailureResult("provider_error", provider.name, providerSearchUrl);
        const parsedChapter = await provider.parseChapter(chapterMatch.chapterUrl);
        successFromSearch = createSuccessResult(provider.name, details, parsedChapter);
        break searchLoop;
      }
    }

    if (ambiguous) {
      return createFailureResult("no_match", provider.name, providerSearchUrl);
    }

    if (successFromSearch) return successFromSearch;

    if (exactTitleWithoutChapter) {
      return createFailureResult("chapter_not_found", provider.name, exactTitleWithoutChapter.titleUrl);
    }

    return createFailureResult("no_match", provider.name, providerSearchUrl);
  } catch {
    return createFailureResult("provider_error", provider.name, providerSearchUrl);
  }
}

export async function resolveExternalChapter(
  args: ResolveExternalChapterArgs,
): Promise<ExternalResolveResult> {
  const { providers, providerPriority, onProgress } = args;

  const abortController = new AbortController();
  const { signal } = abortController;

  let settled = false;
  let successResult: ExternalResolveSuccess | null = null;
  let bestFailure: ExternalResolveFailure | null = null;

  const recordFailure = (failure: ExternalResolveFailure): void => {
    if (!bestFailure || failureRank(failure.reason) > failureRank(bestFailure.reason)) {
      bestFailure = failure;
    }
  };

  const tasks = providerPriority.map(async (providerName) => {
    const provider = providers.find((c) => c.name === providerName);
    if (!provider) return;

    try {
      const result = await resolveWithProvider(provider, args, signal);

      if (settled) return;

      if (result.status === "success") {
        settled = true;
        successResult = result;
        abortController.abort();
        onProgress?.(providerName, "success");
      } else {
        onProgress?.(providerName, "failed", { reason: result.reason });
        recordFailure(result);
      }
    } catch {
      if (!settled) {
        const failure = createFailureResult(
          "provider_error",
          providerName,
          resolveManualSearchUrl(provider, args.remanga.titleName),
        );
        onProgress?.(providerName, "failed", { reason: "provider_error" });
        recordFailure(failure);
      }
    }
  });

  await Promise.all(tasks);

  if (successResult) return successResult;
  if (bestFailure) return bestFailure;

  return createFailureResult("provider_error", "unknown", buildSearchUrl(args.remanga.titleName));
}
