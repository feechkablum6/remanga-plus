import { loadSettings } from "./settings.js";
import {
  createPopupRouter,
  type PopupRouter,
  type PopupScreen,
} from "./popup-router.js";
import { CATEGORY_KEYS, countCategoryToggles } from "./popup-categories.js";

if (typeof document !== "undefined") void main();

async function main(): Promise<void> {
  // Settings are loaded for use by later wirings (toggles, etc. added in Task 6+).
  await loadSettings();

  const router = createPopupRouter();

  renderVersionChip();
  wireScreenVisibility(document, router);
  wireCardNavigation(document, router);
  wireBackButtons(document, router);
  renderCardSubtitles(document);
}

export function wireScreenVisibility(doc: Document, router: PopupRouter): void {
  const apply = (screen: PopupScreen): void => {
    for (const section of doc.querySelectorAll<HTMLElement>("[data-screen]")) {
      const key = section.dataset.screen as PopupScreen;
      if (key === screen) section.removeAttribute("hidden");
      else section.setAttribute("hidden", "");
    }
  };
  apply(router.current());
  router.subscribe(apply);
}

export function wireCardNavigation(doc: Document, router: PopupRouter): void {
  for (const card of doc.querySelectorAll<HTMLElement>("[data-card]")) {
    const key = card.dataset.card as PopupScreen;
    card.addEventListener("click", () => router.navigate(key));
  }
}

export function wireBackButtons(doc: Document, router: PopupRouter): void {
  for (const btn of doc.querySelectorAll<HTMLElement>("[data-back]")) {
    btn.addEventListener("click", () => router.back());
  }
}

export function renderCardSubtitles(doc: Document): void {
  for (const key of CATEGORY_KEYS) {
    const el = doc.querySelector<HTMLElement>(`[data-card-subtitle="${key}"]`);
    if (!el) continue;
    el.textContent = formatCount(countCategoryToggles(key));
  }
}

function formatCount(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${n} настроек`;
  if (last === 1) return `${n} настройка`;
  if (last >= 2 && last <= 4) return `${n} настройки`;
  return `${n} настроек`;
}

function renderVersionChip(): void {
  const chip = document.querySelector<HTMLElement>(".header__chip");
  if (!chip) return;
  const version = chrome.runtime?.getManifest?.().version;
  if (version) chip.textContent = `v${version}`;
}
