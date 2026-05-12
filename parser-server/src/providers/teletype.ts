import { HttpClient } from "../http/client.js";
import type {
  ExternalChapterParseResult,
  ExternalResolveFailure,
  ExternalResolveResult,
  ExternalResolveSuccess,
  RemangaChapterReference,
  SourceProvider,
} from "./provider.interface.js";

const TELETYPE_BASE_URL = "https://teletype.in";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractChapterNumberFromTitle = (title: string): string | null => {
  const patterns = [
    /глав[аы]\s*(\d+)/i,
    /(\d+)\s*глав[аы]/i,
    /chapter\s*(\d+)/i,
    /(\d+)\s*chapter/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1];
  }

  return null;
};

interface TeletypeSearchArticle {
  id: number;
  uri: string;
  title: string;
  author: { id: number; uri: string; name: string };
}

interface TeletypeMatchResult {
  articleId: string;
  chapter: string;
  articleUrl: string;
  titleName: string;
}

const normalizeForMatch = (value: string): string =>
  normalize(value).replace(/\s+/g, " ").trim();

const titleContainsName = (articleTitle: string, remangaNames: string[]): boolean => {
  const normalizedArticleTitle = normalizeForMatch(articleTitle);
  return remangaNames.some((name) => {
    const normalizedName = normalizeForMatch(name);
    return normalizedName.length > 0 && normalizedArticleTitle.includes(normalizedName);
  });
};

export const extractTeletypeSearchResults = (
  initialState: unknown,
  remangaTitleName: string,
  remangaChapter: string,
): TeletypeMatchResult[] => {
  const state = initialState as {
    search?: { search?: { articles?: TeletypeSearchArticle[] } };
  };
  const articles = state?.search?.search?.articles;
  if (!Array.isArray(articles)) return [];

  const remangaNames = [remangaTitleName].filter(Boolean).map(normalizeForMatch);

  return articles.reduce<TeletypeMatchResult[]>((acc, article) => {
    if (!article?.uri || !article?.title) return acc;

    const chapterNum = extractChapterNumberFromTitle(article.title);
    if (chapterNum !== remangaChapter) return acc;

    if (!titleContainsName(article.title, [remangaTitleName])) return acc;

    const authorUri = article.author?.uri;
    if (!authorUri) return acc;

    acc.push({
      articleId: String(article.id),
      chapter: chapterNum,
      articleUrl: `${TELETYPE_BASE_URL}/@${authorUri}/${article.uri}`,
      titleName: article.title.replace(/\s*✓\s*/, "").replace(/\s*-\s*\d+\s*глав[аы]\s*/i, "").trim(),
    });

    return acc;
  }, []);
};

export const extractTeletypeArticlePages = (text: string): ExternalChapterParseResult["pages"] => {
  const imageRegex = /<image\s+src="([^"]+teletype\.in\/files\/[^"]+)"/g;
  const pages: ExternalChapterParseResult["pages"] = [];
  let index = 0;

  for (const match of text.matchAll(imageRegex)) {
    pages.push({ index, imageRef: match[1] });
    index += 1;
  }

  return pages;
};

