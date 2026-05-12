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
    (c) => !profile.bookmarkIds.has(c.id) && !profile.bookmarkDirs.has(c.dir),
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