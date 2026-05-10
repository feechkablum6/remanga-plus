export interface MangalibBookmark {
  bookmarkId: number;
  mangaId: number;
  slug: string;
  slugUrl: string;
  rusName: string;
  engName: string;
  shortName: string;
  status: number;        // 1..5 raw from MangaLib
  lastReadChapter: number | null;
  itemsTotal: number | null;
}

export interface RemangaBookmarkExisting {
  titleId: number;
}
