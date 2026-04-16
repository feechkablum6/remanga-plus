import type {
  ExternalChapterParseResult,
  ExternalSourceProvider,
  SourceTitleDetails,
  SourceTitleSearchResult,
} from "./provider.interface.js";

const MANGABUFF_BASE_URL = "https://mangabuff.ru";

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

const getAbsoluteUrl = (href: string): string => new URL(href, MANGABUFF_BASE_URL).toString();

export function extractMangabuffSearchResults(html: string): SourceTitleSearchResult[] {
  const results: SourceTitleSearchResult[] = [];
  const regex =
    /<a[^>]*href="([^"]*\/manga\/([^"\/?#]+))"[^>]*class="[^"]*cards__item[^"]*"[^>]*data-id="([^"]+)"[\s\S]*?<div class="cards__name">([\s\S]*?)<\/div>/g;

  for (const match of html.matchAll(regex)) {
    const [, href, slug, titleId, rawTitleName] = match;
    results.push({
      titleId,
      slug,
      titleName: stripTags(rawTitleName),
      titleUrl: getAbsoluteUrl(href),
    });
  }

  return results;
}

export function extractMangabuffTitleDetails(
  html: string,
  titleUrl: string,
): SourceTitleDetails {
  const slug = new URL(titleUrl).pathname.split("/").filter(Boolean).at(-1) ?? "";
  const titleName =
    stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "") ||
    stripTags(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
  const aliasesBlock =
    html.match(/<h3[^>]*alternativeHeadline[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "";
  const aliases = Array.from(aliasesBlock.matchAll(/<span>([\s\S]*?)<\/span>/g))
    .map((match) => stripTags(match[1]))
    .filter(Boolean);

  const chapters = Array.from(
    html.matchAll(
      /<a[^>]*href="([^"]*\/manga\/([^"\/?#]+)\/(\d+)\/([^"\/?#]+))"[^>]*class="[^"]*chapters__item[^"]*"[\s\S]*?<div class="chapters__volume">[\s\S]*?<span>(\d+)<\/span>[\s\S]*?<div class="chapters__value">[\s\S]*?<span>([^<]+)<\/span>/g,
    ),
  ).map((match) => {
    const [, href, , rawVolume, rawChapter, volumeText, chapterText] = match;
    const volume = Number(volumeText || rawVolume);
    const chapter = stripTags(chapterText || rawChapter);

    return {
      chapterId: `${volume}-${chapter}`,
      titleId: slug,
      chapter,
      volume,
      chapterUrl: getAbsoluteUrl(href),
    };
  });

  return {
    titleId: slug,
    slug,
    titleName,
    titleUrl,
    aliases,
    chapters,
  };
}

export function extractMangabuffChapterPages(
  html: string,
  chapterUrl: string,
): ExternalChapterParseResult {
  const currentChapterMatch = html.match(/window\.current_chapter\s*=\s*(\{[\s\S]*?\});/);
  if (!currentChapterMatch) {
    throw new Error("Mangabuff chapter metadata not found");
  }

  const currentChapter = JSON.parse(currentChapterMatch[1]) as {
    chapter_id: number;
    slug: string;
    volume: number;
    chapter: string;
  };

  const pageMatches = Array.from(
    html.matchAll(
      /<div[^>]*class="[^"]*reader__item[^"]*"[^>]*data-page="(\d+)"[\s\S]*?<img[^>]*(?:src|data-src)="([^"]+)"/g,
    ),
  );

  const pages = pageMatches
    .map((match) => ({
      page: Number(match[1]),
      imageRef: getAbsoluteUrl(match[2]),
    }))
    .sort((left, right) => left.page - right.page)
    .map(({ imageRef }, index) => ({
      index,
      imageRef,
    }));

  return {
    chapterId: String(currentChapter.chapter_id),
    titleId: currentChapter.slug,
    chapter: currentChapter.chapter,
    volume: currentChapter.volume,
    chapterUrl,
    pages,
  };
}

export class MangabuffProvider implements ExternalSourceProvider {
  name = "mangabuff";

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly baseUrl: string = MANGABUFF_BASE_URL,
  ) {}

  async searchTitles(query: string): Promise<SourceTitleSearchResult[]> {
    const response = await this.fetchHtml(
      `${this.baseUrl}/search?type=manga&q=${encodeURIComponent(query)}`,
    );
    return extractMangabuffSearchResults(response);
  }

  async getTitleDetails(titleRef: string): Promise<SourceTitleDetails> {
    const titleUrl = titleRef.startsWith("http")
      ? titleRef
      : `${this.baseUrl}/manga/${titleRef}`;
    const response = await this.fetchHtml(titleUrl);
    return extractMangabuffTitleDetails(response, titleUrl);
  }

  async parseChapter(chapterRef: string): Promise<ExternalChapterParseResult> {
    const chapterUrl = chapterRef.startsWith("http")
      ? chapterRef
      : `${this.baseUrl}${chapterRef.startsWith("/") ? "" : "/"}${chapterRef}`;
    const response = await this.fetchHtml(chapterUrl);
    return extractMangabuffChapterPages(response, chapterUrl);
  }

  async fetchImage(imageRef: string): Promise<Buffer> {
    const response = await this.fetchImpl(imageRef);
    if (!response.ok) {
      throw new Error(`Mangabuff image fetch failed: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await this.fetchImpl(url);
    if (!response.ok) {
      throw new Error(`Mangabuff request failed: ${response.status}`);
    }

    return response.text();
  }
}
