import type {
  RecommendationTypeKey,
  RecommendationTypeState,
} from "./settings.js";

export type BookmarkTitle = {
  id: number;
  dir: string;
  genres: string[];
  categories: string[];
  typeName: string;
};

export type GenreProfile = {
  genres: Record<string, number>;
  categories: Record<string, number>;
  bookmarkIds: Set<number>;
  bookmarkDirs: Set<string>;
  updatedAt: number;
};

export type NativeCard = {
  id: number;
  dir: string;
  element: HTMLElement;
};

export type RecCandidate = {
  id: number;
  dir: string;
  img: string;
  mainName: string;
  typeName: string;
  issueYear: number | null;
  rating: number;
  genres: string[];
  // Remanga's catalog returns the viewer's own bookmark status per title when
  // the request is authenticated (e.g. "Прочитано"). Non-null means the user
  // already has it, so it must never be recommended.
  bookmarkType: string | null;
};

const BOOKMARK_TYPE_WEIGHT: Record<string, number> = {
  "Читаю": 3,
  "В процессе": 2,
  "Планирую": 1,
  "Брошено": 1,
  "Прочитано": 1,
  "Отложено": 1,
};

export const buildGenreProfile = (bookmarks: BookmarkTitle[]): GenreProfile => {
  const genres: Record<string, number> = {};
  const categories: Record<string, number> = {};
  const bookmarkIds = new Set<number>();
  const bookmarkDirs = new Set<string>();

  for (const b of bookmarks) {
    bookmarkIds.add(b.id);
    bookmarkDirs.add(b.dir);
    const weight = BOOKMARK_TYPE_WEIGHT[b.typeName] ?? 1;
    for (const g of b.genres) {
      genres[g] = (genres[g] ?? 0) + weight;
    }
    for (const c of b.categories) {
      categories[c] = (categories[c] ?? 0) + weight;
    }
  }

  return { genres, categories, bookmarkIds, bookmarkDirs, updatedAt: Date.now() };
};

export const filterNativeCards = (
  cards: NativeCard[],
  profile: GenreProfile,
): NativeCard[] =>
  cards.filter(
    (c) => !profile.bookmarkIds.has(c.id) && !profile.bookmarkDirs.has(c.dir),
  );

export const pickSupplements = (
  candidates: RecCandidate[],
  profile: GenreProfile,
  maxCount: number,
): RecCandidate[] => {
  const eligible = candidates.filter(
    (c) =>
      c.bookmarkType === null &&
      !profile.bookmarkIds.has(c.id) &&
      !profile.bookmarkDirs.has(c.dir),
  );

  const scored = eligible.map((c) => {
    let score = 0;
    for (const g of c.genres) {
      score += profile.genres[g] ?? 0;
    }
    return { candidate: c, score };
  });

  scored.sort((a, b) => b.score - a.score || b.candidate.rating - a.candidate.rating);

  return scored.slice(0, maxCount).map((s) => s.candidate);
};

export const selectTopGenres = (profile: GenreProfile, count: number): string[] =>
  Object.entries(profile.genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, count))
    .map(([name]) => name);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const readNamedList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const name = record?.name;
    if (typeof name === "string" && name.length > 0) out.push(name);
  }
  return out;
};

const readTypeName = (value: unknown): string => {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  return typeof record?.name === "string" ? record.name : "";
};

const readCoverPath = (item: Record<string, unknown>): string => {
  for (const key of ["cover", "img"]) {
    const cover = asRecord(item[key]);
    if (!cover) continue;
    for (const size of ["mid", "high", "low"]) {
      const path = cover[size];
      if (typeof path === "string" && path.length > 0) return path;
    }
  }
  return "";
};

const readNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

