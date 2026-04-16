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

export async function resolveExternalChapter(
  args: ResolveExternalChapterArgs,
): Promise<ExternalResolveResult> {
  const { remanga, providers, providerPriority, titleOverrides } = args;
  const searchUrl = buildSearchUrl(remanga.titleName);

  for (const providerName of providerPriority) {
    const provider = providers.find((candidate) => candidate.name === providerName);
    if (!provider || !isExternalSourceProvider(provider)) {
      continue;
    }

    try {
      const override = titleOverrides[remanga.titleDir];
      if (override?.provider === provider.name) {
        const details = await provider.getTitleDetails(override.titleId);
        const chapterMatch = resolveChapterMatch(details, remanga);
        if (!chapterMatch) {
          return createFailureResult("chapter_not_found", provider.name, details.titleUrl);
        }

        const parsedChapter = await provider.parseChapter(chapterMatch.chapterUrl);
        return createSuccessResult(provider.name, details, parsedChapter);
      }

      const candidateRefs = new Set<string>();
      const exactMatches: SourceTitleDetails[] = [];
      let exactTitleWithoutChapter: SourceTitleDetails | null = null;

      const queries = unique([
        remanga.titleName,
        ...remanga.aliases,
        buildNormalizedDirQuery(remanga.titleDir),
      ]);

      for (const query of queries) {
        const searchResults = await provider.searchTitles(query);

        for (const result of searchResults) {
          const titleRef = result.slug || result.titleId;
          if (!titleRef || candidateRefs.has(titleRef)) {
            continue;
          }

          candidateRefs.add(titleRef);
          let details: SourceTitleDetails;
          try {
            details = await provider.getTitleDetails(titleRef);
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

          exactMatches.push(details);

          if (exactMatches.length > 1) {
            return createFailureResult("no_match", provider.name, searchUrl);
          }

          const parsedChapter = await provider.parseChapter(chapterMatch.chapterUrl);
          return createSuccessResult(provider.name, details, parsedChapter);
        }
      }

      if (exactTitleWithoutChapter) {
        return createFailureResult(
          "chapter_not_found",
          provider.name,
          exactTitleWithoutChapter.titleUrl,
        );
      }

      return createFailureResult("no_match", provider.name, searchUrl);
    } catch {
      return createFailureResult("provider_error", provider.name, searchUrl);
    }
  }

  return createFailureResult("provider_error", "unknown", searchUrl);
}
