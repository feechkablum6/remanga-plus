// Remanga serves the reader under two interchangeable path prefixes: the
// historical `/manga/<dir>/<chapterId>` and the current `/content/<dir>/<chapterId>`.
// Both render the same reader, the site navigates to `/content/`, and the
// in-reader prev/next links still point at `/manga/`. Every URL check therefore
// has to accept either prefix — matching only one silently disables the whole
// enhancer on half the reader URLs.
const READER_PREFIX = "(?:manga|content)";

const READER_PATHNAME_PATTERN = new RegExp(`^/${READER_PREFIX}/[^/]+/\\d+`);
const READER_LOCATION_PATTERN = new RegExp(
  `/${READER_PREFIX}/([^/]+)/(\\d+)(?:[/?#]|$)`,
);

// Title-card and chapter links appear under both prefixes across the site.
export const READER_LINK_SELECTOR = 'a[href*="/manga/"], a[href*="/content/"]';

export type RemangaChapterLocation = {
  titleDir: string;
  chapterId: number;
};

export const isReaderPathname = (pathname: string): boolean =>
  READER_PATHNAME_PATTERN.test(pathname);

export const matchReaderLocation = (
  href: string | null | undefined,
): RemangaChapterLocation | null => {
  if (!href) {
    return null;
  }

  const match = href.match(READER_LOCATION_PATTERN);
  if (!match) {
    return null;
  }

  const chapterId = Number(match[2]);
  if (!Number.isInteger(chapterId) || chapterId <= 0) {
    return null;
  }

  return { titleDir: match[1], chapterId };
};

export const matchReaderChapterId = (
  href: string | null | undefined,
): number | null => matchReaderLocation(href)?.chapterId ?? null;

// `titleDir` arrives already percent-encoded when it is read out of the page URL
// (`%3C29.04.2026%3E…`). Encoding it again turns `%3C` into `%253C` and the link
// 404s, so always decode first.
export const buildRemangaTitleUrl = (titleDir: string): string => {
  let decoded = titleDir;
  try {
    decoded = decodeURIComponent(titleDir);
  } catch {
    decoded = titleDir;
  }

  return `https://remanga.org/manga/${encodeURIComponent(decoded)}/main`;
};
