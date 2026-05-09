import type { HeaderButtonKey, ReaderEnhancerSettings } from "./settings.js";

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
    const candidates = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        'button[data-state][data-sentry-element="Button"]',
      ),
    );
    return (
      candidates.find(
        (b) =>
          !b.getAttribute("data-sentry-component") &&
          !b.getAttribute("aria-haspopup") &&
          !b.textContent?.trim() &&
          b.closest('div[class*="md:flex"]'),
      ) ?? null
    );
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
): void {
  const header =
    (root as Element).querySelector?.(
      'header[data-sentry-component="HeaderBase"]',
    ) ?? (root as Element).querySelector?.("header") ?? root;
  applyHeaderButtons(header as ParentNode, settings);
  applyGameBanner(root, settings);
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
