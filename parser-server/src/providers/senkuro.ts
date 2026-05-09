import { HttpClient } from "../http/client.js";
import type {
  ExternalChapterParseResult,
  ExternalSourceProvider,
  SourceTitleDetails,
  SourceTitleSearchResult,
} from "./provider.interface.js";

const GRAPHQL_ENDPOINT = "https://api.senkuro.com/graphql";
const SENKURO_BASE_URL = "https://senkuro.com";

const SEARCH_QUERY = `query SenkuroSearch($first: Int!, $search: String) {
  mangas(first: $first, search: $search) {
    edges {
      node {
        id
        slug
        status
        type
        originalName { lang content }
        titles { lang content }
        alternativeNames { lang content }
      }
    }
  }
}`;

const TITLE_QUERY = `query SenkuroManga($slug: String!) {
  manga(slug: $slug) {
    id
    slug
    status
    type
    originalName { lang content }
    titles { lang content }
    alternativeNames { lang content }
    branches { id lang chapters updatedAt }
  }
}`;

const CHAPTERS_QUERY = `query SenkuroChapters($branchId: ID!, $first: Int!, $after: String) {
  mangaChapters(branchId: $branchId, first: $first, after: $after) {
    edges {
      node { id slug number volume name branchId }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

const CHAPTERS_PAGE_SIZE = 100;
const CHAPTERS_MAX_PAGES = 20; // hard cap at 2000 chapters to avoid runaway paging

const CHAPTER_QUERY = `query SenkuroChapter($slug: String!) {
  mangaChapter(slug: $slug) {
    id
    slug
    number
    volume
    name
    manga { slug }
    branch { id lang }
    pages {
      id
      number
      image { original { url } }
    }
  }
}`;

type I18nTitle = { lang: string; content: string };
type MangaNode = {
  id: string;
  slug: string;
  originalName?: I18nTitle | null;
  titles?: I18nTitle[] | null;
  alternativeNames?: I18nTitle[] | null;
};
type BranchNode = {
  id: string;
  lang: string;
  chapters: number;
  updatedAt?: string | null;
};
type ChapterNode = {
  id: string;
  slug: string;
  number: string;
  volume: string;
  name?: string | null;
  branchId?: string;
};

const buildTitleUrl = (slug: string): string => `${SENKURO_BASE_URL}/manga/${slug}`;

/**
 * Accept either a bare chapter slug (numeric string like "156162230679782950")
 * or a full chapter URL (like "https://senkuro.com/manga/<titleSlug>/<chapterSlug>").
 * resolveExternalChapter passes chapter.chapterUrl to parseChapter, so URLs are
 * the common case.
 */
const extractChapterSlug = (chapterRef: string): string => {
  if (!chapterRef.includes("/")) return chapterRef;
  const parts = chapterRef.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? chapterRef;
};

const buildChapterUrl = (titleSlug: string, chapterSlug: string): string =>
  titleSlug
    ? `${SENKURO_BASE_URL}/manga/${titleSlug}/${chapterSlug}`
    : `${SENKURO_BASE_URL}/manga/${chapterSlug}`;

const collectAllNames = (node: MangaNode): string[] => {
  const names: string[] = [];
  if (node.originalName?.content) names.push(node.originalName.content);
  for (const t of node.titles ?? []) if (t?.content) names.push(t.content);
  for (const t of node.alternativeNames ?? []) if (t?.content) names.push(t.content);
  return Array.from(new Set(names.filter((n) => typeof n === "string" && n.length > 0)));
};

const primaryTitleName = (node: MangaNode): string => {
  const titles = node.titles ?? [];
  const ru = titles.find((t) => t?.lang === "RU" && t.content)?.content;
  if (ru) return ru;
  const en = titles.find((t) => t?.lang === "EN" && t.content)?.content;
  if (en) return en;
  const first = titles.find((t) => t?.content)?.content;
  if (first) return first;
  return node.originalName?.content ?? "";
};

/**
 * Select the preferred Russian branch among `branches`.
 * Policy: lang === "RU" and chapters > 0; sort by chapters DESC, tie-break by
 * updatedAt DESC. Returns null when no Russian branch exists — callers must
 * treat this as "no chapters available", not fall back to English branches.
 */
export const pickRuBranch = (branches: BranchNode[] | null | undefined): BranchNode | null => {
  const candidates = (branches ?? []).filter((b) => b?.lang === "RU" && b.chapters > 0);
  if (candidates.length === 0) return null;
  return candidates
    .slice()
    .sort((a, b) => {
      if (b.chapters !== a.chapters) return b.chapters - a.chapters;
      const at = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const bt = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return bt - at;
    })[0];
};

export function extractSenkuroSearchResults(json: unknown): SourceTitleSearchResult[] {
  const edges = (json as { data?: { mangas?: { edges?: Array<{ node?: MangaNode }> } } } | null)
    ?.data?.mangas?.edges;
  if (!Array.isArray(edges)) return [];
  return edges.flatMap((edge): SourceTitleSearchResult[] => {
    const node = edge?.node;
    if (!node?.slug || !node.id) return [];
    return [
      {
        titleId: node.id,
        slug: node.slug,
        titleName: primaryTitleName(node),
        titleUrl: buildTitleUrl(node.slug),
      },
    ];
  });
}

type TitleDetailsPayload = {
  manga?: (MangaNode & { branches?: BranchNode[] | null }) | null;
  chapters?: ChapterNode[] | null;
};

export function extractSenkuroTitleDetails(
  json: unknown,
  titleRef: string,
): SourceTitleDetails {
  const payload = (json ?? {}) as TitleDetailsPayload;
  const manga = payload.manga;
  if (!manga?.slug) {
    return {
      titleId: titleRef,
      slug: titleRef,
      titleName: "",
      titleUrl: buildTitleUrl(titleRef),
      aliases: [],
      chapters: [],
    };
  }

  const name = primaryTitleName(manga);
  const aliases = collectAllNames(manga).filter((n) => n !== name);
  const chapters = (payload.chapters ?? []).map((node) => ({
    chapterId: node.slug,
    titleId: manga.slug,
    chapter: node.number,
    volume: Number(node.volume) || 0,
    chapterUrl: buildChapterUrl(manga.slug, node.slug),
  }));

  return {
    titleId: manga.id,
    slug: manga.slug,
    titleName: name,
    titleUrl: buildTitleUrl(manga.slug),
    aliases,
    chapters,
  };
}

/**
 * Build an ExternalChapterParseResult from a `mangaChapter(slug:)` response.
 * `chapterRef` is the chapter's numeric slug (e.g. "156162230679782950"),
 * which is a globally-unique identifier of the MangaChapter object across
 * Senkuro — it is NOT branch-scoped, so no composite key is needed.
 */
export function extractSenkuroChapterPages(
  json: unknown,
  chapterRef: string,
): ExternalChapterParseResult {
  const chapter = (json as { data?: { mangaChapter?: unknown } } | null)?.data?.mangaChapter as
    | {
        id?: string;
        slug?: string;
        number?: string;
        volume?: string;
        manga?: { slug?: string };
        branch?: { id?: string; lang?: string };
        pages?: Array<{ number: number; image?: { original?: { url?: string } } }>;
      }
    | null
    | undefined;

  if (!chapter) {
    throw new Error(`Senkuro chapter not found (null response for ${chapterRef})`);
  }

  const pages = (chapter.pages ?? [])
    .map((p) => ({
      pageNumber: p?.number ?? 0,
      imageRef: p?.image?.original?.url ?? "",
    }))
    .filter((p) => p.imageRef)
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map(({ imageRef }, index) => ({ index, imageRef }));

  const chapterSlug = chapter.slug ?? chapterRef;
  const mangaSlug = chapter.manga?.slug ?? "";
  return {
    chapterId: chapterSlug,
    titleId: mangaSlug,
    chapter: chapter.number ?? "",
    volume: Number(chapter.volume) || 0,
    chapterUrl: buildChapterUrl(mangaSlug, chapterSlug),
    pages,
  };
}

interface HttpLike {
  request(url: string, init?: RequestInit): Promise<Response>;
}

const hasRequestMethod = (value: unknown): value is HttpLike =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { request?: unknown }).request === "function";

const coerceHttp = (value: typeof fetch | HttpClient | HttpLike | undefined): HttpLike => {
  if (!value) return new HttpClient();
  if (value instanceof HttpClient) return value;
  if (typeof value === "function") return new HttpClient({ fetchImpl: value });
  if (hasRequestMethod(value)) return value;
  return new HttpClient();
};

export class SenkuroProvider implements ExternalSourceProvider {
  name = "senkuro";
  private readonly http: HttpLike;

  constructor(httpOrFetch?: typeof fetch | HttpClient | HttpLike) {
    this.http = coerceHttp(httpOrFetch);
  }

  manualSearchUrl(query: string): string {
    return `${SENKURO_BASE_URL}/browse/manga?search=${encodeURIComponent(query)}`;
  }

  async searchTitles(query: string): Promise<SourceTitleSearchResult[]> {
    const json = await this.gql(SEARCH_QUERY, { first: 20, search: query });
    return extractSenkuroSearchResults(json);
  }

  async getTitleDetails(titleRef: string): Promise<SourceTitleDetails> {
    const titleJson = (await this.gql(TITLE_QUERY, { slug: titleRef })) as {
      data?: { manga?: (MangaNode & { branches?: BranchNode[] | null }) | null };
    };
    const manga = titleJson?.data?.manga ?? null;
    if (!manga) {
      return extractSenkuroTitleDetails({ manga: null, chapters: [] }, titleRef);
    }

    const branch = pickRuBranch(manga.branches ?? []);
    const chapters: ChapterNode[] = [];
    if (branch) {
      let after: string | undefined;
      for (let page = 0; page < CHAPTERS_MAX_PAGES; page += 1) {
        const chaptersJson = (await this.gql(CHAPTERS_QUERY, {
          branchId: branch.id,
          first: CHAPTERS_PAGE_SIZE,
          ...(after ? { after } : {}),
        })) as {
          data?: {
            mangaChapters?: {
              edges?: Array<{ node: ChapterNode }>;
              pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
            };
          };
        };
        const edges = chaptersJson?.data?.mangaChapters?.edges ?? [];
        for (const edge of edges) chapters.push(edge.node);

        const pageInfo = chaptersJson?.data?.mangaChapters?.pageInfo;
        if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
        after = pageInfo.endCursor;
      }
    }

    return extractSenkuroTitleDetails({ manga, chapters }, titleRef);
  }

  async parseChapter(chapterRef: string): Promise<ExternalChapterParseResult> {
    const slug = extractChapterSlug(chapterRef);
    const json = await this.gql(CHAPTER_QUERY, { slug });
    return extractSenkuroChapterPages(json, slug);
  }

  async fetchImage(imageRef: string): Promise<Buffer> {
    const response = await this.http.request(imageRef);
    if (!response.ok) {
      throw new Error(`Senkuro image fetch failed: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async gql(query: string, variables: Record<string, unknown>): Promise<unknown> {
    const response = await this.http.request(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      throw new Error(`Senkuro GraphQL request failed: ${response.status}`);
    }
    return response.json();
  }
}
