import type { HeaderButtonKey, ReaderEnhancerSettings } from "./settings.js";
import { extractDirFromHref, getFilteredDirs } from "./bookmark-filter.js";

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

export function applyHomeEnhancements(
  root: ParentNode,
  settings: ReaderEnhancerSettings,
  filteredDirs: Set<string> | null,
): void {
  const header =
    (root as Element).querySelector?.(
      'header[data-sentry-component="HeaderBase"]',
    ) ?? (root as Element).querySelector?.("header") ?? root;
  applyHeaderButtons(header as ParentNode, settings);
  applyGameBanner(root, settings);
  applyPromoBanner(root, settings);
  applyBookmarkFilter(root, settings, filteredDirs);
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

function applyBookmarkFilter(
  root: ParentNode,
  settings: ReaderEnhancerSettings,
  filteredDirs: Set<string> | null,
): void {
  if (!settings.filterHomeBookmarks || !filteredDirs || filteredDirs.size === 0) {
    clearBookmarkFilter(root);
    return;
  }

  const links = (root as Element).querySelectorAll?.('a[href^="/manga/"]') ?? [];
  for (const link of links) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    const dir = extractDirFromHref(link.href);
    if (!dir) continue;

    if (filteredDirs.has(dir)) {
      setHidden(link, "bookmark-filter", true);
    } else {
      setHidden(link, "bookmark-filter", false);
    }
  }
}

function clearBookmarkFilter(root: ParentNode): void {
  const links = (root as Element).querySelectorAll?.('[data-rre-home-hidden="bookmark-filter"]') ?? [];
  for (const link of links) {
    if (link instanceof HTMLElement) {
      setHidden(link, "bookmark-filter", false);
    }
  }
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