// Remanga catalog (`/api/search/catalog/`) returns each title's genres as
// `[{id,name}]`; we flatten to names so they line up with the genre profile
// keys built from bookmark genres.
export const parseCatalogCandidates = (raw: unknown): RecCandidate[] => {
  const body = asRecord(raw);
  const content = body?.content;
  if (!Array.isArray(content)) return [];

  const out: RecCandidate[] = [];
  for (const entry of content) {
    const item = asRecord(entry);
    if (!item) continue;
    const id = item.id;
    const dir = item.dir;
    if (typeof id !== "number" || typeof dir !== "string") continue;

    const issueYearRaw = item.issue_year;
    out.push({
      id,
      dir,
      img: readCoverPath(item),
      mainName:
        (typeof item.main_name === "string" && item.main_name) ||
        (typeof item.rus_name === "string" && item.rus_name) ||
        (typeof item.secondary_name === "string" && item.secondary_name) ||
        dir,
      typeName: readTypeName(item.type),
      issueYear:
        typeof issueYearRaw === "number" && Number.isFinite(issueYearRaw)
          ? issueYearRaw
          : null,
      rating: readNumber(item.avg_rating),
      genres: readNamedList(item.genres),
      bookmarkType:
        typeof item.bookmark_type === "string" && item.bookmark_type.length > 0
          ? item.bookmark_type
          : null,
    });
  }
  return out;
};

// Builds a genre name → numeric id map from a title-detail or catalog payload.
// The catalog filter (`?genres=<id>`) needs ids, but the genre profile is keyed
// by name, so we collect ids alongside the genre names we already parse.
export const parseGenreIdMap = (raw: unknown): Record<string, number> => {
  const body = asRecord(raw);
  const content = asRecord(body?.content) ?? body;
  const genres = content?.genres;
  const map: Record<string, number> = {};
  if (!Array.isArray(genres)) return map;
  for (const item of genres) {
    const record = asRecord(item);
    const name = record?.name;
    const id = record?.id;
    if (typeof name === "string" && typeof id === "number") map[name] = id;
  }
  return map;
};
export const parseTitleDetailGenres = (
  raw: unknown,
): { id: number; dir: string; genres: string[]; categories: string[] } | null => {
  const body = asRecord(raw);
  const content = asRecord(body?.content) ?? body;
  if (!content) return null;
  const dir = content.dir;
  if (typeof dir !== "string") return null;
  const id = typeof content.id === "number" ? content.id : 0;
  return {
    id,
    dir,
    genres: readNamedList(content.genres),
    categories: readNamedList(content.categories),
  };
};

// Maps a remanga content type name to a three-state toggle key.
// Unknown types (Западный, Руманга, Комикс, OEL etc.) return null —
// they pass through as neutral and cannot be excluded or prioritised.
const REC_TYPE_NAME_TO_KEY: Record<string, RecommendationTypeKey> = {
  манга: "manga",
  манхва: "manhwa",
  маньхуа: "manhua",
};

export const classifyRecommendationType = (
  typeName: string | undefined,
): RecommendationTypeKey | null => {
  if (!typeName) return null;
  const normalized = typeName.trim().toLowerCase();
  return REC_TYPE_NAME_TO_KEY[normalized] ?? null;
};

// Stable filter + reorder: excluded types are removed; priority types come first
// (original order preserved within each group); neutral/unclassified types follow.
// Items that cannot be classified by getTypeKey are treated as neutral.
export const applyTypePreferences = <T>(
  items: readonly T[],
  prefs: Record<RecommendationTypeKey, RecommendationTypeState>,
  getTypeKey: (item: T) => RecommendationTypeKey | null,
): T[] => {
  const excluded = new Set<RecommendationTypeKey>();
  const priority = new Set<RecommendationTypeKey>();
  for (const key of ["manga", "manhwa", "manhua"] as const) {
    if (prefs[key] === "excluded") excluded.add(key);
    else if (prefs[key] === "priority") priority.add(key);
  }

  const front: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    const typeKey = getTypeKey(item);
    if (typeKey !== null && excluded.has(typeKey)) continue;
    if (typeKey !== null && priority.has(typeKey)) {
      front.push(item);
    } else {
      rest.push(item);
    }
  }
  return front.concat(rest);
};

// Accepts an arbitrary value and returns a valid preference map, ignoring
// unknown keys and invalid states. Used before storing or passing prefs between
// extension components.
export const sanitizeTypePreferences = (
  raw: unknown,
): Record<RecommendationTypeKey, RecommendationTypeState> => {
  const prefs: Record<RecommendationTypeKey, RecommendationTypeState> = {
    manga: "neutral",
    manhwa: "neutral",
    manhua: "neutral",
  };
  if (!raw || typeof raw !== "object") return prefs;
  const obj = raw as Record<string, unknown>;
  for (const key of ["manga", "manhwa", "manhua"] as const) {
    const val = obj[key];
    if (val === "neutral" || val === "priority" || val === "excluded") {
      prefs[key] = val;
    }
  }
  return prefs;
};