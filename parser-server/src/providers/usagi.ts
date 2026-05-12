import { HttpClient } from "../http/client.js";
import type {
  ExternalChapterParseResult,
  ExternalSourceProvider,
  SourceTitleDetails,
  SourceTitleSearchResult,
} from "./provider.interface.js";

const USAGI_BASE_URL = "https://a.zazaza.me";
const USAGI_REFERER = "https://a.zazaza.me/";

const isHttpClient = (value: unknown): value is HttpClient =>
  value instanceof HttpClient;

const coerceHttpClient = (value: typeof fetch | HttpClient | undefined): HttpClient => {
  if (!value) return new HttpClient();
  if (isHttpClient(value)) return value;
  return new HttpClient({ fetchImpl: value });
};

const decodeHtmlEntities = (value: string): string =>
  value
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");

const stripTags = (value: string): string =>
  decodeHtmlEntities(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const getAbsoluteUrl = (href: string): string =>
  new URL(href, USAGI_BASE_URL).toString();

export function extractUsagiSearchResults(html: string): SourceTitleSearchResult[] {
  const results: SourceTitleSearchResult[] = [];
  const seen = new Set<string>();

  const linkRegex = /<a[^>]*href="([^"]+)"[^>]*title="([^"]+)"[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const titleName = match[2];

    if (!href.startsWith("/") || href === "/" || href.startsWith("/search") || href.startsWith("/list") || href.startsWith("/internal") || href.startsWith("/page") || href.startsWith("/logoff") || href.startsWith("/about")) continue;

    const slug = href.replace(/^\//, "").replace(/\/$/, "");
    if (seen.has(slug)) continue;
    seen.add(slug);

    if (!titleName) continue;

    results.push({
      titleId: slug,
      slug,
      titleName: decodeHtmlEntities(titleName),
      titleUrl: getAbsoluteUrl(href),
    });
  }

  return results;
}

export function extractUsagiTitleDetails(
  html: string,
  titleUrl: string,
): SourceTitleDetails {
  const slug = new URL(titleUrl).pathname.split("/").filter(Boolean).at(-1) ?? "";
  const titleName =
    stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "") ||
    stripTags(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");

  const aliases: string[] = [];
  const aliasBlock = html.match(/<h3[^>]*class="[^"]*english[^"]*"[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "";
  if (aliasBlock) {
    for (const m of aliasBlock.matchAll(/<span>([\s\S]*?)<\/span>/g)) {
      const alias = stripTags(m[1]);
      if (alias) aliases.push(alias);
    }
  }

  const chapters: SourceTitleDetails["chapters"] = [];
  const chapterRegex = /<a[^>]*href="([^"]*\/vol(\d+)\/(\d+))[^"]*"[^>]*>/g;
  const chapterSeen = new Set<string>();

  while (true) {
    const m = chapterRegex.exec(html);
    if (!m) break;
    const href = m[1];
    const volume = Number(m[2]);
    const chapter = m[3];
    const chapterId = `${volume}-${chapter}`;

    if (chapterSeen.has(chapterId)) continue;
    chapterSeen.add(chapterId);

    chapters.push({
      chapterId,
      titleId: slug,
      chapter,
      volume,
      chapterUrl: getAbsoluteUrl(href),
    });
  }

  return {
    titleId: slug,
    slug,
    titleName,
    titleUrl,
    aliases,
    chapters,
  };
}

export function extractUsagiChapterPages(
  html: string,
  chapterUrl: string,
): ExternalChapterParseResult {
  const chapterInfoMatch = html.match(
    /chapterInfo\s*=\s*\{[^}]*'id'\s*:\s*(\d+)[^}]*'type'\s*:\s*'([^']*)'[^}]*'vol'\s*:\s*(\d+)[^}]*'num'\s*:\s*(\d+)[^}]*\}/,
  );
  if (!chapterInfoMatch) {
    throw new Error("Usagi chapter metadata not found");
  }

  const id = chapterInfoMatch[1];
  const volume = Number(chapterInfoMatch[3]);
  const num = String(chapterInfoMatch[4]);

  const pages: ExternalChapterParseResult["pages"] = [];
  const pageRegex = /\['(https?:\/\/[^']*)'\s*,\s*''\s*,\s*"([^"]+)"\s*,\s*\d+\s*,\s*\d+\]/g;

  let pageMatch: RegExpExecArray | null;
  let index = 0;
  while ((pageMatch = pageRegex.exec(html)) !== null) {
    const host = pageMatch[1];
    const path = pageMatch[2];
    const cleanPath = path.split("?")[0];
    const imageUrl = `${host}${cleanPath}`;
    pages.push({
      index,
      imageRef: imageUrl,
    });
    index++;
  }

  const titleId = String(volume);

  return {
    chapterId: id,
    titleId,
    chapter: num,
    volume,
    chapterUrl,
    pages,
  };
}

export class UsagiProvider implements ExternalSourceProvider {
  name = "usagi";
  private readonly http: HttpClient;
  private readonly baseUrl: string;

  constructor(
    httpOrFetch: typeof fetch | HttpClient = fetch,
    baseUrl: string = USAGI_BASE_URL,
  ) {
    this.http = coerceHttpClient(httpOrFetch);
    this.baseUrl = baseUrl;
  }

  manualSearchUrl(query: string): string {
    return `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
  }

  async searchTitles(query: string): Promise<SourceTitleSearchResult[]> {
    const response = await this.fetchHtml(this.manualSearchUrl(query));
    return extractUsagiSearchResults(response);
  }

  async getTitleDetails(titleRef: string): Promise<SourceTitleDetails> {
    const titleUrl = titleRef.startsWith("http")
      ? titleRef
      : `${this.baseUrl}/${titleRef}`;
    const response = await this.fetchHtml(titleUrl);
    return extractUsagiTitleDetails(response, titleUrl);
  }

  async parseChapter(chapterRef: string): Promise<ExternalChapterParseResult> {
    const chapterUrl = chapterRef.startsWith("http")
      ? chapterRef
      : `${this.baseUrl}${chapterRef.startsWith("/") ? "" : "/"}${chapterRef}`;
    const response = await this.fetchHtml(chapterUrl);
    return extractUsagiChapterPages(response, chapterUrl);
  }

  async fetchImage(imageRef: string): Promise<Buffer> {
    const response = await this.http.request(imageRef, {
      headers: { Referer: USAGI_REFERER },
    });
    if (!response.ok) {
      throw new Error(`Usagi image fetch failed: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await this.http.request(url, {
      headers: { Referer: USAGI_REFERER },
    });
    if (!response.ok) {
      throw new Error(`Usagi request failed: ${response.status} for ${url}`);
    }
    return response.text();
  }
}