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

export interface ResolveExternalChapterArgs {
  remanga: RemangaChapterReference;
  providers: readonly SourceProvider[];
  providerPriority: readonly string[];
  titleOverrides: Record<string, TitleOverride>;
  /**
   * Optional: force the provider's branch pick to this branch id. Only applies
   * to the matched provider; ignored by providers that don't have a branch
   * concept. Clients persist this per-title when the user picks a non-default
   * translation team.
   */
  forcedBranchId?: string;
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
    return byChapter.find((chapter) => chapter.volume === remanga.tome) ?? null;
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
      chapter: parsedChapter.chapter,
      volume: parsedChapter.volume,
      chapterUrl: parsedChapter.chapterUrl,
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

export async function resolveExternalChapter(
  args: ResolveExternalChapterArgs,
): Promise<ExternalResolveResult> {
  const { remanga, providers, providerPriority, titleOverrides, forcedBranchId } = args;

  let bestFailure: ExternalResolveFailure | null = null;
  const recordFailure = (failure: ExternalResolveFailure): void => {
    if (
      !bestFailure ||
      failureRank(failure.reason) > failureRank(bestFailure.reason)
    ) {
      bestFailure = failure;
    }
  };

  for (const providerName of providerPriority) {
    const provider = providers.find((candidate) => candidate.name === providerName);
    if (!provider) {
      continue;
    }

    if (typeof provider.resolveChapterDirectly === "function") {
      try {
        const directResult = await provider.resolveChapterDirectly(remanga);
        if (directResult.status === "success") {
          return directResult;
        }
        if (directResult.status === "failure") {
          recordFailure(directResult);
        }
      } catch {
        recordFailure(createFailureResult("provider_error", provider.name, resolveManualSearchUrl(provider, remanga.titleName)));
      }
      continue;
    }

    if (!isExternalSourceProvider(provider)) {
      continue;
    }

    const providerSearchUrl = resolveManualSearchUrl(provider, remanga.titleName);

    try {
      const override = titleOverrides[remanga.titleDir];
      if (override?.provider === provider.name) {
        const details = await provider.getTitleDetails(override.titleId, { forcedBranchId });
        const chapterMatch = resolveChapterMatch(details, remanga);
        if (!chapterMatch) {
          recordFailure(
            createFailureResult("chapter_not_found", provider.name, details.titleUrl),
          );
          continue;
        }

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

      searchLoop: for (const query of queries) {
        const searchResults = await provider.searchTitles(query);

        for (const result of searchResults) {
          const titleRef = result.slug || result.titleId;
          if (!titleRef || candidateRefs.has(titleRef)) {
            continue;
          }

          candidateRefs.add(titleRef);
          let details: SourceTitleDetails;
          try {
            details = await provider.getTitleDetails(titleRef, { forcedBranchId });
          } catch {
            continue;
          }

          if (!matchesExactTitle(details, remanga)) {
            continue;
          }

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

          const parsedChapter = await provider.parseChapter(chapterMatch.chapterUrl);
          successFromSearch = createSuccessResult(provider.name, details, parsedChapter);
          break searchLoop;
        }
      }

      if (ambiguous) {
        recordFailure(createFailureResult("no_match", provider.name, providerSearchUrl));
        continue;
      }

      if (successFromSearch) {
        return successFromSearch;
      }

      if (exactTitleWithoutChapter) {
        recordFailure(
          createFailureResult(
            "chapter_not_found",
            provider.name,
            exactTitleWithoutChapter.titleUrl,
          ),
        );
        continue;
      }

      recordFailure(createFailureResult("no_match", provider.name, providerSearchUrl));
    } catch {
      recordFailure(createFailureResult("provider_error", provider.name, providerSearchUrl));
    }
  }

  if (bestFailure) {
    return bestFailure;
  }

  return createFailureResult(
    "provider_error",
    "unknown",
    buildSearchUrl(remanga.titleName),
  );
}
