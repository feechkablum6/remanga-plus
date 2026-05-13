import { CONTROL_ATTRIBUTE } from "./reader-dom-utils.js";
import { fetchPremiumFreeImageBlobUrl } from "./premium-free-image-loader.js";
import type {
  PremiumFreeReaderState,
  PremiumFreeSuccessResult,
} from "./premium-free-reader-model.js";

export const PREMIUM_FREE_READER_WIDTH_CLASS =
  "reader-container-width relative m-[0_auto] h-auto max-w-(--reader-container-max-width) [filter:var(--reader-brightness)]";

const PREMIUM_FREE_CLICKABLE_AREA_CLASS =
  "absolute inset-0 flex reader-container-width left-1/2 size-full h-full -translate-x-1/2";
const PREMIUM_FREE_CLICK_ZONE_CLASS = "relative z-[100] h-full w-1/3 select-none";

export type PremiumFreeViewportPage = {
  key: string;
  pageIndex: number;
  top: number;
  bottom: number;
};

export type PremiumFreePagerRenderOptions = {
  container: HTMLElement;
  result: PremiumFreeSuccessResult;
  state: PremiumFreeReaderState;
  currentPageIndex: number;
  onPageChange: (nextIndex: number) => void;
};

export const applyPremiumFreeReaderVars = (
  node: HTMLElement,
  state: PremiumFreeReaderState,
): void => {
  node.setAttribute("data-reader-vars-scope", "true");

  if (state.containerWidthVar) {
    node.style.setProperty("--reader-container-width", state.containerWidthVar);
  } else {
    node.style.removeProperty("--reader-container-width");
  }

  if (state.brightnessVar) {
    node.style.setProperty("--reader-brightness", state.brightnessVar);
  } else {
    node.style.removeProperty("--reader-brightness");
  }
};

export const createPremiumFreeImage = (
  page: PremiumFreeSuccessResult["pages"][number],
): HTMLImageElement => {
  const image = document.createElement("img");
  image.setAttribute(CONTROL_ATTRIBUTE, "premium-free-image");
  image.decoding = "async";
  image.alt = `Страница ${page.index + 1}`;

  void fetchPremiumFreeImageBlobUrl(page.proxyUrl).then((blobUrl) => {
    if (blobUrl) image.src = blobUrl;
  });

  return image;
};

export const createPremiumFreePageFrame = (
  state: PremiumFreeReaderState,
): HTMLElement => {
  const pageFrame = document.createElement("div");
  pageFrame.setAttribute(CONTROL_ATTRIBUTE, "premium-free-page-frame");
  pageFrame.className = PREMIUM_FREE_READER_WIDTH_CLASS;
  applyPremiumFreeReaderVars(pageFrame, state);
  return pageFrame;
};

export const clampPremiumFreePageIndex = (
  nextIndex: number,
  totalPages: number,
): number => {
  if (totalPages <= 0) {
    return 0;
  }

  return Math.min(Math.max(nextIndex, 0), totalPages - 1);
};

export const renderPremiumFreeFeedPages = (
  container: HTMLElement,
  result: PremiumFreeSuccessResult,
  state: PremiumFreeReaderState,
  chapterKey?: string,
): void => {
  const reader = document.createElement("div");
  reader.setAttribute(CONTROL_ATTRIBUTE, "premium-free-feed-reader");

  result.pages.forEach((page) => {
    const pageShell = document.createElement("div");
    pageShell.setAttribute(CONTROL_ATTRIBUTE, "premium-free-page-shell");
    if (chapterKey) {
      pageShell.dataset.rrePremiumFreeStreamKey = chapterKey;
      pageShell.dataset.rrePremiumFreePageIndex = String(page.index);
    }

    const pageFrame = createPremiumFreePageFrame(state);
    pageFrame.append(createPremiumFreeImage(page));
    pageShell.append(pageFrame);
    reader.append(pageShell);
  });

  container.replaceChildren(reader);
};

export const renderPremiumFreePagerPages = ({
  container,
  result,
  state,
  currentPageIndex,
  onPageChange,
}: PremiumFreePagerRenderOptions): void => {
  const reader = document.createElement("div");
  reader.setAttribute(CONTROL_ATTRIBUTE, "premium-free-pager-reader");

  const currentPage = result.pages[currentPageIndex];
  if (!currentPage) {
    container.replaceChildren(reader);
    return;
  }

  const pageShell = document.createElement("div");
  pageShell.setAttribute(CONTROL_ATTRIBUTE, "premium-free-page-shell");

  const pageFrame = createPremiumFreePageFrame(state);
  pageFrame.append(createPremiumFreeImage(currentPage));
  pageShell.append(pageFrame);
  reader.append(pageShell);

  const clickableArea = document.createElement("div");
  clickableArea.setAttribute(CONTROL_ATTRIBUTE, "premium-free-clickable-area");
  clickableArea.className = PREMIUM_FREE_CLICKABLE_AREA_CLASS;
  applyPremiumFreeReaderVars(clickableArea, state);

  const previousZone = document.createElement("button");
  previousZone.type = "button";
  previousZone.setAttribute(CONTROL_ATTRIBUTE, "premium-free-click-zone-prev");
  previousZone.className = PREMIUM_FREE_CLICK_ZONE_CLASS;
  previousZone.setAttribute("aria-label", "Предыдущая страница");
  previousZone.addEventListener("click", () => {
    onPageChange(currentPageIndex - 1);
  });

  const centerZone = document.createElement("div");
  centerZone.setAttribute(CONTROL_ATTRIBUTE, "premium-free-click-zone-center");
  centerZone.className = PREMIUM_FREE_CLICK_ZONE_CLASS;

  const nextZone = document.createElement("button");
  nextZone.type = "button";
  nextZone.setAttribute(CONTROL_ATTRIBUTE, "premium-free-click-zone-next");
  nextZone.className = PREMIUM_FREE_CLICK_ZONE_CLASS;
  nextZone.setAttribute("aria-label", "Следующая страница");
  nextZone.addEventListener("click", () => {
    onPageChange(currentPageIndex + 1);
  });

  clickableArea.append(previousZone, centerZone, nextZone);
  reader.append(clickableArea);
  container.replaceChildren(reader);
};

export const collectPremiumFreeViewportPages = (
  container: HTMLElement,
): PremiumFreeViewportPage[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      `[${CONTROL_ATTRIBUTE}="premium-free-page-shell"][data-rre-premium-free-stream-key]`,
    ),
  ).flatMap((node) => {
    const key = node.dataset.rrePremiumFreeStreamKey;
    const pageIndex = Number(node.dataset.rrePremiumFreePageIndex ?? "-1");
    if (!key || Number.isNaN(pageIndex) || pageIndex < 0) {
      return [];
    }

    const rect = node.getBoundingClientRect();
    return [
      {
        key,
        pageIndex,
        top: rect.top,
        bottom: rect.bottom,
      },
    ];
  });
