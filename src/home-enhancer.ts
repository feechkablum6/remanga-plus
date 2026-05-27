import type {
  BookmarkFilterCategoryKey,
  HeaderButtonKey,
  ReaderEnhancerSettings,
} from "./settings.js";

export const HEADER_BUTTON_KEYS: readonly HeaderButtonKey[] = [
  "logo",
  "catalog",
  "tops",
  "forum",
  "ellipsis",
  "search",
  "bookmarks",
  "chat",
  "notifications",
  "avatar",
] as const;

const HOME_HIDDEN_ATTR = "data-rre-home-hidden";

type Locator = (root: ParentNode) => Element | null;

const HEADER_LOCATORS: Record<HeaderButtonKey, Locator> = {
  logo: (root) => root.querySelector('a[data-sentry-component="LogoButton"]'),
  catalog: (root) => root.querySelector('a[href="/manga"]'),
  tops: (root) => root.querySelector('a[href="/manga/top"]'),
  forum: (root) => root.querySelector('a[href*="/forum"]'),
  ellipsis: (root) => {
    const navStrip = (root as Element).querySelector?.('div[class*="md:flex"]');
    return navStrip?.querySelector("nav") ?? null;
  },
  search: (root) => root.querySelector('[data-sentry-component="SearchButton"]'),
  bookmarks: (root) => root.querySelector('a[href="/user/bookmarks"]'),
  chat: (root) => root.querySelector('a[href="/chat"]'),
  notifications: (root) => {
    const inner = root.querySelector('[data-sentry-component="Notifications"]');
    return inner?.closest("a") ?? inner;
  },
  avatar: (root) => root.querySelector('button[aria-haspopup="menu"]'),
};

const GAME_BANNER_SELECTOR = "div.fixed.bottom-8.right-8.z-100";

const VISIBLE_BOOKMARK_BADGES: ReadonlyArray<{
  label: string;
  key: BookmarkFilterCategoryKey;
}> = [
  { label: "Читаю", key: "reading" },
  { label: "Буду читать", key: "planned" },
  { label: "Прочитано", key: "completed" },
  { label: "Брошено", key: "dropped" },
  { label: "Не интересно", key: "notInterest" },
  { label: "Любимое", key: "favorite" },
];

export type HomeBookmarkDirs = Record<string, BookmarkFilterCategoryKey[]>;

export function applyHomeEnhancements(
  root: ParentNode,
  settings: ReaderEnhancerSettings,
  bookmarkDirs: Set<string> | null = null,
): void {
  const header =
    (root as Element).querySelector?.(
      'header[data-sentry-component="HeaderBase"]',
    ) ?? (root as Element).querySelector?.("header") ?? root;
  applyHeaderButtons(header as ParentNode, settings);
  applyGameBanner(root, settings);
  applyPromoBanner(root, settings);
  applyBookmarkFilter(root, settings, bookmarkDirs);
}

function applyHeaderButtons(
  header: ParentNode,
  settings: ReaderEnhancerSettings,
): void {
  for (const key of HEADER_BUTTON_KEYS) {
    const target = HEADER_LOCATORS[key](header);
    if (!(target instanceof HTMLElement)) continue;

    const shouldHide = settings.hideHeaderButtons[key];
    setHidden(target, key, shouldHide);
  }
}

function applyGameBanner(
  root: ParentNode,
  settings: ReaderEnhancerSettings,
): void {
  const candidates = Array.from(
    (root as Element).querySelectorAll?.(GAME_BANNER_SELECTOR) ?? [],
  ).filter((el): el is HTMLElement => el instanceof HTMLElement);

  if (candidates.length === 0) {
    const angle = (root as Element).querySelector?.(
      'button[data-sentry-component="AngleButton"]',
    );
    const wrapper = angle?.closest("div.fixed");
    if (wrapper instanceof HTMLElement) {
      candidates.push(wrapper);
    }
  }

  candidates.forEach((el) => {
    setHidden(el, "game-banner", settings.hideHomeGameBanner);
  });
}

function applyPromoBanner(
  root: ParentNode,
  settings: ReaderEnhancerSettings,
): void {
  const candidates = new Set<HTMLElement>();

  const promoLinks = (root as Element).querySelectorAll?.(
    'a[href*="/lnk"]',
  ) ?? [];
  promoLinks.forEach((link) => {
    let el: HTMLElement | null = (link as HTMLElement).parentElement;
    while (el && el !== root) {
      if (
        el.querySelector('button[aria-label="Dismiss"], button[aria-label="Закрыть"], button[aria-label="Скрыть"]')
      ) {
        candidates.add(el);
        break;
      }
      el = el.parentElement;
    }
  });

  candidates.forEach((el) => {
    setHidden(el, "promo-banner", settings.hideHomePromoBanner);
  });
}

