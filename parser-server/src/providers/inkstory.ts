import { HttpClient } from "../http/client.js";
import type {
  ExternalChapterParseResult,
  ExternalSourceProvider,
  SourceTitleBranch,
  SourceTitleDetails,
  SourceTitleSearchResult,
  TitleDetailsOptions,
} from "./provider.interface.js";

const API_BASE = "https://api.inkstory.net";
const SITE_BASE = "https://inkstory.net";

type I18nName = { [lang: string]: string | undefined };
type AltName = { language: string; name: string };

type Book = {
  id: string;
  slug: string;
  name?: I18nName | null;
  altNames?: AltName[] | null;
};

type Branch = {
  id: string;
  chaptersCount?: number;
  editorsChoice?: boolean;
  licensed?: boolean;
  deleted?: boolean;
  moderationStatus?: string;
  updatedAt?: string;
  publishers?: Array<{ slug?: string; name?: string; kind?: string }>;
};

const labelForBranch = (
  branchId: string,
  branchMeta: Branch | undefined,
  chapterCountForBranch: number,
  fallbackOrdinal: number,
): SourceTitleBranch => {
  const publisher = branchMeta?.publishers?.find((p) => p?.kind === "TRANSLATOR") ?? branchMeta?.publishers?.[0];
  const publisherName = publisher?.name?.trim() || publisher?.slug?.trim();
  return {
    id: branchId,
    name: publisherName || `Перевод ${fallbackOrdinal}`,
    chaptersCount: chapterCountForBranch,
  };
};

type Chapter = {
  id: string;
  number: number | string;
  volume?: number | string | null;
  name?: string | null;
  donut?: boolean;
  corrupted?: boolean;
  moderationStatus?: string;
  branchId: string;
};

type Page = {
  id?: string;
  index: number;
  image: string;
};

const buildBookUrl = (slug: string): string => `${SITE_BASE}/content/${slug}`;
const buildChapterUrl = (bookSlug: string, chapterId: string): string =>
  bookSlug
    ? `${SITE_BASE}/content/${bookSlug}/${chapterId}`
    : `${SITE_BASE}/content/${chapterId}`;

/** UUID v4 pattern for InkStory chapter IDs. */
const UUID_RE = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;

/** Accept a bare UUID or a full InkStory chapter URL. */
const extractChapterUuid = (chapterRef: string): string => {
  const m = chapterRef.match(UUID_RE);
  return m?.[0] ?? chapterRef;
};

/**
 * Pick the preferred branch.
 * Filter: NOT deleted, moderationStatus === "APPROVED", chaptersCount > 0.
 * Sort: editorsChoice DESC → chaptersCount DESC → updatedAt DESC.
 * Returns null when nothing passes the filter.
 */
export const pickInkstoryBranch = (branches: unknown): Branch | null => {
  if (!Array.isArray(branches)) return null;
  const pool = (branches as Branch[]).filter(
    (b) =>
      b &&
      b.deleted !== true &&
      (b.moderationStatus ?? "APPROVED") === "APPROVED" &&
      (b.chaptersCount ?? 0) > 0,
  );
  if (pool.length === 0) return null;
  return pool
    .slice()
    .sort((a, b) => {
      const ea = a.editorsChoice ? 1 : 0;
      const eb = b.editorsChoice ? 1 : 0;
      if (eb !== ea) return eb - ea;
      const ca = a.chaptersCount ?? 0;
      const cb = b.chaptersCount ?? 0;
      if (cb !== ca) return cb - ca;
      const ta = a.updatedAt ? Date.parse(a.updatedAt) : 0;
      const tb = b.updatedAt ? Date.parse(b.updatedAt) : 0;
      return tb - ta;
    })[0];
};

const isReadableChapter = (c: Chapter | undefined | null): boolean =>
  !!c &&
  c.donut !== true &&
  c.corrupted !== true &&
  (c.moderationStatus ?? "APPROVED") === "APPROVED";

/**
 * Pick the best branchId to read from.
 *
 * InkStory has an asymmetry between `/v2/branches?book=X` (returns top-20 active
 * translation teams as metadata — editorsChoice, licensed flags, publisher names)
 * and `/v2/chapters?bookId=X` (returns every single chapter row ever stored in
 * the DB for this book, across every branch that ever existed, including branches
 * that no longer appear in /v2/branches). The chapter list is the source of truth
 * for WHAT is readable; the branch list is only useful for `editorsChoice`.
 *
 * Strategy: group chapters by branchId, count only readable ones (not donut,
 * not corrupted, APPROVED). Pick branch with the most readable chapters,
 * tie-broken by editorsChoice metadata from `/v2/branches` if present.
 */
