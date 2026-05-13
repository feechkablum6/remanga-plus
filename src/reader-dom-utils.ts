export const CONTROL_ATTRIBUTE = "data-rre-control";
export const HIDDEN_ATTRIBUTE = "data-rre-hidden";

export const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export const queryAllWithSelf = <T extends Element>(
  root: ParentNode,
  selector: string,
): T[] => {
  const nodes = Array.from(root.querySelectorAll<T>(selector));
  if (root instanceof Element && root.matches(selector)) {
    nodes.unshift(root as T);
  }
  return nodes;
};

export const markHidden = (node: HTMLElement | null, hidden: boolean): void => {
  if (!node) {
    return;
  }

  if (hidden) {
    node.setAttribute(HIDDEN_ATTRIBUTE, "true");
  } else {
    node.removeAttribute(HIDDEN_ATTRIBUTE);
  }
};

export const findSettingsPanel = (): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>("div")).find((node) => {
    if (!node.classList.contains("bg-background-content")) {
      return false;
    }

    const text = normalizeText(node.textContent);
    return text.includes("настройки читалки");
  }) ?? null;

export const PREMIUM_FREE_ROOT_KEY = "premium-free-root";
export const PREMIUM_FREE_KEY_ATTRIBUTE = "data-rre-premium-free-key";
export const PREMIUM_FREE_BANNER_ATTRIBUTE = "data-rre-premium-free-banner";
export const PREMIUM_FREE_STATE_ATTRIBUTE = "data-rre-premium-free-state";
export const PREMIUM_FREE_NATIVE_PAID_ATTRIBUTE = "data-rre-premium-free-native-paid";

const isVisiblePremiumFreeBannerCandidate = (node: HTMLElement | null): node is HTMLElement => {
  if (!node) {
    return false;
  }

  const rect = node.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const style = window.getComputedStyle(node);
  return style.display !== "none" && style.visibility !== "hidden";
};

export const findBuyChapterBanner = (): HTMLElement | null => {
  const existingRoot = document.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="${PREMIUM_FREE_ROOT_KEY}"]`,
  );
  const existingRootBanner = existingRoot?.closest<HTMLElement>("div.h-screen") ?? null;
  if (isVisiblePremiumFreeBannerCandidate(existingRootBanner)) {
    return existingRootBanner;
  }

  const banner = Array.from(
    document.querySelectorAll<HTMLElement>('[data-sentry-component="BuyChapterActions"]'),
  )
    .map((node) => node.closest<HTMLElement>("div.h-screen") ?? node)
    .find(isVisiblePremiumFreeBannerCandidate);
  if (!banner) {
    return null;
  }

  return banner;
};