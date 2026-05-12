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

const REMANGA_API = "https://api.remanga.org";

const authHeaders = (token: string): Record<string, string> => ({
  Authorization: "bearer " + token,
  Accept: "application/json",
});

export const fetchBookmarkTitles = async (
  token: string,
  userId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: number; dir: string; typeName: string }[]> => {
  const out: { id: number; dir: string; typeName: string }[] = [];
  let page = 1;
  for (;;) {
    const u = new URL(`${REMANGA_API}/api/v2/users/${userId}/bookmarks/`);
    u.searchParams.set("page", String(page));
    const r = await fetchImpl(u.toString(), {
      credentials: "omit",
      headers: authHeaders(token),
    });
    if (!r.ok) break;
    const body = (await r.json()) as {
      next?: number | null;
      results?: Array<{
        title?: { id?: number; dir?: string };
        type?: { id?: number; name?: string };
      }>;
    };
    if (!body || !Array.isArray(body.results)) break;
    for (const row of body.results) {
      const id = row.title?.id;
      const dir = row.title?.dir;
      const typeName = row.type?.name ?? "";
      if (typeof id === "number" && typeof dir === "string") {
        out.push({ id, dir, typeName });
      }
    }
    if (!body.next || body.next <= page) break;
    page = body.next;
  }
  return out;
};

export type TitleGenresResult = {
  dir: string;
  genres: string[];
  categories: string[];
};

