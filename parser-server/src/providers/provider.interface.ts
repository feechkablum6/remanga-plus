export interface ChapterImage {
  index: number;
  originalUrl: string;
  proxyUrl: string;
}

export interface Chapter {
  chapterId: string;
  provider: string;
  images: ChapterImage[];
  totalPages: number;
}

export interface RemangaChapterReference {
  titleDir: string;
  titleName: string;
  aliases: string[];
  tome?: number;
  chapter: string;
  chapterId?: number;
  chapterUrl: string;
}

export interface SourceTitleSearchResult {
  titleId: string;
  slug: string;
  titleName: string;
  titleUrl: string;
}

export interface SourceChapterReference {
  chapterId: string;
  titleId: string;
  chapter: string;
  volume: number;
  chapterUrl: string;
}

export interface SourceTitleBranch {
  id: string;
  name: string;
  chaptersCount: number;
}

export interface SourceTitleDetails {
  titleId: string;
  slug: string;
  titleName: string;
  titleUrl: string;
  aliases: string[];
  chapters: SourceChapterReference[];
  /**
   * All readable translation branches available for this title, if the source
   * supports multiple (e.g. InkStory). Undefined when the source has no such
   * concept (Mangabuff, Senkuro-single-branch). Callers MAY render a UI picker
   * when `branches.length > 1`.
   */
  branches?: SourceTitleBranch[];
  /**
   * The id of the branch whose chapters are listed in `chapters`. Only
   * meaningful when `branches` is non-empty.
   */
  selectedBranchId?: string;
}

export interface TitleDetailsOptions {
  /** If set, the provider MUST use this branch id instead of its default pick. */
  forcedBranchId?: string;
}

export interface ExternalChapterPage {
  index: number;
  imageRef: string;
}

export interface ExternalChapterParseResult {
  chapterId: string;
  titleId: string;
  chapter: string;
  volume: number;
  chapterUrl: string;
  pages: ExternalChapterPage[];
}

export interface ExternalResolveSuccess {
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
  pages: ExternalChapterPage[];
  branches?: SourceTitleBranch[];
  selectedBranchId?: string;
}

export interface ExternalResolveFailure {
  status: "failure";
  reason: "no_match" | "chapter_not_found" | "provider_error";
  provider: string;
  manualUrl: string;
}

export type ExternalResolveResult = ExternalResolveSuccess | ExternalResolveFailure;

export interface SourceProvider {
  name: string;
  canHandle?(url: string): boolean;
  searchTitles?(query: string): Promise<SourceTitleSearchResult[]>;
  getTitleDetails?(titleRef: string, options?: TitleDetailsOptions): Promise<SourceTitleDetails>;
  manualSearchUrl?(query: string): string;
  parseChapter(chapterRef: string): Promise<Chapter | ExternalChapterParseResult>;
  fetchImage(imageRef: string): Promise<Buffer>;
}

export interface ExternalSourceProvider extends SourceProvider {
  searchTitles(query: string): Promise<SourceTitleSearchResult[]>;
  getTitleDetails(titleRef: string, options?: TitleDetailsOptions): Promise<SourceTitleDetails>;
  parseChapter(chapterRef: string): Promise<ExternalChapterParseResult>;
}

export const isExternalSourceProvider = (
  provider: SourceProvider,
): provider is ExternalSourceProvider =>
  typeof provider.searchTitles === "function" &&
  typeof provider.getTitleDetails === "function";
