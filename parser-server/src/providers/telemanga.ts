import { HttpClient } from "../http/client.js";
import type {
  ExternalChapterParseResult,
  ExternalSourceProvider,
  SourceTitleDetails,
  SourceTitleSearchResult,
  TitleDetailsOptions,
} from "./provider.interface.js";

const TELEMANGA_BASE_URL = "https://telemanga.me";
const TELEMANGA_API_BASE = `${TELEMANGA_BASE_URL}/api`;
const TELEMANGA_IMAGE_HOST =
  "https://storage.yandexcloud.net/telemangacnd";
const CHAPTERS_PAGE_SIZE = 100;

const isHttpClient = (value: unknown): value is HttpClient =>
  value instanceof HttpClient;

const coerceHttpClient = (
  value: typeof fetch | HttpClient | undefined,
): HttpClient => {
  if (!value) return new HttpClient();
  if (isHttpClient(value)) return value;
  return new HttpClient({ fetchImpl: value });
};

type TelemangaMangaCard = {
  id: string;
  titleRu?: string;
  titleEn?: string;
};

type TelemangaChapterEntry = {
  id: string;
  mangaId: string;
  numeration: number;
  totalPages: number;
};

type TelemangaChapterDetail = {
  pages: string[];
};

const buildTitleUrl = (slug: string): string =>
  `${TELEMANGA_BASE_URL}/manga/${slug}/`;

const buildChapterUrl = (slug: string, numeration: number): string =>
  `${TELEMANGA_BASE_URL}/manga/${slug}/${numeration}`;

const buildImageUrl = (pagePath: string): string => {
  if (pagePath.startsWith("http://") || pagePath.startsWith("https://")) {
    return pagePath;
  }
  const cleanPath = pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
  return `${TELEMANGA_IMAGE_HOST}${cleanPath}`;
};

const pickTitleName = (card: TelemangaMangaCard): string =>
  card.titleRu?.trim() || card.titleEn?.trim() || card.id;

const buildAliases = (card: TelemangaMangaCard): string[] => {
  const aliases: string[] = [];
  const primary = pickTitleName(card);
  if (card.titleRu && card.titleRu !== primary) aliases.push(card.titleRu);
  if (card.titleEn && card.titleEn !== primary) aliases.push(card.titleEn);
  return aliases;
};

export class TelemangaProvider implements ExternalSourceProvider {
  name = "telemanga";
  private readonly http: HttpClient;

  constructor(httpOrFetch: typeof fetch | HttpClient = fetch) {
    this.http = coerceHttpClient(httpOrFetch);
  }

  manualSearchUrl(query: string): string {
    return `${TELEMANGA_BASE_URL}/search?query=${encodeURIComponent(query)}`;
  }

  async searchTitles(query: string): Promise<SourceTitleSearchResult[]> {
    const url =
      `${TELEMANGA_API_BASE}/manga/search` +
      `?query=${encodeURIComponent(query)}&offset=0&limit=${CHAPTERS_PAGE_SIZE}`;
    const response = await this.http.request(url, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Telemanga search failed: ${response.status}`);
    }
    const payload = (await response.json()) as TelemangaMangaCard[];
    if (!Array.isArray(payload)) return [];

    return payload
      .filter((card): card is TelemangaMangaCard => Boolean(card?.id))
      .map((card) => ({
        titleId: card.id,
        slug: card.id,
        titleName: pickTitleName(card),
        titleUrl: buildTitleUrl(card.id),
      }));
  }

  async getTitleDetails(
    titleRef: string,
    _options?: TitleDetailsOptions,
  ): Promise<SourceTitleDetails> {
    const slug = titleRef.replace(/^https?:\/\/[^/]+\/manga\//, "").replace(
      /\/+$/,
      "",
    );

    const titleResponse = await this.http.request(
      `${TELEMANGA_API_BASE}/manga/${encodeURIComponent(slug)}`,
      { headers: { Accept: "application/json" } },
    );
    if (!titleResponse.ok) {
      throw new Error(`Telemanga title fetch failed: ${titleResponse.status}`);
    }
    const card = (await titleResponse.json()) as TelemangaMangaCard;

    const chaptersResponse = await this.http.request(
      `${TELEMANGA_API_BASE}/manga/${encodeURIComponent(slug)}/chapters` +
        `?sortOrder=ASC&offset=0&limit=${CHAPTERS_PAGE_SIZE}`,
      { headers: { Accept: "application/json" } },
    );
    if (!chaptersResponse.ok) {
      throw new Error(
        `Telemanga chapters fetch failed: ${chaptersResponse.status}`,
      );
    }
    const chapterList =
      (await chaptersResponse.json()) as TelemangaChapterEntry[];

    return {
      titleId: slug,
      slug,
      titleName: pickTitleName(card),
      titleUrl: buildTitleUrl(slug),
      aliases: buildAliases(card),
      chapters: chapterList.map((entry) => ({
        chapterId: String(entry.numeration),
        titleId: slug,
        chapter: String(entry.numeration),
        volume: 1,
        chapterUrl: buildChapterUrl(slug, entry.numeration),
      })),
    };
  }

  async parseChapter(chapterRef: string): Promise<ExternalChapterParseResult> {
    const { slug, numeration } = parseChapterRef(chapterRef);

    const response = await this.http.request(
      `${TELEMANGA_API_BASE}/manga/${encodeURIComponent(slug)}/chapter/${numeration}`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) {
      throw new Error(`Telemanga chapter fetch failed: ${response.status}`);
    }
    const payload = (await response.json()) as TelemangaChapterDetail;

    const pages = (payload.pages ?? []).map((pagePath, index) => ({
      index,
      imageRef: buildImageUrl(pagePath),
    }));

    return {
      chapterId: String(numeration),
      titleId: slug,
      chapter: String(numeration),
      volume: 1,
      chapterUrl: buildChapterUrl(slug, numeration),
      pages,
    };
  }

  async fetchImage(imageRef: string): Promise<Buffer> {
    const response = await this.http.request(imageRef, {
      headers: { Referer: `${TELEMANGA_BASE_URL}/` },
    });
    if (!response.ok) {
      throw new Error(`Telemanga image fetch failed: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}

const parseChapterRef = (
  chapterRef: string,
): { slug: string; numeration: number } => {
  // Accepts either "{slug}/{numeration}" or full reader URL
  // "https://telemanga.me/manga/{slug}/{numeration}".
  const trimmed = chapterRef
    .replace(/^https?:\/\/[^/]+\/manga\//, "")
    .replace(/\/+$/, "");
  const parts = trimmed.split("/");
  const numerationStr = parts.pop();
  const slug = parts.join("/");
  const numeration = Number(numerationStr);
  if (!slug || !Number.isFinite(numeration)) {
    throw new Error(`Invalid Telemanga chapter ref: ${chapterRef}`);
  }
  return { slug, numeration };
};