const extractInitialState = (html: string): unknown => {
  const marker = "window.__INITIAL_STATE__=";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;

  const jsonStart = startIdx + marker.length;

  const afterMarker = html.slice(jsonStart);
  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;

  for (let i = 0; i < afterMarker.length; i += 1) {
    const ch = afterMarker[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"' && !escape) {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth += 1;
    if (ch === "}" || ch === "]") depth -= 1;
    if (depth === 0 && (ch === ";" || ch === "<")) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) return null;

  try {
    return JSON.parse(afterMarker.slice(0, endIdx));
  } catch {
    return null;
  }
};

const isHttpClient = (value: unknown): value is HttpClient =>
  value instanceof HttpClient;

const coerceHttpClient = (value: typeof fetch | HttpClient | undefined): HttpClient => {
  if (!value) return new HttpClient();
  if (isHttpClient(value)) return value;
  return new HttpClient({ fetchImpl: value });
};

export class TeletypeProvider implements SourceProvider {
  name = "teletype";
  private readonly http: HttpClient;

  constructor(httpOrFetch: typeof fetch | HttpClient = fetch) {
    this.http = coerceHttpClient(httpOrFetch);
  }

  manualSearchUrl(query: string): string {
    return `${TELETYPE_BASE_URL}/search?query=${encodeURIComponent(query)}`;
  }

  async resolveChapterDirectly(
    remanga: RemangaChapterReference,
  ): Promise<ExternalResolveResult> {
    const searchQuery = `${remanga.titleName} ${remanga.chapter}`;
    const searchUrl = this.manualSearchUrl(searchQuery);
    const manualUrl = searchUrl;

    try {
      const searchHtml = await this.fetchHtml(searchUrl);
      const initialState = extractInitialState(searchHtml);
      if (!initialState) {
        return createFailureResult("provider_error", this.name, manualUrl);
      }

      const matches = extractTeletypeSearchResults(
        initialState,
        remanga.titleName,
        remanga.chapter,
      );

      if (matches.length === 0) {
        return createFailureResult("no_match", this.name, manualUrl);
      }

      const match = matches[0];
      const articleHtml = await this.fetchHtml(match.articleUrl);
      const articleState = extractInitialState(articleHtml);
      if (!articleState) {
        return createFailureResult("provider_error", this.name, match.articleUrl);
      }

      const articles = (articleState as { articles?: { items?: Record<string, { text?: string }> } })
        ?.articles?.items;
      const articleData = articles?.[match.articleId];
      const text = articleData?.text;

      if (!text) {
        return createFailureResult("chapter_not_found", this.name, match.articleUrl);
      }

      const pages = extractTeletypeArticlePages(text);
      if (pages.length === 0) {
        return createFailureResult("chapter_not_found", this.name, match.articleUrl);
      }

      const success: ExternalResolveSuccess = {
        status: "success",
        provider: this.name,
        matchedTitle: {
          titleId: match.articleId,
          slug: match.articleId,
          titleName: match.titleName,
          titleUrl: match.articleUrl,
        },
        matchedChapter: {
          chapterId: `teletype-${match.articleId}`,
          chapter: match.chapter,
          volume: 0,
          chapterUrl: match.articleUrl,
        },
        manualUrl: match.articleUrl,
        nextChapter: null,
        totalPages: pages.length,
        pages,
        unverified: true,
      };

      return success;
    } catch {
      return createFailureResult("provider_error", this.name, manualUrl);
    }
  }

  async parseChapter(chapterRef: string): Promise<ExternalChapterParseResult> {
    const articleUrl = chapterRef.startsWith("http")
      ? chapterRef
      : `${TELETYPE_BASE_URL}${chapterRef.startsWith("/") ? "" : "/"}${chapterRef}`;

    const html = await this.fetchHtml(articleUrl);
    const initialState = extractInitialState(html);
    if (!initialState) {
      throw new Error("Teletype article initial state not found");
    }

    const uri = articleUrl.split("/").filter(Boolean).at(-1) ?? "";
    const articleData = (initialState as { articles?: { items?: Record<string, { text?: string }> } })
      ?.articles?.items?.[uri];
    const text = articleData?.text;

    if (!text) {
      throw new Error("Teletype article text not found");
    }

    const pages = extractTeletypeArticlePages(text);

    return {
      chapterId: `teletype-${uri}`,
      titleId: uri,
      chapter: "",
      volume: 0,
      chapterUrl: articleUrl,
      pages,
    };
  }

  async fetchImage(imageRef: string): Promise<Buffer> {
    const response = await this.http.request(imageRef);
    if (!response.ok) {
      throw new Error(`Teletype image fetch failed: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await this.http.request(url);
    if (!response.ok) {
      throw new Error(`Teletype request failed: ${response.status}`);
    }
    return response.text();
  }
}

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