export const fetchTitleGenres = async (
  token: string,
  dir: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TitleGenresResult | null> => {
  const r = await fetchImpl(`${REMANGA_API}/api/v2/titles/${dir}/`, {
    credentials: "omit",
    headers: authHeaders(token),
  });
  if (!r.ok) return null;
  const body = (await r.json()) as {
    genres?: Array<{ name?: string }>;
    categories?: Array<{ name?: string }>;
  };
  return {
    dir,
    genres: (body.genres ?? []).map((g) => g.name ?? "").filter(Boolean),
    categories: (body.categories ?? []).map((c) => c.name ?? "").filter(Boolean),
  };
};

export const fetchCatalogByGenres = async (
  token: string,
  topGenreNames: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<RecCandidate[]> => {
  if (topGenreNames.length === 0) return [];
  const genreQuery = topGenreNames.slice(0, 3).join(" ");
  const u = new URL(`${REMANGA_API}/api/v2/search/`);
  u.searchParams.set("query", genreQuery);
  u.searchParams.set("count", "40");
  const r = await fetchImpl(u.toString(), {
    credentials: "omit",
    headers: authHeaders(token),
  });
  if (!r.ok) return [];
  const body = (await r.json()) as {
    results?: Array<{
      id?: number;
      dir?: string;
      main_name?: string;
      secondary_name?: string;
      img?: { mid?: string } | null;
      type?: { name?: string } | null;
      issue_year?: number | null;
      rating?: { average?: number } | null;
      genres?: Array<{ name?: string }> | null;
      categories?: Array<{ name?: string }> | null;
      count_chapters?: number;
      views_count?: number;
    }>;
  };
  if (!body || !Array.isArray(body.results)) return [];
  return body.results
    .filter((r) => typeof r.id === "number" && typeof r.dir === "string")
    .map((r) => ({
      id: r.id!,
      dir: r.dir!,
      img: r.img?.mid ? `https://remanga.org${r.img.mid}` : "",
      mainName: r.main_name ?? "",
      typeName: r.type?.name ?? "",
      issueYear: r.issue_year ?? null,
      rating: r.rating?.average ?? 0,
      genres: (r.genres ?? []).map((g) => g.name ?? "").filter(Boolean),
    }));
};

export const findRecommendationsSection = (
  root: ParentNode,
): HTMLElement | null => {
  const containers = root.querySelectorAll(
    '[data-sentry-component="Container"]',
  );
  for (const container of containers) {
    if (
      container.textContent?.includes("Рекомендации для вас") &&
      container.querySelector('[data-sentry-component="DecoratedSliderWrapper"]')
    ) {
      return container as HTMLElement;
    }
  }
  return null;
};

export const extractNativeCards = (
  sliderWrapper: HTMLElement,
): NativeCard[] => {
  const items = sliderWrapper.querySelectorAll<HTMLElement>(
    '[data-slot="carousel-item"]',
  );
  const cards: NativeCard[] = [];
  for (const item of items) {
    const cardEl = item.querySelector<HTMLElement>(
      '[data-sentry-component="TitleCardRoot"]',
    );
    if (!cardEl) continue;
    const id = Number(cardEl.getAttribute("data-id"));
    const href = item.getAttribute("href") ?? "";
    const dirMatch = href.match(/\/manga\/([^/]+)\//);
    const dir = dirMatch ? dirMatch[1] : "";
    if (id && dir) {
      cards.push({ id, dir, element: item });
    }
  }
  return cards;
};

export const buildCandidateCard = (candidate: RecCandidate): HTMLAnchorElement => {
  const a = document.createElement("a");
  a.setAttribute("role", "group");
  a.setAttribute("data-slot", "carousel-item");
  a.setAttribute("aria-roledescription", "slide");
  a.className =
    "[--padding:16px] min-w-0 shrink-0 grow-0 pr-[var(--padding)] basis-[33%] max-sm:pr-2 sm:basis-1/4 md:basis-1/5 lg:basis-1/6 xl:basis-1/7";
  a.href = `/manga/${candidate.dir}/main`;

  const yearText = candidate.issueYear ? `${candidate.issueYear}` : "";

  const titleAttr = `${candidate.typeName} ${candidate.mainName} ${yearText}`.trim();

  a.innerHTML = `
    <div title="${titleAttr}" data-id="${candidate.id}" class="group cs-title-card cs-title-vertical-card relative flex h-full flex-col gap-2 overflow-hidden select-none md:gap-3 group" data-sentry-element="Component" data-sentry-component="TitleCardRoot">
      <span data-sentry-element="MediaPrimitive.Root" data-sentry-component="TitleImage" class="inline-flex shrink-0 relative aspect-[2/3] w-full overflow-hidden rounded-sm select-none">
        <img class="w-full scale-100 object-cover transition! group-hover:scale-105 transition-opacity duration-600 opacity-100" loading="lazy" src="${candidate.img}" alt="${candidate.mainName}">
        <p class="cs-text leading-md font-semibold flex flex-nowrap items-center gap-2 rounded-md px-3 py-2 text-xs leading-none select-none max-sm:px-2.5 max-sm:py-1.5 md:text-sm absolute right-1 bottom-1 bg-black/50 text-white">
          ${candidate.rating}
        </p>
      </span>
      <div class="flex flex-col gap-0.5 px-1">
        <span class="text-xs leading-none text-muted-foreground">${candidate.typeName} ${yearText}</span>
        <span class="text-sm font-medium leading-snug line-clamp-2">${candidate.mainName}</span>
      </div>
    </div>
  `;

  return a;
};

export type RecommendationDeps = {
  getToken: () => Promise<string | null>;
  getUserId: () => Promise<number | null>;
  fetchImpl?: typeof fetch;
};

const CAROUSEL_TARGET_SIZE = 10;

export const applyRecommendations = async (
  root: ParentNode,
  deps: RecommendationDeps,
): Promise<void> => {
  const section = findRecommendationsSection(root);
  if (!section) return;

  const token = await deps.getToken();
  if (!token) return;

  const userId = await deps.getUserId();
  if (!userId) return;

  const fi = deps.fetchImpl ?? fetch;

  const bookmarkTitles = await fetchBookmarkTitles(token, userId, fi);

  const genreResults = await Promise.all(
    bookmarkTitles.map((b) => fetchTitleGenres(token, b.dir, fi)),
  );

  const enrichedBookmarks: BookmarkTitle[] = bookmarkTitles.map((b, i) => {
    const gr = genreResults[i];
    return {
      id: b.id,
      dir: b.dir,
      genres: gr?.genres ?? [],
      categories: gr?.categories ?? [],
      typeName: b.typeName,
    };
  });

  const profile = buildGenreProfile(enrichedBookmarks);

  const slider = section.querySelector<HTMLElement>(
    '[data-sentry-component="DecoratedSliderWrapper"]',
  );
  if (!slider) return;

  const nativeCards = extractNativeCards(slider);
  const kept = filterNativeCards(nativeCards, profile);

  const keptCount = kept.length;
  const needed = Math.max(0, CAROUSEL_TARGET_SIZE - keptCount);

  let supplements: RecCandidate[] = [];
  if (needed > 0) {
    const topGenreNames = Object.entries(profile.genres)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name]) => name);

    supplements = await fetchCatalogByGenres(token, topGenreNames, fi);
    supplements = pickSupplements(supplements, profile, needed);
  }

  const carouselContent = slider.querySelector<HTMLElement>(
    '[data-slot="carousel-content"] > div, [data-slot="carousel-content"]',
  );
  if (!carouselContent) return;

  for (const card of nativeCards) {
    const isKept = kept.some((k) => k.id === card.id);
    if (!isKept) {
      card.element.remove();
    }
  }

  for (const candidate of supplements) {
    const newCard = buildCandidateCard(candidate);
    carouselContent.appendChild(newCard);
  }

  const badgeSpan = section.querySelector<HTMLElement>(
    "span.text-lg.leading-none.font-semibold.text-white.uppercase.italic",
  );
  if (badgeSpan) {
    badgeSpan.textContent = "Рекомендации для вас";
    badgeSpan.setAttribute("data-rre-recommendations", "true");
  }
};
