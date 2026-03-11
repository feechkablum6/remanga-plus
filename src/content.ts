import {
  clearEnhancerArtifacts,
  hideDynamicReaderArtifacts,
  isReaderPage,
  syncReaderEnhancer,
} from "./reader-enhancer";
import {
  cloneSettings,
  loadSettings,
  saveSettings,
  watchSettings,
  type ReaderEnhancerSettings,
} from "./settings";
import { shouldScheduleSettledRefresh } from "./settings-panel-transition";

declare global {
  interface Window {
    __remangaReaderEnhancerBooted?: boolean;
  }
}

const CONTROL_ATTRIBUTE = "data-rre-control";
const HIDDEN_ATTRIBUTE = "data-rre-hidden";
const REFRESH_DEBOUNCE_MS = 40;
const URL_POLL_MS = 250;

if (!window.__remangaReaderEnhancerBooted) {
  window.__remangaReaderEnhancerBooted = true;
  void bootstrap();
}

async function bootstrap(): Promise<void> {
  let currentSettings = await loadSettings();
  let refreshHandle = 0;
  const settledRefreshHandles = new Set<number>();
  let lastUrl = window.location.href;

  const runRefresh = () => {
    if (!isReaderPage()) {
      clearEnhancerArtifacts();
      return;
    }

    syncReaderEnhancer({
      settings: currentSettings,
      commitSettings,
    });
  };

  const requestRefresh = () => {
    window.clearTimeout(refreshHandle);
    refreshHandle = window.setTimeout(runRefresh, REFRESH_DEBOUNCE_MS);
  };

  const clearSettledRefreshes = () => {
    settledRefreshHandles.forEach((handle) => {
      window.clearTimeout(handle);
    });
    settledRefreshHandles.clear();
  };

  const scheduleSettledRefresh = (delay: number) => {
    const handle = window.setTimeout(() => {
      settledRefreshHandles.delete(handle);
      runRefresh();
    }, delay);
    settledRefreshHandles.add(handle);
  };

  const requestImmediateRefresh = () => {
    window.clearTimeout(refreshHandle);
    runRefresh();
  };

  const requestSettingsPanelRefresh = () => {
    clearSettledRefreshes();
    requestImmediateRefresh();
    [120, 280].forEach(scheduleSettledRefresh);
  };

  const commitSettings = (
    updater: (settings: ReaderEnhancerSettings) => ReaderEnhancerSettings,
  ) => {
    currentSettings = updater(cloneSettings(currentSettings));
    void saveSettings(currentSettings);
    requestRefresh();
  };

  window.addEventListener("popstate", requestRefresh);
  window.addEventListener("hashchange", requestRefresh);
  window.addEventListener("pageshow", requestRefresh);
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest<HTMLButtonElement>("button");
      if (!button) {
        return;
      }

      const opensReaderSettings =
        Boolean(button.querySelector('svg[data-sentry-element="Settings"]')) ||
        button.matches(`[${CONTROL_ATTRIBUTE}="settings-recovery"]`) ||
        button.matches(`[${CONTROL_ATTRIBUTE}="settings-peek-button"]`);

      if (!opensReaderSettings) {
        return;
      }

      requestSettingsPanelRefresh();
    },
    true,
  );
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      requestRefresh();
    }
  });

  window.setInterval(() => {
    if (window.location.href === lastUrl) {
      return;
    }

    lastUrl = window.location.href;
    requestRefresh();
  }, URL_POLL_MS);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      Array.from(mutation.addedNodes).forEach((node) => {
        hideDynamicReaderArtifacts(node, currentSettings);
      });
    });

    if (mutations.some(shouldRequestSettingsPanelRefreshForMutation)) {
      requestSettingsPanelRefresh();
      return;
    }

    if (mutations.some(shouldRefreshForMutation)) {
      requestRefresh();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    // ReManga closes the reader settings drawer by toggling panel classes.
    attributes: true,
    attributeFilter: ["class", "style", "data-state", "aria-hidden"],
  });

  watchSettings((nextSettings) => {
    currentSettings = nextSettings;
    requestRefresh();
  });

  requestRefresh();
}