export function getEnabledBookmarkDirs(
  dirs: HomeBookmarkDirs,
  categories: Record<BookmarkFilterCategoryKey, boolean>,
): Set<string> {
  const enabled = new Set<BookmarkFilterCategoryKey>(
    Object.entries(categories)
      .filter((entry): entry is [BookmarkFilterCategoryKey, boolean] => entry[1])
      .map(([key]) => key as BookmarkFilterCategoryKey),
  );
  const out = new Set<string>();
  for (const [dir, dirCategories] of Object.entries(dirs)) {
    if (dirCategories.some((category) => enabled.has(category))) {
      out.add(dir);
    }
  }
  return out;
}

function applyBookmarkFilter(
  root: ParentNode,
  settings: ReaderEnhancerSettings,
  bookmarkDirs: Set<string> | null,
): void {
  if (!isHomeRoot() || !settings.filterHomeBookmarks) {
    clearBookmarkFilter(root);
    return;
  }

  const scope = (root as Element).querySelector?.("main") ?? root;
  let continueReadingSection: Element | null = null;
  const historyLink = (scope as Element).querySelector?.('a[href*="/user/history"]');
  let ancestor: Element | null = historyLink;
  while (ancestor && ancestor !== scope) {
    if (ancestor.querySelector('a[href*="/manga/"], a[href*="/content/"]')) {
      continueReadingSection = ancestor;
      break;
    }
    ancestor = ancestor.parentElement;
  }
  const links = (scope as Element).querySelectorAll?.(
    'a[href*="/content/"], a[href*="/manga/"]',
  ) ?? [];
  const targets = new Map<HTMLElement, boolean>();
  links.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    if (continueReadingSection && continueReadingSection.contains(link)) return;
    const dir = extractMangaDir(link.href);
    if (!dir) return;
    const target = getTitleCardElement(link, scope);
    const shouldHide =
      (bookmarkDirs?.has(dir) ?? false) || hasVisibleFilteredBookmarkBadge(link, settings);
    targets.set(target, (targets.get(target) ?? false) || shouldHide);
  });
  targets.forEach((hidden, element) => setHidden(element, "bookmark-filter", hidden));
}

function hasVisibleFilteredBookmarkBadge(
  link: HTMLAnchorElement,
  settings: ReaderEnhancerSettings,
): boolean {
  const text = link.textContent ?? "";
  for (const badge of VISIBLE_BOOKMARK_BADGES) {
    if (settings.filterBookmarkCategories[badge.key] && text.includes(badge.label)) {
      return true;
    }
  }
  return false;
}

function clearBookmarkFilter(root: ParentNode): void {
  const hidden = (root as Element).querySelectorAll?.(
    '[data-rre-home-hidden="bookmark-filter"]',
  ) ?? [];
  hidden.forEach((element) => {
    if (element instanceof HTMLElement) {
      setHidden(element, "bookmark-filter", false);
    }
  });
}

function isHomeRoot(): boolean {
  return (
    window.location.hostname === "remanga.org" &&
    (window.location.pathname === "/" || window.location.pathname === "")
  );
}

function extractMangaDir(href: string): string | null {
  try {
    const url = new URL(href, window.location.origin);
    const match = url.pathname.match(/^\/(?:content|manga)\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function getTitleCardElement(
  link: HTMLAnchorElement,
  scope: ParentNode,
): HTMLElement {
  let candidate: HTMLElement = link;
  let current: HTMLElement | null = link;

  while (current?.parentElement && current.parentElement !== scope) {
    const parent: HTMLElement = current.parentElement;
    if (parent.matches("main, section, article, body, html")) break;
    const titleLinks = parent.querySelectorAll('a[href*="/content/"], a[href*="/manga/"]');
    if (titleLinks.length !== 1) break;
    candidate = parent;
    current = parent;
  }

  return candidate;
}

function setHidden(
  element: HTMLElement,
  key: string,
  hidden: boolean,
): void {
  if (hidden) {
    if (element.getAttribute(HOME_HIDDEN_ATTR) === key) return;
    element.dataset.rreHomeOriginalDisplay = element.style.display;
    element.style.display = "none";
    element.setAttribute(HOME_HIDDEN_ATTR, key);
    return;
  }

  if (element.getAttribute(HOME_HIDDEN_ATTR) === key) {
    element.style.display = element.dataset.rreHomeOriginalDisplay ?? "";
    delete element.dataset.rreHomeOriginalDisplay;
    element.removeAttribute(HOME_HIDDEN_ATTR);
  }
}