const pickBranchIdFromChapters = (
  chapters: Chapter[],
  branchesMeta: Branch[],
): string | null => {
  const readable = chapters.filter(isReadableChapter);
  if (readable.length === 0) return null;

  const byBranch = new Map<string, number>();
  for (const c of readable) {
    byBranch.set(c.branchId, (byBranch.get(c.branchId) ?? 0) + 1);
  }
  if (byBranch.size === 0) return null;

  const metaById = new Map<string, Branch>();
  for (const b of branchesMeta) metaById.set(b.id, b);

  return Array.from(byBranch.entries())
    .sort((a, b) => {
      const ea = metaById.get(a[0])?.editorsChoice ? 1 : 0;
      const eb = metaById.get(b[0])?.editorsChoice ? 1 : 0;
      if (eb !== ea) return eb - ea;
      return b[1] - a[1];
    })[0][0];
};

const primaryTitleName = (book: Book): string => {
  const name = book.name ?? {};
  if (name.ru) return name.ru;
  if (name.en) return name.en;
  if (name.original) return name.original;
  const fallback = Object.values(name).find((v) => typeof v === "string" && v.length > 0);
  return (fallback as string | undefined) ?? "";
};

const collectAllNames = (book: Book): string[] => {
  const names: string[] = [];
  if (book.name) {
    for (const v of Object.values(book.name)) {
      if (typeof v === "string" && v.length > 0) names.push(v);
    }
  }
  for (const alt of book.altNames ?? []) {
    if (alt?.name) names.push(alt.name);
  }
  return Array.from(new Set(names));
};

export function extractInkstorySearchResults(json: unknown): SourceTitleSearchResult[] {
  if (!Array.isArray(json)) return [];
  return (json as Book[]).flatMap((book) => {
    if (!book?.slug || !book.id) return [];
    return [
      {
        titleId: book.id,
        slug: book.slug,
        titleName: primaryTitleName(book),
        titleUrl: buildBookUrl(book.slug),
      },
    ];
  });
}

type TitleDetailsPayload = {
  book?: Book | null;
  branches?: Branch[] | null;
  chapters?: Chapter[] | null;
  forcedBranchId?: string;
};

export function extractInkstoryTitleDetails(
  json: unknown,
  titleRef: string,
): SourceTitleDetails {
  const payload = (json ?? {}) as TitleDetailsPayload;
  const book = payload.book;
  if (!book?.slug) {
    return {
      titleId: titleRef,
      slug: titleRef,
      titleName: "",
      titleUrl: buildBookUrl(titleRef),
      aliases: [],
      chapters: [],
    };
  }

  const titleName = primaryTitleName(book);
  const aliases = collectAllNames(book).filter((n) => n !== titleName);

  const readableChapters = (payload.chapters ?? []).filter(isReadableChapter);
  const readableCountByBranch = new Map<string, number>();
  for (const c of readableChapters) {
    readableCountByBranch.set(c.branchId, (readableCountByBranch.get(c.branchId) ?? 0) + 1);
  }

  const branchesMeta = payload.branches ?? [];
  const metaById = new Map<string, Branch>();
  for (const b of branchesMeta) metaById.set(b.id, b);

  const allBranches: SourceTitleBranch[] = Array.from(readableCountByBranch.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, count], index) => labelForBranch(id, metaById.get(id), count, index + 1));

  const defaultBranchId = pickBranchIdFromChapters(payload.chapters ?? [], branchesMeta);
  const forced = payload.forcedBranchId;
  const chosenBranchId =
    forced && readableCountByBranch.has(forced) ? forced : defaultBranchId;

  const chaptersForBranch = chosenBranchId
    ? readableChapters.filter((c) => c.branchId === chosenBranchId)
    : [];

  return {
    titleId: book.id,
    slug: book.slug,
    titleName,
    titleUrl: buildBookUrl(book.slug),
    aliases,
    chapters: chaptersForBranch.map((c) => ({
      chapterId: c.id,
      titleId: book.slug,
      chapter: String(c.number),
      volume: Number(c.volume ?? 0) || 0,
      chapterUrl: buildChapterUrl(book.slug, c.id),
    })),
    ...(allBranches.length > 0 ? { branches: allBranches } : {}),
    ...(chosenBranchId ? { selectedBranchId: chosenBranchId } : {}),
  };
}