function shouldRefreshForMutation(mutation: MutationRecord): boolean {
  return (
    shouldRefreshForMutationTarget(mutation.target) ||
    Array.from(mutation.addedNodes).some(shouldRefreshForNode) ||
    Array.from(mutation.removedNodes).some(shouldRefreshForNode)
  );
}

function shouldRequestSettingsPanelRefreshForMutation(mutation: MutationRecord): boolean {
  if (shouldRequestSettledRefreshForMutation(mutation)) {
    return true;
  }

  if (mutation.type !== "childList") {
    return false;
  }

  return (
    Array.from(mutation.addedNodes).some(containsSettingsPanelNode) ||
    Array.from(mutation.removedNodes).some(containsSettingsPanelNode)
  );
}

function shouldRequestSettledRefreshForMutation(mutation: MutationRecord): boolean {
  const target = mutation.target;
  if (!(target instanceof Element)) {
    return false;
  }

  return shouldScheduleSettledRefresh({
    mutationType: mutation.type,
    attributeName: mutation.attributeName,
    targetMatchesSettingsPanel: target.matches("div.bg-background-content"),
    targetText: target.textContent,
  });
}

function containsSettingsPanelNode(node: Node | null): boolean {
  if (!(node instanceof Element)) {
    return false;
  }

  if (isSettingsPanelNode(node)) {
    return true;
  }

  return Array.from(node.querySelectorAll("div.bg-background-content")).some(isSettingsPanelNode);
}

function shouldRefreshForMutationTarget(node: Node | null): boolean {
  if (!(node instanceof Element)) {
    return false;
  }

  if (node.closest(`[${CONTROL_ATTRIBUTE}]`) || node.closest(`[${HIDDEN_ATTRIBUTE}="true"]`)) {
    return false;
  }

  return matchesRelevantNode(node);
}

function shouldRefreshForNode(node: Node | null): boolean {
  if (!(node instanceof Element)) {
    return false;
  }

  if (node.closest(`[${CONTROL_ATTRIBUTE}]`) || node.closest(`[${HIDDEN_ATTRIBUTE}="true"]`)) {
    return false;
  }

  if (matchesRelevantNode(node)) {
    return true;
  }

  if (hasReaderStructure(node)) {
    return true;
  }

  return containsReaderStructure(node);
}

const RELEVANT_REFRESH_SELECTOR = [
  '[data-sentry-element="AsideContainer"]',
  'svg[data-sentry-element="Settings"]',
  'button[data-sentry-element="PageIndicatorTrigger"]',
  "header.fixed",
  "div.bg-background-content",
  'ol.toaster[data-sonner-toaster]',
  'section[aria-label^="Notifications"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[aria-modal="true"]',
].join(", ");

const STRUCTURAL_REFRESH_SELECTOR = [
  "main",
  "img",
  "picture",
  "section",
].join(", ");

const READER_MARKER_TEXT = [
  "самые интересные комментарии",
  "оставить комментарий",
  "отключить рекламу",
  "оценить",
  "спасибо",
  "поддержать",
];

function matchesRelevantNode(node: Element): boolean {
  return node.matches(RELEVANT_REFRESH_SELECTOR);
}

function hasReaderStructure(node: Element): boolean {
  if (node.matches(STRUCTURAL_REFRESH_SELECTOR)) {
    return true;
  }

  if (node.matches("button")) {
    return isReaderMarkerText(node.textContent);
  }

  return isReaderMarkerText(node.textContent);
}

function containsReaderStructure(node: Element): boolean {
  if (node.querySelector(STRUCTURAL_REFRESH_SELECTOR)) {
    return true;
  }

  const markerButton = Array.from(node.querySelectorAll("button")).find((button) =>
    isReaderMarkerText(button.textContent),
  );
  if (markerButton) {
    return true;
  }

  return Array.from(node.querySelectorAll("h1, h2, h3, h4, p, div, span")).some(
    (candidate) => isReaderMarkerText(candidate.textContent),
  );
}

function isReaderMarkerText(text: string | null): boolean {
  const normalized = normalizeText(text);
  if (!normalized) {
    return false;
  }

  return READER_MARKER_TEXT.some((marker) => normalized.includes(marker));
}

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}

function isSettingsPanelNode(node: Element): boolean {
  return (
    node.matches("div.bg-background-content") &&
    normalizeText(node.textContent).includes("настройки читалки")
  );
}
