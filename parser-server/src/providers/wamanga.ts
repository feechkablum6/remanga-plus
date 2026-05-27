import { HttpClient } from "../http/client.js";
import type {
  ExternalChapterParseResult,
  ExternalSourceProvider,
  SourceTitleDetails,
  SourceTitleSearchResult,
  TitleDetailsOptions,
} from "./provider.interface.js";

const WAMANGA_BASE_URL = "https://wamanga.ru";
const WAMANGA_API_BASE = `${WAMANGA_BASE_URL}/api/v1`;

const isHttpClient = (value: unknown): value is HttpClient =>
  value instanceof HttpClient;

const coerceHttpClient = (
  value: typeof fetch | HttpClient | undefined,
): HttpClient => {
  if (!value) return new HttpClient();
  if (isHttpClient(value)) return value;
  return new HttpClient({ fetchImpl: value });
};

type WamangaTitleCard = {
  id: string;
  slug: string;
  title: string;
  titleEnglish?: string;
  alternateTitles?: string[];
  type: string;
};

type WamangaTitleDetail = WamangaTitleCard & {
  description?: string;
  genres?: string[];
  imageUrl?: string;
  coverUrl?: string;
  statusTitle?: string;
  isAdult?: boolean;
};

type WamangaChapterEntry = {
  id: string;
  position: number;
  totalFilesExpected: number;
  processedFilesCount: number;
};

type WamangaChapterDetail = {
  id: string;
  position: number;
  files: { id: string; diskFile: string; position: string }[];
  manga: { id: string; slug: string; title: string; type: string };
};

type WamangaSearchResponse = WamangaTitleCard[];

const SEARCH_LIMIT = 20;

const buildTitleUrl = (slug: string, type: string): string => {
  const prefix =
    type === "manga" ? "manga" : type === "manhua" ? "manhua" : "manhwa";
  return `${WAMANGA_BASE_URL}/${prefix}/${slug}`;
};

const buildChapterUrl = (
  slug: string,
  position: number,
  type: string,
): string => {
  const prefix =
    type === "manga" ? "manga" : type === "manhua" ? "manhua" : "manhwa";
  return `${WAMANGA_BASE_URL}/${prefix}/${slug}/glava-${position}`;
};

export class WamangaProvider implements ExternalSourceProvider {
  name = "wamanga";
  private readonly http: HttpClient;

  constructor(httpOrFetch: typeof fetch | HttpClient = fetch) {
    this.http = coerceHttpClient(httpOrFetch);
  }

  manualSearchUrl(query: string): string {
    return `${WAMANGA_BASE_URL}/catalog?search=${encodeURIComponent(query)}`;
  }

  async searchTitles(query: string): Promise<SourceTitleSearchResult[]> {
    const url = `${WAMANGA_API_BASE}/manga?query=${encodeURIComponent(query)}&limit=${SEARCH_LIMIT}`;
    const response = await this.http.request(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`WaManga search failed: ${response.status}`);
    }
    const payload = (await response.json()) as WamangaSearchResponse;
    if (!Array.isArray(payload)) return [];

    return payload
      .filter((card): card is WamangaTitleCard => Boolean(card?.id))
      .map((card) => ({
        titleId: card.id,
        slug: card.id,
        titleName: card.title?.trim() || card.slug,
        titleUrl: buildTitleUrl(card.slug, card.type),
      }));
  }

  async getTitleDetails(
    titleRef: string,
    _options?: TitleDetailsOptions,
  ): Promise<SourceTitleDetails> {
    const id = await this.resolveTitleId(titleRef);

    const titleResponse = await this.http.request(
      `${WAMANGA_API_BASE}/manga/${encodeURIComponent(id)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!titleResponse.ok) {
      throw new Error(
        `WaManga title fetch failed: ${titleResponse.status}`,
      );
    }
    const detail = (await titleResponse.json()) as WamangaTitleDetail;

    const chaptersResponse = await this.http.request(
      `${WAMANGA_API_BASE}/manga/${encodeURIComponent(id)}/chapters`,
      { headers: { Accept: "application/json" } },
    );
    if (!chaptersResponse.ok) {
      throw new Error(
        `WaManga chapters fetch failed: ${chaptersResponse.status}`,
      );
    }
    const chapterList =
      (await chaptersResponse.json()) as WamangaChapterEntry[];

    const aliases: string[] = [];
    if (detail.titleEnglish && detail.titleEnglish !== detail.title) {
      aliases.push(detail.titleEnglish);
    }
    if (Array.isArray(detail.alternateTitles)) {
      for (const alt of detail.alternateTitles) {
        if (alt !== detail.title && alt !== detail.titleEnglish) {
          aliases.push(alt);
        }
      }
    }

    const sortedChapters = [...chapterList].sort(
      (a, b) => a.position - b.position,
    );

    return {
      titleId: detail.id,
      slug: detail.slug,
      titleName: detail.title?.trim() || detail.slug,
      titleUrl: buildTitleUrl(detail.slug, detail.type),
      aliases,
      chapters: sortedChapters.map((entry) => ({
        chapterId: entry.id,
        titleId: detail.id,
        chapter: String(entry.position),
        volume: 1,
        chapterUrl: entry.id,
      })),
    };
  }

  async parseChapter(
    chapterRef: string,
  ): Promise<ExternalChapterParseResult> {
    const chapterId = resolveChapterId(chapterRef);

    const response = await this.http.request(
      `${WAMANGA_API_BASE}/chapters/${encodeURIComponent(chapterId)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`WaManga chapter fetch failed: ${response.status}`);
    }
    const payload = (await response.json()) as WamangaChapterDetail;

    const sortedFiles = [...payload.files].sort(
      (a, b) => parseFloat(a.position) - parseFloat(b.position),
    );

    const pages = sortedFiles.map((file, index) => ({
      index,
      imageRef: `${WAMANGA_BASE_URL}${file.diskFile}`,
    }));

    return {
      chapterId: `${payload.manga.slug}-glava-${payload.position}`,
      titleId: payload.manga.id,
      chapter: String(payload.position),
      volume: 1,
      chapterUrl: buildChapterUrl(
        payload.manga.slug,
        payload.position,
        payload.manga.type,
      ),
      pages,
    };
  }

  async fetchImage(imageRef: string): Promise<Buffer> {
    const response = await this.http.request(imageRef);
    if (!response.ok) {
      throw new Error(`WaManga image fetch failed: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async resolveTitleId(titleRef: string): Promise<string> {
    const trimmed = titleRef.trim();
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        trimmed,
      )
    ) {
      return trimmed;
    }
    const deslugged = trimmed.replace(/[-_]+/g, " ").trim();
    const results = await this.searchTitles(deslugged);
    const exactSlug = results.find(
      (r) => r.slug === trimmed || r.slug === trimmed.toLowerCase(),
    );
    if (exactSlug) return exactSlug.titleId;
    if (results.length > 0) return results[0].titleId;
    throw new Error(`WaManga: cannot resolve title ref "${trimmed}"`);
  }
}

const WAMANGA_CHAPTER_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveChapterId = (ref: string): string => {
  const trimmed = ref.trim();
  if (WAMANGA_CHAPTER_UUID_RE.test(trimmed)) return trimmed;
  return trimmed;
};