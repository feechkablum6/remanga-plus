import type {
  PremiumFreeClientResolveResult,
  RemangaChapterReference,
} from "./premium-free.js";

export type PremiumFreeReaderMode = "feed" | "pager";
export type PremiumFreeState = "idle" | "resolving" | "rendering" | "error";
export type PremiumFreeStreamStatus = "idle" | "loading-next" | "error" | "exhausted";

export type PremiumFreeSuccessResult = Extract<PremiumFreeClientResolveResult, { status: "success" }>;
export type PremiumFreeFailureResult = Extract<PremiumFreeClientResolveResult, { status: "failure" }>;

export type PremiumFreeReaderState = {
  mode: PremiumFreeReaderMode;
  containerWidthVar: string | null;
  brightnessVar: string | null;
};

export type PremiumFreeStreamEntry = {
  key: string;
  reference: RemangaChapterReference;
  result: PremiumFreeSuccessResult;
  chapterLabel: string;
  previousRemangaHref?: string;
  nextRemangaHref?: string;
};

export type PremiumFreeVisiblePage = {
  key: string;
  pageIndex: number;
  ratio: number;
};

export type PremiumFreeIndicatorSnapshot = {
  chapterLabelText: string | null;
  pageCounterText: string | null;
  url: string;
  previousRemangaHref: string | null;
  nextRemangaHref: string | null;
};

export type PremiumFreeChapterStream = {
  rootKey: string;
  container: HTMLElement;
  entries: PremiumFreeStreamEntry[];
  status: PremiumFreeStreamStatus;
  errorResult: PremiumFreeFailureResult | null;
  exhaustedResult: PremiumFreeFailureResult | null;
  visiblePages: Map<HTMLElement, PremiumFreeVisiblePage>;
  indicatorSnapshot: PremiumFreeIndicatorSnapshot | null;
  activeHistoryUrl: string | null;
};

export const createPremiumFreeKey = (reference: RemangaChapterReference): string =>
  [reference.titleDir, reference.tome ?? "untomed", reference.chapter].join(":");

export const formatPremiumFreeChapterLabel = (
  tome: number | undefined,
  chapter: string,
): string => (typeof tome === "number" ? `${tome} - ${chapter}` : chapter);

export const createPremiumFreeStreamEntry = (
  reference: RemangaChapterReference,
  result: PremiumFreeSuccessResult,
  navigation?: {
    previousRemangaHref?: string;
    nextRemangaHref?: string;
  },
): PremiumFreeStreamEntry => ({
  key: createPremiumFreeKey(reference),
  reference,
  result,
  chapterLabel: formatPremiumFreeChapterLabel(
    reference.tome,
    result.matchedChapter.chapter,
  ),
  ...(navigation?.previousRemangaHref
    ? { previousRemangaHref: navigation.previousRemangaHref }
    : {}),
  ...(navigation?.nextRemangaHref
    ? { nextRemangaHref: navigation.nextRemangaHref }
    : {}),
});