/**
 * `chapterRef` is either a chapter UUID or a full `/content/<slug>/<uuid>` URL.
 * Chapter UUIDs are globally unique in InkStory (they are the primary key).
 */
export function extractInkstoryChapterPages(
  json: unknown,
  chapterRef: string,
): ExternalChapterParseResult {
  const chapter = json as {
    id?: string;
    number?: number | string;
    volume?: number | string | null;
    pages?: Page[];
  } | null;

  if (!chapter || !chapter.id) {
    throw new Error(`InkStory chapter not found (null response for ${chapterRef})`);
  }

  const pages = (chapter.pages ?? [])
    .map((p) => ({
      index: p.index,
      imageRef: p.image,
    }))
    .filter((p) => p.imageRef)
    .sort((a, b) => a.index - b.index)
    .map(({ imageRef }, i) => ({ index: i, imageRef }));

  return {
    chapterId: chapter.id,
    titleId: "",
    chapter: String(chapter.number ?? ""),
    volume: Number(chapter.volume ?? 0) || 0,
    chapterUrl: buildChapterUrl("", chapter.id),
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

export class InkstoryProvider implements ExternalSourceProvider {
  name = "inkstory";
  private readonly http: HttpLike;

  constructor(httpOrFetch?: typeof fetch | HttpClient | HttpLike) {
    this.http = coerceHttp(httpOrFetch);
  }

  manualSearchUrl(query: string): string {
    return `${SITE_BASE}/content?search=${encodeURIComponent(query)}`;
  }

  async searchTitles(query: string): Promise<SourceTitleSearchResult[]> {
    const url = `${API_BASE}/v2/books?search=${encodeURIComponent(query)}`;
    const response = await this.http.request(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`InkStory search failed: ${response.status}`);
    }
    return extractInkstorySearchResults(await response.json());
  }

  async getTitleDetails(
    titleRef: string,
    options?: TitleDetailsOptions,
  ): Promise<SourceTitleDetails> {
    const bookResp = await this.http.request(`${API_BASE}/v2/books/${encodeURIComponent(titleRef)}`, {
      headers: { Accept: "application/json" },
    });
    if (!bookResp.ok) {
      return extractInkstoryTitleDetails({ book: null }, titleRef);
    }
    const book = (await bookResp.json()) as Book;
    if (!book?.slug) {
      return extractInkstoryTitleDetails({ book: null }, titleRef);
    }

    const branchesResp = await this.http.request(
      `${API_BASE}/v2/branches?book=${encodeURIComponent(book.slug)}`,
      { headers: { Accept: "application/json" } },
    );
    const branches = branchesResp.ok ? ((await branchesResp.json()) as Branch[]) : [];

    const chaptersResp = await this.http.request(
      `${API_BASE}/v2/chapters?bookId=${encodeURIComponent(book.id)}`,
      { headers: { Accept: "application/json" } },
    );
    const chapters = chaptersResp.ok ? ((await chaptersResp.json()) as Chapter[]) : [];

    return extractInkstoryTitleDetails(
      { book, branches, chapters, forcedBranchId: options?.forcedBranchId },
      titleRef,
    );
  }

  async parseChapter(chapterRef: string): Promise<ExternalChapterParseResult> {
    const uuid = extractChapterUuid(chapterRef);
    // If chapterRef was a full URL like /content/<slug>/<uuid>, preserve the
    // book slug so the returned chapterUrl matches the real website path.
    const bookSlugFromUrl = chapterRef.match(/\/content\/([^/]+)\/[a-f0-9-]{36}/i)?.[1];

    const response = await this.http.request(`${API_BASE}/v2/chapters/${uuid}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`InkStory chapter fetch failed: ${response.status}`);
    }
    const result = extractInkstoryChapterPages(await response.json(), uuid);
    if (bookSlugFromUrl) {
      result.chapterUrl = buildChapterUrl(bookSlugFromUrl, result.chapterId);
      result.titleId = bookSlugFromUrl;
    }
    return result;
  }

  async fetchImage(imageRef: string): Promise<Buffer> {
    const response = await this.http.request(imageRef);
    if (!response.ok) {
      throw new Error(`InkStory image fetch failed: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
