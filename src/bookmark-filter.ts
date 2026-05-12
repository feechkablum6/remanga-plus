export const BOOKMARK_CATEGORIES = [
  { name: "Читаю", key: "reading" },
  { name: "Буду читать", key: "planned" },
  { name: "Прочитано", key: "completed" },
  { name: "Брошено", key: "dropped" },
  { name: "Не интересно", key: "notInterest" },
  { name: "Любимое", key: "favorite" },
] as const;

export type BookmarkCategoryKey = typeof BOOKMARK_CATEGORIES[number]["key"];

export interface HomeBookmarksCache {
  dirs: Record<string, string[]>;
  userId: number;
  updatedAt: number;
}

export const HOME_BOOKMARKS_CACHE_KEY = "rre:homeBookmarkDirs";
export const HOME_BOOKMARKS_CACHE_TTL_MS = 30 * 60 * 1000;

export const LOAD_HOME_BOOKMARKS_MESSAGE_TYPE = "rre/load-home-bookmarks";

export interface LoadHomeBookmarksResponse {
  dirs: Record<string, string[]>;
}

const MANGA_DIR_PATTERN = /^\/manga\/([^/]+)/;

export function extractDirFromHref(href: string): string | null {
  try {
    const url = new URL(href, "https://remanga.org");
    const match = url.pathname.match(MANGA_DIR_PATTERN);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getFilteredDirs(
  dirs: Record<string, string[]>,
  categories: Record<string, boolean>,
): Set<string> {
  const activeKeys = new Set<string>();
  for (const [key, enabled] of Object.entries(categories)) {
    if (enabled) activeKeys.add(key);
  }
  if (activeKeys.size === 0) return new Set();

  const result = new Set<string>();
  for (const [dir, keys] of Object.entries(dirs)) {
    if (keys.some((k) => activeKeys.has(k))) {
      result.add(dir);
    }
  }
  return result;
}

export function isHomePage(): boolean {
  const path = window.location.pathname;
  return path === "/" || path === "";
}