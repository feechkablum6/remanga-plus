// Pure resolver for remanga bookmark category names.
// Source order: (1) existing remanga.org tabs that already have the data,
// (2) fresh chrome.storage.local cache, (3) background hidden tab that loads
// /user/bookmarks just long enough to read the DOM, (4) stale cache as
// last-resort fallback.

export interface BookmarkType {
  typeId: number;
  name: string;
}

export interface CachedBookmarkTypes {
  types: BookmarkType[];
  updatedAt: number;
}

export interface ResolverDeps {
  readFromExistingTabs: () => Promise<BookmarkType[]>;
  readCached: () => Promise<CachedBookmarkTypes | null>;
  writeCached: (types: BookmarkType[]) => Promise<void>;
  openHiddenTabAndRead: () => Promise<BookmarkType[]>;
  now: () => number;
}

export const BOOKMARK_TYPES_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function resolveRemangaBookmarkTypes(deps: ResolverDeps): Promise<BookmarkType[]> {
  const live = await deps.readFromExistingTabs();
  if (live.length > 0) {
    await deps.writeCached(live);
    return live;
  }

  const cached = await deps.readCached();
  if (cached && cached.types.length > 0 && deps.now() - cached.updatedAt < BOOKMARK_TYPES_CACHE_TTL_MS) {
    return cached.types;
  }

  const fromHidden = await deps.openHiddenTabAndRead();
  if (fromHidden.length > 0) {
    await deps.writeCached(fromHidden);
    return fromHidden;
  }

  if (cached && cached.types.length > 0) return cached.types;
  return [];
}
