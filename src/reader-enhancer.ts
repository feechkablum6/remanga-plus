import {
  cloneSettings,
  type PopupSettingKey,
  type ReaderEnhancerSettings,
  type ToolbarButtonKey,
} from "./settings";
import {
  PREMIUM_FREE_BRANCH_PREF_STORAGE_KEY,
  buildPremiumFreeSearchUrl,
  clearStalePremiumFreeBranchPreference,
  createPremiumFreeStreamReference,
  createPremiumFreeCacheEntry,
  describePremiumFreeFailure,
  derivePremiumFreeTargetReference,
  ensureParserServerReady,
  extractRemangaChapterReference,
  mapParserServerFailure,
  markRemangaChapterAsViewed,
  pickPremiumFreeActivePage,
  readPremiumFreeBranchPreference,
  readPremiumFreeCacheEntry,
  shouldPrefetchPremiumFreeNextChapter,
  shouldPrefetchPremiumFreeNextChapterByViewport,
  writePremiumFreeBranchPreference,
  type PremiumFreeBranch,
  type PremiumFreeBranchPreference,
  type PremiumFreeCacheEntry,
  type PremiumFreeClientResolveResult,
  type RemangaChapterReference,
} from "./premium-free";
import {
  PARSER_SERVER_DEFAULT_PORT,
  PROXY_IMAGE_MESSAGE_TYPE,
  buildParserServerBaseUrl,
} from "./parser-server";
import {
  SETTINGS_MENU_ITEM_KEYS,
  SETTINGS_MENU_ITEMS,
  matchesSettingsMenuItemText,
  type SettingsMenuItemKey,
} from "./settings-menu-items";
import {
  POPUP_CLOSE_BUTTON_SELECTORS,
  POPUP_SELECTORS,
  isLikelyCornerCloseButton,
} from "./popup-dismissal";
import { prefetchNextChapter as prefetchRemangaNextChapter } from "./chapter-prefetch";

type CommitSettings = (
  updater: (current: ReaderEnhancerSettings) => ReaderEnhancerSettings,
) => void;

type SyncOptions = {
  settings: ReaderEnhancerSettings;
  commitSettings: CommitSettings;
};

type ReaderDom = {
  header: HTMLElement | null;
  main: HTMLElement | null;
  railContainer: HTMLElement | null;
  pageCounterButton: HTMLButtonElement | null;
  settingsButton: HTMLButtonElement | null;
  settingsGroup: HTMLElement | null;
  settingsPanel: HTMLElement | null;
  commentsBlocks: HTMLElement[];
  adBlocks: HTMLElement[];
  toolbarButtons: Record<ToolbarButtonKey, HTMLButtonElement | null>;
};

type ToggleRowSyncOptions = {
  row: HTMLElement;
  definition: ToggleDefinition;
  settings: ReaderEnhancerSettings;
  commitSettings: CommitSettings;
};

type SettingsSectionElements = {
  section: HTMLElement;
  toggleButton: HTMLButtonElement | null;
  rows: HTMLElement | null;
};

type SettingsLayoutStyles = {
  height?: string;
  minHeight?: string;
  overflow?: string;
};

type ToggleDefinition = {
  id: string;
  label: string;
  value: (settings: ReaderEnhancerSettings) => boolean;
  toggle: (settings: ReaderEnhancerSettings) => void;
};

type MotionMode = "slide-right" | "dissolve";
type PremiumFreeState = "idle" | "resolving" | "rendering" | "error";
type PremiumFreeReaderMode = "feed" | "pager";
type PremiumFreeStreamStatus = "idle" | "loading-next" | "error" | "exhausted";
type PremiumFreeReaderState = {
  mode: PremiumFreeReaderMode;
  containerWidthVar: string | null;
  brightnessVar: string | null;
};
type PremiumFreeSuccessResult = Extract<PremiumFreeClientResolveResult, { status: "success" }>;
type PremiumFreeFailureResult = Extract<PremiumFreeClientResolveResult, { status: "failure" }>;
type PremiumFreeStreamEntry = {
  key: string;
  reference: RemangaChapterReference;
  result: PremiumFreeSuccessResult;
  chapterLabel: string;
};
type PremiumFreeVisiblePage = {
  key: string;
  pageIndex: number;
  ratio: number;
};
type PremiumFreeIndicatorSnapshot = {
  chapterLabelText: string | null;
  pageCounterText: string | null;
  url: string;
};
type PremiumFreeChapterStream = {
  rootKey: string;
  container: HTMLElement;
  entries: PremiumFreeStreamEntry[];
  status: PremiumFreeStreamStatus;
  errorResult: PremiumFreeFailureResult | null;
  visiblePages: Map<HTMLElement, PremiumFreeVisiblePage>;
  indicatorSnapshot: PremiumFreeIndicatorSnapshot | null;
  activeHistoryUrl: string | null;
};

const CONTROL_ATTRIBUTE = "data-rre-control";
const HIDDEN_ATTRIBUTE = "data-rre-hidden";
const RAIL_STYLE_ATTRIBUTE = "data-rre-rail-style";
const SETTINGS_STYLE_ATTRIBUTE = "data-rre-settings-style";
const IGNORE_TOGGLE_ATTRIBUTE = "data-rre-ignore-toggle";
const EMPTY_RAIL_ATTRIBUTE = "data-rre-empty-rail";
const MOTION_ATTRIBUTE = "data-rre-motion";
const MOTION_STATE_ATTRIBUTE = "data-rre-motion-state";
const MOTION_INITIALIZED_ATTRIBUTE = "data-rre-motion-initialized";
const MOTION_TARGET_HIDDEN_ATTRIBUTE = "data-rre-motion-target-hidden";
const SECTION_COLLAPSE_ATTRIBUTE = "data-rre-collapse-state";
const SECTION_COLLAPSE_INITIALIZED_ATTRIBUTE = "data-rre-collapse-initialized";
const SECTION_COLLAPSE_TARGET_ATTRIBUTE = "data-rre-collapse-target-expanded";
const PREMIUM_FREE_BANNER_ATTRIBUTE = "data-rre-premium-free-banner";
const PREMIUM_FREE_STATE_ATTRIBUTE = "data-rre-premium-free-state";

const SLIDE_RIGHT_DURATION_MS = 220;
const DISSOLVE_DURATION_MS = 260;
const COLLAPSE_DURATION_MS = 240;

const TOOLBAR_ICON_NAMES: Record<ToolbarButtonKey, string> = {
  list: "List",
  comments: "Comments",
  like: "Like",
  addImage: "AddPicture",
  edit: "Edit",
  autoScroll: "AutoScroll",
  report: "Report",
};

const HINT_KEYWORDS = ["подсказки", "центр экрана", "в настройках"];
const GIFT_PROMO_KEYWORDS = [
  "карты",
  "молнии",
  "розыгрыш",
  "подар",
  "телеграм",
  "подписаться",
  "получили",
  "награ",
  "прочтение",
];

const ACTIVE_FULLSCREEN_CLASSES = [
  "bg-accent/40",
  "hover:bg-accent",
  "hover:text-accent-foreground",
];

const INACTIVE_FULLSCREEN_CLASSES = [
  "bg-transparent",
  "hover:bg-accent",
  "hover:text-accent-foreground",
];

let fullscreenListenerAttached = false;
let stylesInstalled = false;
let prefetchNextChapterEnabled = false;
let rightRailOptionsExpanded = false;
let rightRailOptionsExpansionTouched = false;
let settingsMenuOptionsExpanded = false;
let settingsMenuOptionsExpansionTouched = false;
const motionFinalizeHandles = new Map<HTMLElement, number>();
const collapseFinalizeHandles = new Map<HTMLElement, number>();
let activeParserServerPort = PARSER_SERVER_DEFAULT_PORT;

const getParserServerBaseUrl = (): string =>
  buildParserServerBaseUrl(activeParserServerPort);

const premiumFreeResultCache = new Map<string, PremiumFreeCacheEntry>();
const premiumFreePageIndex = new Map<string, number>();
/**
 * In-memory mirror of chrome.storage.sync[PREMIUM_FREE_BRANCH_PREF_STORAGE_KEY].
 * Populated on boot and when the user picks a non-default branch from the
 * translation selector UI.
 */
let premiumFreeBranchPrefs: Record<string, PremiumFreeBranchPreference> = {};

const loadPremiumFreeBranchPrefs = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.sync) {
      resolve();
      return;
    }
    chrome.storage.sync.get(
      { [PREMIUM_FREE_BRANCH_PREF_STORAGE_KEY]: {} },
      (stored) => {
        const raw = (stored?.[PREMIUM_FREE_BRANCH_PREF_STORAGE_KEY] ?? {}) as Record<
          string,
          PremiumFreeBranchPreference
        >;
        premiumFreeBranchPrefs = { ...raw };
        resolve();
      },
    );
  });
};

const persistPremiumFreeBranchPref = (
  titleDir: string,
  pref: PremiumFreeBranchPreference,
): void => {
  premiumFreeBranchPrefs = writePremiumFreeBranchPreference(
    premiumFreeBranchPrefs,
    titleDir,
    pref,
  );
  writePremiumFreeBranchPrefsToStorage();
};

const writePremiumFreeBranchPrefsToStorage = (): void => {
  if (typeof chrome === "undefined" || !chrome.storage?.sync) {
    return;
  }
  chrome.storage.sync.set({
    [PREMIUM_FREE_BRANCH_PREF_STORAGE_KEY]: premiumFreeBranchPrefs,
  });
};

const purgeStaleBranchPrefIfNeeded = (
  titleDir: string,
  requestedBranchId: string | null,
  result: PremiumFreeClientResolveResult,
): void => {
  const next = clearStalePremiumFreeBranchPreference(
    premiumFreeBranchPrefs,
    titleDir,
    requestedBranchId,
    result,
  );
  if (next === premiumFreeBranchPrefs) return;
  premiumFreeBranchPrefs = next;
  writePremiumFreeBranchPrefsToStorage();
};

void loadPremiumFreeBranchPrefs();
let premiumFreeActiveRequest:
  | {
      key: string;
      controller: AbortController;
    }
  | null = null;
let premiumFreeReaderStateSnapshot: PremiumFreeReaderState | null = null;
let premiumFreeNextRequest:
  | {
      key: string;
      controller: AbortController;
    }
  | null = null;
let premiumFreeChapterStream: PremiumFreeChapterStream | null = null;
let premiumFreeStreamPageObserver: IntersectionObserver | null = null;
let premiumFreeStreamLoadObserver: IntersectionObserver | null = null;
let premiumFreeViewportSyncHandle = 0;
let premiumFreeViewportListenersAttached = false;
const premiumFreeMarkedViewedChapterIds = new Set<number>();

const syncPremiumFreeChapterAsViewed = (chapterId: number | undefined): void => {
  if (typeof chapterId !== "number" || !Number.isInteger(chapterId) || chapterId <= 0) {
    return;
  }

  if (premiumFreeMarkedViewedChapterIds.has(chapterId)) {
    return;
  }

  if (typeof document === "undefined" || typeof fetch !== "function") {
    return;
  }

  premiumFreeMarkedViewedChapterIds.add(chapterId);
  void markRemangaChapterAsViewed({
    chapterId,
    cookie: document.cookie,
    fetchImpl: fetch.bind(globalThis),
  }).then((marked) => {
    if (!marked) {
      premiumFreeMarkedViewedChapterIds.delete(chapterId);
    }
  });
};

const primaryToggleDefinitions: ToggleDefinition[] = [
  {
    id: "hide-header",
    label: "Скрывать верхнюю панель",
    value: (settings) => settings.hideHeader,
    toggle: (settings) => {
      settings.hideHeader = !settings.hideHeader;
    },
  },
  {
    id: "hide-right-rail",
    label: "Скрывать боковую панель",
    value: (settings) => settings.hideRightRail,
    toggle: (settings) => {
      settings.hideRightRail = !settings.hideRightRail;
    },
  },
  {
    id: "enhance-settings-menu",
    label: "Улучшить меню настроек",
    value: (settings) => settings.enhanceSettingsMenu,
    toggle: (settings) => {
      settings.enhanceSettingsMenu = !settings.enhanceSettingsMenu;
    },
  },
  {
    id: "hide-comments-section",
    label: "Скрывать блок комментариев",
    value: (settings) => settings.hideCommentsSection,
    toggle: (settings) => {
      settings.hideCommentsSection = !settings.hideCommentsSection;
    },
  },
  {
    id: "premium-free",
    label: "Premium Free",
    value: (settings) => settings.premiumFree,
    toggle: (settings) => {
      settings.premiumFree = !settings.premiumFree;
    },
  },
  {
    id: "hide-popup-hints",
    label: "Авто-скрывать подсказки",
    value: (settings) => settings.hidePopups.hints,
    toggle: (settings) => {
      settings.hidePopups.hints = !settings.hidePopups.hints;
    },
  },
  {
    id: "hide-popup-gifts",
    label: "Авто-скрывать подарки и промо",
    value: (settings) => settings.hidePopups.giftsPromo,
    toggle: (settings) => {
      settings.hidePopups.giftsPromo = !settings.hidePopups.giftsPromo;
    },
  },
  {
    id: "hide-popup-other",
    label: "Авто-скрывать прочие всплывающие окна",
    value: (settings) => settings.hidePopups.otherNonBlocking,
    toggle: (settings) => {
      settings.hidePopups.otherNonBlocking =
        !settings.hidePopups.otherNonBlocking;
    },
  },
];

const rightRailToggleDefinitions: ToggleDefinition[] = [
  {
    id: "hide-page-counter",
    label: "Скрывать счётчик страниц",
    value: (settings) => settings.hidePageCounter,
    toggle: (settings) => {
      settings.hidePageCounter = !settings.hidePageCounter;
    },
  },
  {
    id: "hide-button-list",
    label: "Скрывать кнопку списка глав",
    value: (settings) => settings.hideToolbarButtons.list,
    toggle: (settings) => {
      settings.hideToolbarButtons.list = !settings.hideToolbarButtons.list;
    },
  },
  {
    id: "hide-button-comments",
    label: "Скрывать кнопку комментариев",
    value: (settings) => settings.hideToolbarButtons.comments,
    toggle: (settings) => {
      settings.hideToolbarButtons.comments = !settings.hideToolbarButtons.comments;
    },
  },
  {
    id: "hide-button-like",
    label: "Скрывать кнопку лайка",
    value: (settings) => settings.hideToolbarButtons.like,
    toggle: (settings) => {
      settings.hideToolbarButtons.like = !settings.hideToolbarButtons.like;
    },
  },
  {
    id: "hide-button-add-image",
    label: "Скрывать кнопку добавления картинки",
    value: (settings) => settings.hideToolbarButtons.addImage,
    toggle: (settings) => {
      settings.hideToolbarButtons.addImage = !settings.hideToolbarButtons.addImage;
    },
  },
  {
    id: "hide-button-edit",
    label: "Скрывать кнопку редактирования",
    value: (settings) => settings.hideToolbarButtons.edit,
    toggle: (settings) => {
      settings.hideToolbarButtons.edit = !settings.hideToolbarButtons.edit;
    },
  },
  {
    id: "hide-button-auto-scroll",
    label: "Скрывать кнопку авто-скролла",
    value: (settings) => settings.hideToolbarButtons.autoScroll,
    toggle: (settings) => {
      settings.hideToolbarButtons.autoScroll = !settings.hideToolbarButtons.autoScroll;
    },
  },
  {
    id: "hide-button-report",
    label: "Скрывать кнопку жалобы",
    value: (settings) => settings.hideToolbarButtons.report,
    toggle: (settings) => {
      settings.hideToolbarButtons.report = !settings.hideToolbarButtons.report;
    },
  },
  {
    id: "hide-fullscreen-button",
    label: "Скрывать кнопку полноэкранного режима",
    value: (settings) => settings.hideRailFullscreenButton,
    toggle: (settings) => {
      settings.hideRailFullscreenButton = !settings.hideRailFullscreenButton;
    },
  },
];

const settingsMenuToggleDefinitions: ToggleDefinition[] = SETTINGS_MENU_ITEM_KEYS.map((key) => ({
  id: `hide-settings-menu-${key}`,
  label: SETTINGS_MENU_ITEMS[key].label,
  value: (settings) => settings.hideSettingsMenuItems[key],
  toggle: (settings) => {
    settings.hideSettingsMenuItems[key] = !settings.hideSettingsMenuItems[key];
  },
}));

export const isReaderPage = (pathname = window.location.pathname): boolean =>
  /^\/manga\/[^/]+\/\d+/.test(pathname);

export const clearEnhancerArtifacts = (): void => {
  resetTransientSubsectionState();
  abortPremiumFreeRequest();
  resetPremiumFreeChapterStream();
  clearFinalizeHandles(motionFinalizeHandles);
  clearFinalizeHandles(collapseFinalizeHandles);

  document.querySelectorAll<HTMLElement>(`[${CONTROL_ATTRIBUTE}]`).forEach((node) => {
    if (node.getAttribute(CONTROL_ATTRIBUTE) === "styles") {
      return;
    }

    node.remove();
  });

  document.querySelectorAll<HTMLElement>(`[${HIDDEN_ATTRIBUTE}]`).forEach((node) => {
    node.removeAttribute(HIDDEN_ATTRIBUTE);
  });

  document
    .querySelectorAll<HTMLElement>(
      `[${MOTION_ATTRIBUTE}], [${MOTION_STATE_ATTRIBUTE}], [${MOTION_INITIALIZED_ATTRIBUTE}], [${MOTION_TARGET_HIDDEN_ATTRIBUTE}]`,
    )
    .forEach((node) => {
      node.removeAttribute(MOTION_ATTRIBUTE);
      node.removeAttribute(MOTION_STATE_ATTRIBUTE);
      node.removeAttribute(MOTION_INITIALIZED_ATTRIBUTE);
      node.removeAttribute(MOTION_TARGET_HIDDEN_ATTRIBUTE);
    });

  document.querySelectorAll<HTMLElement>(`[${RAIL_STYLE_ATTRIBUTE}]`).forEach((node) => {
    node.removeAttribute(RAIL_STYLE_ATTRIBUTE);
  });

  document.querySelectorAll<HTMLElement>(`[${SETTINGS_STYLE_ATTRIBUTE}]`).forEach((node) => {
    node.removeAttribute(SETTINGS_STYLE_ATTRIBUTE);
    node.style.height = "";
    node.style.minHeight = "";
    node.style.overflow = "";
  });

  document.querySelectorAll<HTMLElement>(`[${PREMIUM_FREE_BANNER_ATTRIBUTE}]`).forEach((node) => {
    node.removeAttribute(PREMIUM_FREE_BANNER_ATTRIBUTE);
    node.style.height = "";
    node.style.minHeight = "";
    node.style.display = "";
    node.style.alignItems = "";
    node.style.justifyContent = "";
  });

  const main = document.querySelector<HTMLElement>("main");
  if (main) {
    main.style.paddingTop = "";
  }

  const railContainer = findRailContainer();
  if (railContainer) {
    railContainer.removeAttribute(EMPTY_RAIL_ATTRIBUTE);
    railContainer.style.marginTop = "";
    railContainer.style.height = "";
    railContainer.style.opacity = "";
    railContainer.style.pointerEvents = "";
  }

  const settingsPanel = findSettingsPanel();
  if (settingsPanel) {
    settingsPanel.style.paddingTop = "";
  }
};

export const syncReaderEnhancer = ({
  settings,
  commitSettings,
}: SyncOptions): void => {
  prefetchNextChapterEnabled = settings.prefetchNextChapter;
  ensureStyles();
  ensureFullscreenListener();

  const readerDom = getReaderDom();
  if (!readerDom.railContainer || !readerDom.settingsButton || !readerDom.settingsGroup) {
    resetTransientSubsectionState();
    return;
  }

  if (!readerDom.settingsPanel) {
    resetTransientSubsectionState();
  }

  syncMainFullscreenButton(readerDom);
  syncSettingsPanel(readerDom, settings, commitSettings);
  applyVisibilitySettings(readerDom, settings);
  syncFullscreenButtonStates();
  dismissPopups(settings);
};

export const hideDynamicReaderArtifacts = (
  node: Node | null,
  settings: ReaderEnhancerSettings,
): void => {
  if (!settings.hideCommentsSection || !(node instanceof Element)) {
    return;
  }

  const blocks = new Set<HTMLElement>();
  findDynamicCommentsVisibilityBlocks(node).forEach((block) => {
    blocks.add(block);
  });
  findInterChapterAdBlocks(node).forEach((block) => {
    if (isSafeAdVisibilityBlock(block)) {
      blocks.add(block);
    }
  });

  blocks.forEach((block) => {
    markHidden(block, true);
  });
};

const ensureStyles = (): void => {
  if (stylesInstalled) {
    return;
  }

  const styleTag = document.createElement("style");
  styleTag.setAttribute(CONTROL_ATTRIBUTE, "styles");
  styleTag.textContent = `
    [${HIDDEN_ATTRIBUTE}="true"] {
      display: none !important;
    }

    [${EMPTY_RAIL_ATTRIBUTE}="true"] {
      opacity: 0;
      pointer-events: none;
    }

    [${CONTROL_ATTRIBUTE}="settings-rows"] {
      transform-origin: top center;
      will-change: max-height, opacity, transform, filter;
      transition:
        max-height ${COLLAPSE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        opacity ${COLLAPSE_DURATION_MS - 20}ms ease,
        transform ${COLLAPSE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1),
        filter ${COLLAPSE_DURATION_MS}ms ease;
    }

    [${CONTROL_ATTRIBUTE}="settings-rows"][${SECTION_COLLAPSE_ATTRIBUTE}="enter-from"],
    [${CONTROL_ATTRIBUTE}="settings-rows"][${SECTION_COLLAPSE_ATTRIBUTE}="exit"],
    [${CONTROL_ATTRIBUTE}="settings-rows"][${SECTION_COLLAPSE_ATTRIBUTE}="hidden"] {
      opacity: 0;
      transform: translateY(-12px) scale(0.98);
      filter: blur(6px);
    }

    [${CONTROL_ATTRIBUTE}="settings-rows"][${SECTION_COLLAPSE_ATTRIBUTE}="enter-from"] {
      transition: none !important;
    }

    [${CONTROL_ATTRIBUTE}="settings-rows"][${SECTION_COLLAPSE_ATTRIBUTE}="enter"],
    [${CONTROL_ATTRIBUTE}="settings-rows"][${SECTION_COLLAPSE_ATTRIBUTE}="shown"] {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0);
    }

    [${CONTROL_ATTRIBUTE}="premium-free-root"] {
      width: 100%;
      margin: 0 auto;
      padding: 24px 0 40px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      color: #f8fafc;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-root"][${PREMIUM_FREE_STATE_ATTRIBUTE}="resolving"],
    [${CONTROL_ATTRIBUTE}="premium-free-root"][${PREMIUM_FREE_STATE_ATTRIBUTE}="error"] {
      justify-content: center;
      min-height: 100vh;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-root"][${PREMIUM_FREE_STATE_ATTRIBUTE}="rendering"] {
      gap: 0;
      padding-top: 0;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-status"] {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(calc(100% - 32px), 980px);
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      border-radius: 28px;
      background:
        linear-gradient(160deg, rgba(15, 23, 42, 0.82), rgba(30, 41, 59, 0.74)),
        radial-gradient(circle at top, rgba(56, 189, 248, 0.18), transparent 52%);
      box-shadow:
        0 24px 48px rgba(15, 23, 42, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(14px);
    }

    [${CONTROL_ATTRIBUTE}="premium-free-title"] {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-copy"] {
      max-width: 480px;
      font-size: 14px;
      line-height: 1.55;
      color: rgba(226, 232, 240, 0.82);
    }

    [${CONTROL_ATTRIBUTE}="premium-free-link"] {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      border-radius: 9999px;
      background: rgba(248, 250, 252, 0.12);
      color: inherit;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      transition: background-color 160ms ease, transform 160ms ease;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-link"]:hover,
    [${CONTROL_ATTRIBUTE}="premium-free-link"]:focus-visible {
      background: rgba(248, 250, 252, 0.18);
      transform: translateY(-1px);
    }

    button[${CONTROL_ATTRIBUTE}="premium-free-link"] {
      border: none;
      cursor: pointer;
      font-family: inherit;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-skeleton-list"] {
      display: flex;
      flex-direction: column;
      gap: 12px;
      width: min(calc(100% - 32px), 640px);
    }

    [${CONTROL_ATTRIBUTE}="premium-free-skeleton-line"] {
      height: 84px;
      border-radius: 24px;
      background:
        linear-gradient(110deg, rgba(148, 163, 184, 0.12) 8%, rgba(226, 232, 240, 0.22) 18%, rgba(148, 163, 184, 0.12) 33%),
        linear-gradient(160deg, rgba(15, 23, 42, 0.74), rgba(30, 41, 59, 0.62));
      background-size: 220% 100%, 100% 100%;
      animation: rre-premium-skeleton 1.3s linear infinite;
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.04),
        0 10px 24px rgba(15, 23, 42, 0.18);
    }

    [${CONTROL_ATTRIBUTE}="premium-free-feed-reader"] {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      gap: 0;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-stream-chapter"] {
      display: flex;
      width: 100%;
      flex-direction: column;
      align-items: center;
      gap: 0;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-branch-selector"] {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 12px auto 20px;
      padding: 8px 14px;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.62);
      color: rgba(226, 232, 240, 0.88);
      font-size: 13px;
      line-height: 1.4;
    }
    [${CONTROL_ATTRIBUTE}="premium-free-branch-label"] {
      opacity: 0.75;
    }
    [${CONTROL_ATTRIBUTE}="premium-free-branch-select"] {
      appearance: none;
      background: rgba(30, 41, 59, 0.92);
      color: rgba(241, 245, 249, 0.95);
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 8px;
      padding: 6px 28px 6px 10px;
      font: inherit;
      cursor: pointer;
      outline: none;
    }
    [${CONTROL_ATTRIBUTE}="premium-free-branch-select"]:hover,
    [${CONTROL_ATTRIBUTE}="premium-free-branch-select"]:focus-visible {
      border-color: rgba(148, 163, 184, 0.7);
    }

    [${CONTROL_ATTRIBUTE}="premium-free-stream-loader"] {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 24px auto 32px;
      padding: 12px 18px;
      border-radius: 9999px;
      background: rgba(15, 23, 42, 0.74);
      color: rgba(226, 232, 240, 0.88);
      font-size: 13px;
      line-height: 1.4;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(12px);
    }

    [${CONTROL_ATTRIBUTE}="premium-free-stream-actions"] {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      margin-top: 8px;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-stream-retry"] {
      appearance: none;
      border: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      border-radius: 9999px;
      background: rgba(248, 250, 252, 0.16);
      color: inherit;
      font-size: 14px;
      font-weight: 600;
      transition: background-color 160ms ease, transform 160ms ease;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-stream-retry"]:hover,
    [${CONTROL_ATTRIBUTE}="premium-free-stream-retry"]:focus-visible {
      background: rgba(248, 250, 252, 0.24);
      transform: translateY(-1px);
    }

    [${CONTROL_ATTRIBUTE}="premium-free-pager-reader"] {
      position: relative;
      display: flex;
      min-height: 100vh;
      width: 100%;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-page-shell"] {
      display: flex;
      width: 100%;
      justify-content: center;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-clickable-area"] {
      z-index: 40;
      pointer-events: none;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-click-zone-prev"],
    [${CONTROL_ATTRIBUTE}="premium-free-click-zone-center"],
    [${CONTROL_ATTRIBUTE}="premium-free-click-zone-next"] {
      appearance: none;
      border: 0;
      padding: 0;
      margin: 0;
      background: transparent;
      pointer-events: auto;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-click-zone-prev"] {
      cursor: w-resize;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-click-zone-next"] {
      cursor: e-resize;
    }

    [${CONTROL_ATTRIBUTE}="premium-free-image"] {
      display: block;
      width: 100%;
      height: auto;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
    }

    @keyframes rre-premium-skeleton {
      0% {
        background-position: 200% 0, 0 0;
      }

      100% {
        background-position: -20% 0, 0 0;
      }
    }

    [${MOTION_ATTRIBUTE}] {
      will-change: opacity, transform, filter, -webkit-mask-position, mask-position;
      transform: translate3d(0, 0, 0);
      transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
    }

    [${MOTION_ATTRIBUTE}][${MOTION_STATE_ATTRIBUTE}="enter-from"] {
      transition: none !important;
      pointer-events: none;
    }

    [${MOTION_ATTRIBUTE}="slide-right"] {
      transition-property: opacity, transform, filter;
      transition-duration: ${SLIDE_RIGHT_DURATION_MS}ms;
    }

    [${MOTION_ATTRIBUTE}="slide-right"][${MOTION_STATE_ATTRIBUTE}="enter-from"],
    [${MOTION_ATTRIBUTE}="slide-right"][${MOTION_STATE_ATTRIBUTE}="exit"],
    [${MOTION_ATTRIBUTE}="slide-right"][${MOTION_STATE_ATTRIBUTE}="hidden"] {
      opacity: 0;
      transform: translate3d(72px, 0, 0) scale(0.96);
      filter: blur(6px);
    }

    [${MOTION_ATTRIBUTE}="slide-right"][${MOTION_STATE_ATTRIBUTE}="enter"],
    [${MOTION_ATTRIBUTE}="slide-right"][${MOTION_STATE_ATTRIBUTE}="shown"] {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
      filter: blur(0);
    }

    [${MOTION_ATTRIBUTE}="dissolve"] {
      transition-property: opacity, transform, filter, -webkit-mask-position, mask-position;
      transition-duration: ${DISSOLVE_DURATION_MS}ms;
    }

    [${MOTION_ATTRIBUTE}="dissolve"][${MOTION_STATE_ATTRIBUTE}="enter-from"],
    [${MOTION_ATTRIBUTE}="dissolve"][${MOTION_STATE_ATTRIBUTE}="exit"],
    [${MOTION_ATTRIBUTE}="dissolve"][${MOTION_STATE_ATTRIBUTE}="hidden"] {
      opacity: 0;
      transform: translate3d(18px, -2px, 0) scale(0.985);
      filter: blur(10px) saturate(1.15);
      -webkit-mask-image:
        linear-gradient(90deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.45) 28%, rgba(0, 0, 0, 0.85) 58%, rgba(0, 0, 0, 0) 100%),
        repeating-linear-gradient(102deg, rgba(0, 0, 0, 1) 0 10px, rgba(0, 0, 0, 0) 12px 18px);
      mask-image:
        linear-gradient(90deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.45) 28%, rgba(0, 0, 0, 0.85) 58%, rgba(0, 0, 0, 0) 100%),
        repeating-linear-gradient(102deg, rgba(0, 0, 0, 1) 0 10px, rgba(0, 0, 0, 0) 12px 18px);
      -webkit-mask-size: 140% 100%, 22px 100%;
      mask-size: 140% 100%, 22px 100%;
      -webkit-mask-position: 100% 0, 0 0;
      mask-position: 100% 0, 0 0;
    }

    [${MOTION_ATTRIBUTE}="dissolve"][${MOTION_STATE_ATTRIBUTE}="enter"],
    [${MOTION_ATTRIBUTE}="dissolve"][${MOTION_STATE_ATTRIBUTE}="shown"] {
      opacity: 1;
      transform: translate3d(0, 0, 0) scale(1);
      filter: blur(0);
      -webkit-mask-image: none;
      mask-image: none;
    }

    @media (prefers-reduced-motion: reduce) {
      [${CONTROL_ATTRIBUTE}="settings-rows"],
      [${MOTION_ATTRIBUTE}] {
        transition-duration: 1ms !important;
      }
    }
  `;

  document.documentElement.append(styleTag);
  stylesInstalled = true;
};

const ensureFullscreenListener = (): void => {
  if (fullscreenListenerAttached) {
    return;
  }

  document.addEventListener("fullscreenchange", () => {
    syncFullscreenButtonStates();
  });

  fullscreenListenerAttached = true;
};

const getReaderDom = (): ReaderDom => {
  const railContainer = findRailContainer();
  const settingsButton = findToolbarButtonByIcon("Settings", railContainer ?? document);
  const settingsGroup = settingsButton?.closest<HTMLElement>("div") ?? null;

  return {
    header: document.querySelector<HTMLElement>("header.fixed"),
    main: document.querySelector<HTMLElement>("main"),
    railContainer,
    pageCounterButton:
      railContainer?.querySelector<HTMLButtonElement>(
        'button[data-sentry-element="PageIndicatorTrigger"]',
      ) ?? findPageCounterButton(railContainer),
    settingsButton,
    settingsGroup,
    settingsPanel: findSettingsPanel(),
    commentsBlocks: findCommentsVisibilityBlocks(),
    adBlocks: findInterChapterAdBlocks(),
    toolbarButtons: {
      list: findToolbarButtonByIcon("List", railContainer),
      comments: findToolbarButtonByIcon("Comments", railContainer),
      like: findToolbarButtonByIcon("Like", railContainer),
      addImage: findToolbarButtonByIcon("AddPicture", railContainer),
      edit: findToolbarButtonByIcon("Edit", railContainer),
      autoScroll: findAutoScrollButton(railContainer),
      report: findToolbarButtonByIcon("Report", railContainer),
    },
  };
};

const findRailContainer = (): HTMLElement | null =>
  findToolbarButtonByIcon("Settings")?.closest<HTMLElement>(
    '[data-sentry-element="AsideContainer"]',
  ) ?? null;

const findSettingsPanel = (): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>("div")).find((node) => {
    if (!node.classList.contains("bg-background-content")) {
      return false;
    }

    const text = normalizeText(node.textContent);
    return text.includes("настройки читалки");
  }) ?? null;

const findBuyChapterBanner = (): HTMLElement | null => {
  const actionsBlock = document.querySelector<HTMLElement>(
    '[data-sentry-component="BuyChapterActions"]',
  );
  if (!actionsBlock) {
    return null;
  }

  return actionsBlock.closest<HTMLElement>("div.h-screen") ?? actionsBlock;
};

const PREMIUM_FREE_ROOT_KEY = "premium-free-root";
const PREMIUM_FREE_KEY_ATTRIBUTE = "data-rre-premium-free-key";
const PREMIUM_FREE_READER_WIDTH_CLASS =
  "reader-container-width relative m-[0_auto] h-auto max-w-(--reader-container-max-width) [filter:var(--reader-brightness)]";
const PREMIUM_FREE_CLICKABLE_AREA_CLASS =
  "absolute inset-0 flex reader-container-width left-1/2 size-full h-full -translate-x-1/2";
const PREMIUM_FREE_CLICK_ZONE_CLASS = "relative z-[100] h-full w-1/3 select-none";
const PREMIUM_FREE_SCROLL_LISTENER_OPTIONS = {
  capture: true,
  passive: true,
} as const;

const mapPremiumFreeReaderMode = (
  readerType: string | null | undefined,
): PremiumFreeReaderMode | null => {
  const normalized = normalizeText(readerType);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("pager") || normalized.includes("постраничная")) {
    return "pager";
  }

  if (normalized.includes("slider") || normalized.includes("лента")) {
    return "feed";
  }

  return null;
};

const collectPremiumFreeReaderModeFromSettingsPanel = (
  settingsPanel: HTMLElement | null,
): PremiumFreeReaderMode | null => {
  if (!settingsPanel) {
    return null;
  }

  const readerTypeGroup =
    queryAllWithSelf<HTMLElement>(settingsPanel, '[role="radiogroup"]').find((group) => {
      const text = normalizeText(group.textContent);
      return text.includes("постраничная") && text.includes("лента");
    }) ?? null;

  if (!readerTypeGroup) {
    return null;
  }

  const activeOption =
    queryAllWithSelf<HTMLElement>(readerTypeGroup, '[role="radio"], button').find(
      (node) => node.getAttribute("aria-checked") === "true",
    ) ?? null;

  if (!activeOption) {
    return null;
  }

  return mapPremiumFreeReaderMode(activeOption.textContent);
};

const collectPremiumFreeDefaultReaderState = (): Partial<PremiumFreeReaderState> | null => {
  const defaultValueScript =
    Array.from(document.scripts).find((script) => {
      const text = script.textContent ?? "";
      return text.includes('"defaultValue"') && text.includes('"readerType"');
    }) ?? null;

  const defaultValueMatch = defaultValueScript?.textContent?.match(
    /"defaultValue":"((?:\\.|[^"])*)"/,
  );
  if (!defaultValueMatch?.[1]) {
    return null;
  }

  try {
    const decodedValue = JSON.parse(`"${defaultValueMatch[1]}"`) as string;
    const parsedValue = JSON.parse(decodedValue) as {
      manga?: {
        readerType?: string;
      };
      common?: {
        containerWidth?: number;
        brightness?: number;
      };
    };

    return {
      mode: mapPremiumFreeReaderMode(parsedValue.manga?.readerType) ?? undefined,
      containerWidthVar:
        typeof parsedValue.common?.containerWidth === "number"
          ? `${parsedValue.common.containerWidth}vw`
          : null,
      brightnessVar:
        typeof parsedValue.common?.brightness === "number"
          ? `brightness(${parsedValue.common.brightness / 100})`
          : null,
    };
  } catch {
    return null;
  }
};

const readPremiumFreeReaderCssVars = (
  node: HTMLElement,
): Pick<PremiumFreeReaderState, "containerWidthVar" | "brightnessVar"> => {
  const computedStyle = window.getComputedStyle(node);
  const containerWidthVar =
    computedStyle.getPropertyValue("--reader-container-width").trim() || null;
  const brightnessVar =
    computedStyle.getPropertyValue("--reader-brightness").trim() || null;

  return {
    containerWidthVar,
    brightnessVar,
  };
};

const collectPremiumFreeReaderCssVars = (): Pick<
  PremiumFreeReaderState,
  "containerWidthVar" | "brightnessVar"
> => {
  const nativeReaderContainer =
    Array.from(document.querySelectorAll<HTMLElement>(".reader-container-width")).find(
      (node) => !node.closest(`[${CONTROL_ATTRIBUTE}]`),
    ) ?? null;
  if (nativeReaderContainer) {
    return readPremiumFreeReaderCssVars(nativeReaderContainer);
  }

  const probeHost =
    findBuyChapterBanner() ??
    document.querySelector<HTMLElement>("main") ??
    document.body;

  const probe = document.createElement("div");
  probe.className = PREMIUM_FREE_READER_WIDTH_CLASS;
  probe.setAttribute("data-reader-vars-scope", "true");
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  probe.style.visibility = "hidden";
  probe.style.inset = "0";
  probe.style.maxHeight = "0";
  probe.style.overflow = "hidden";
  probeHost.append(probe);

  const vars = readPremiumFreeReaderCssVars(probe);
  probe.remove();
  return vars;
};

const collectPremiumFreeReaderState = (): PremiumFreeReaderState => {
  const liveVars = collectPremiumFreeReaderCssVars();
  const defaultState = collectPremiumFreeDefaultReaderState();
  const state: PremiumFreeReaderState = {
    mode:
      collectPremiumFreeReaderModeFromSettingsPanel(findSettingsPanel()) ??
      premiumFreeReaderStateSnapshot?.mode ??
      defaultState?.mode ??
      "feed",
    containerWidthVar:
      liveVars.containerWidthVar ??
      premiumFreeReaderStateSnapshot?.containerWidthVar ??
      defaultState?.containerWidthVar ??
      null,
    brightnessVar:
      liveVars.brightnessVar ??
      premiumFreeReaderStateSnapshot?.brightnessVar ??
      defaultState?.brightnessVar ??
      null,
  };

  premiumFreeReaderStateSnapshot = state;
  return state;
};

const applyPremiumFreeReaderVars = (
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

const clampPremiumFreePageIndex = (
  nextIndex: number,
  totalPages: number,
): number => {
  if (totalPages <= 0) {
    return 0;
  }

  return Math.min(Math.max(nextIndex, 0), totalPages - 1);
};

type PremiumFreeImageLoadEvent = { proxyPath: string; success: boolean };
type PremiumFreeImageLoadListener = (event: PremiumFreeImageLoadEvent) => void;

const premiumFreeImageLoadListeners = new Set<PremiumFreeImageLoadListener>();

export const subscribePremiumFreeImageLoad = (
  listener: PremiumFreeImageLoadListener,
): (() => void) => {
  premiumFreeImageLoadListeners.add(listener);
  return () => {
    premiumFreeImageLoadListeners.delete(listener);
  };
};

const notifyPremiumFreeImageLoad = (event: PremiumFreeImageLoadEvent): void => {
  premiumFreeImageLoadListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      /* swallow listener errors */
    }
  });
};

const imageBlobCache = new Map<string, string>();
const pendingImageLoads = new Map<string, Promise<string | null>>();

const fetchImageBlobUrl = (proxyPath: string): Promise<string | null> => {
  const cached = imageBlobCache.get(proxyPath);
  if (cached) {
    notifyPremiumFreeImageLoad({ proxyPath, success: true });
    return Promise.resolve(cached);
  }

  const pending = pendingImageLoads.get(proxyPath);
  if (pending) return pending;

  const promise = new Promise<string | null>((resolve) => {
    chrome.runtime.sendMessage(
      { type: PROXY_IMAGE_MESSAGE_TYPE, proxyPath },
      (response: unknown) => {
        pendingImageLoads.delete(proxyPath);
        if (
          !response ||
          typeof response !== "object" ||
          !("data" in response) ||
          typeof (response as { data: unknown }).data !== "string"
        ) {
          resolve(null);
          notifyPremiumFreeImageLoad({ proxyPath, success: false });
          return;
        }
        const dataUrl = (response as { data: string }).data;
        const commaIndex = dataUrl.indexOf(",");
        if (commaIndex === -1) {
          resolve(null);
          notifyPremiumFreeImageLoad({ proxyPath, success: false });
          return;
        }
        try {
          const mimeMatch = dataUrl.substring(0, commaIndex).match(/data:([^;]+)/);
          const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const binary = atob(dataUrl.substring(commaIndex + 1));
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
          imageBlobCache.set(proxyPath, blobUrl);
          resolve(blobUrl);
          notifyPremiumFreeImageLoad({ proxyPath, success: true });
        } catch {
          resolve(null);
          notifyPremiumFreeImageLoad({ proxyPath, success: false });
        }
      },
    );
  });

  pendingImageLoads.set(proxyPath, promise);
  return promise;
};

const createPremiumFreeImage = (
  page: Extract<PremiumFreeClientResolveResult, { status: "success" }>["pages"][number],
): HTMLImageElement => {
  const image = document.createElement("img");
  image.setAttribute(CONTROL_ATTRIBUTE, "premium-free-image");
  image.decoding = "async";
  image.alt = `Страница ${page.index + 1}`;

  const cached = imageBlobCache.get(page.proxyUrl);
  if (cached) {
    image.src = cached;
  } else {
    void fetchImageBlobUrl(page.proxyUrl).then((blobUrl) => {
      if (blobUrl) image.src = blobUrl;
    });
  }

  return image;
};

const createPremiumFreePageFrame = (
  state: PremiumFreeReaderState,
): HTMLElement => {
  const pageFrame = document.createElement("div");
  pageFrame.setAttribute(CONTROL_ATTRIBUTE, "premium-free-page-frame");
  pageFrame.className = PREMIUM_FREE_READER_WIDTH_CLASS;
  applyPremiumFreeReaderVars(pageFrame, state);
  return pageFrame;
};

const renderPremiumFreeFeedPages = (
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

const getPremiumFreeViewportHeight = (): number =>
  window.innerHeight || document.documentElement.clientHeight || 0;

const collectPremiumFreeViewportPages = (
  container: HTMLElement,
): Array<{ key: string; pageIndex: number; top: number; bottom: number }> =>
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

const syncPremiumFreeVisibleStreamPage = (): void => {
  const stream = premiumFreeChapterStream;
  if (!stream) {
    return;
  }

  let activeKey: string | null = null;
  let activePageIndex = -1;
  let maxRatio = -1;

  Array.from(stream.visiblePages.entries()).forEach(([node, rawMeta]) => {
    const meta = rawMeta as PremiumFreeVisiblePage;
    if (!node.isConnected) {
      stream.visiblePages.delete(node);
      return;
    }

    if (meta.ratio > maxRatio) {
      activeKey = meta.key;
      activePageIndex = meta.pageIndex;
      maxRatio = meta.ratio;
    }
  });

  if (!activeKey || activePageIndex < 0) {
    const activeViewportPage = pickPremiumFreeActivePage(
      collectPremiumFreeViewportPages(stream.container),
      getPremiumFreeViewportHeight(),
    );
    activeKey = activeViewportPage?.key ?? null;
    activePageIndex = activeViewportPage?.pageIndex ?? -1;
  }

  if (!activeKey || activePageIndex < 0) {
    syncPremiumFreeReaderIndicators(null, null);
    return;
  }

  const activeEntry =
    stream.entries.find((entry) => entry.key === activeKey) ?? null;

  syncPremiumFreeReaderIndicators(activeEntry, activePageIndex);

  const lastEntryKey = stream.entries.at(-1)?.key ?? null;
  if (
    activeEntry &&
    shouldPrefetchPremiumFreeNextChapter({
      activePageIndex,
      totalPages: activeEntry.result.totalPages,
      isLastStreamEntry: activeEntry.key === lastEntryKey,
      streamStatus: stream.status,
    })
  ) {
    void loadPremiumFreeNextChapter();
  }

  const lastViewportPage = collectPremiumFreeViewportPages(stream.container).at(-1);
  if (
    shouldPrefetchPremiumFreeNextChapterByViewport({
      distanceToViewportBottom:
        (lastViewportPage?.bottom ?? Number.POSITIVE_INFINITY) -
        getPremiumFreeViewportHeight(),
      hasNextChapter: Boolean(stream.entries.at(-1)?.result.nextChapter),
      streamStatus: stream.status,
    })
  ) {
    void loadPremiumFreeNextChapter();
  }
};

const requestPremiumFreeViewportSync = (): void => {
  if (premiumFreeViewportSyncHandle) {
    return;
  }

  premiumFreeViewportSyncHandle = window.requestAnimationFrame(() => {
    premiumFreeViewportSyncHandle = 0;
    syncPremiumFreeVisibleStreamPage();
  });
};

const ensurePremiumFreeViewportListeners = (): void => {
  if (premiumFreeViewportListenersAttached) {
    return;
  }

  window.addEventListener(
    "scroll",
    requestPremiumFreeViewportSync,
    PREMIUM_FREE_SCROLL_LISTENER_OPTIONS,
  );
  document.addEventListener(
    "scroll",
    requestPremiumFreeViewportSync,
    PREMIUM_FREE_SCROLL_LISTENER_OPTIONS,
  );
  window.addEventListener("resize", requestPremiumFreeViewportSync, { passive: true });
  premiumFreeViewportListenersAttached = true;
};

const disconnectPremiumFreeViewportListeners = (): void => {
  if (premiumFreeViewportSyncHandle) {
    window.cancelAnimationFrame(premiumFreeViewportSyncHandle);
    premiumFreeViewportSyncHandle = 0;
  }

  if (!premiumFreeViewportListenersAttached) {
    return;
  }

  window.removeEventListener(
    "scroll",
    requestPremiumFreeViewportSync,
    PREMIUM_FREE_SCROLL_LISTENER_OPTIONS,
  );
  document.removeEventListener(
    "scroll",
    requestPremiumFreeViewportSync,
    PREMIUM_FREE_SCROLL_LISTENER_OPTIONS,
  );
  window.removeEventListener("resize", requestPremiumFreeViewportSync);
  premiumFreeViewportListenersAttached = false;
};

const observePremiumFreeStreamPages = (container: HTMLElement): void => {
  const stream = premiumFreeChapterStream;
  if (!stream) {
    return;
  }

  premiumFreeStreamPageObserver?.disconnect();
  stream.visiblePages.clear();
  premiumFreeStreamPageObserver = new IntersectionObserver(
    (entries) => {
      const currentStream = premiumFreeChapterStream;
      if (!currentStream) {
        return;
      }

      entries.forEach((entry) => {
        const target = entry.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        if (!entry.isIntersecting || entry.intersectionRatio <= 0) {
          currentStream.visiblePages.delete(target);
          return;
        }

        const key = target.dataset.rrePremiumFreeStreamKey;
        const pageIndex = Number(target.dataset.rrePremiumFreePageIndex ?? "-1");
        if (!key || Number.isNaN(pageIndex) || pageIndex < 0) {
          return;
        }

        const visiblePage: PremiumFreeVisiblePage = {
          key,
          pageIndex,
          ratio: entry.intersectionRatio,
        };
        currentStream.visiblePages.set(target, visiblePage);
      });

      syncPremiumFreeVisibleStreamPage();
    },
    {
      threshold: [0.2, 0.4, 0.65],
    },
  );

  Array.from(
    container.querySelectorAll<HTMLElement>(
      `[${CONTROL_ATTRIBUTE}="premium-free-page-shell"][data-rre-premium-free-stream-key]`,
    ),
  ).forEach((node) => {
    premiumFreeStreamPageObserver?.observe(node);
  });
};

const createPremiumFreeStreamLoader = (): HTMLElement => {
  const loader = document.createElement("div");
  loader.setAttribute(CONTROL_ATTRIBUTE, "premium-free-stream-loader");
  loader.textContent = "Подгружаем следующую главу из parser-server.";
  return loader;
};

const createPremiumFreeStreamError = (
  failure: PremiumFreeFailureResult,
  titleName: string,
): HTMLElement => {
  const description = describePremiumFreeFailure(failure, titleName);
  const card = createPremiumFreeStatusCard(
    description.title,
    description.copy,
    description.linkHref,
    description.linkLabel,
  );
  const actions = document.createElement("div");
  actions.setAttribute(CONTROL_ATTRIBUTE, "premium-free-stream-actions");

  const retryButton = document.createElement("button");
  retryButton.type = "button";
  retryButton.setAttribute(CONTROL_ATTRIBUTE, "premium-free-stream-retry");
  retryButton.textContent = "Повторить";
  retryButton.addEventListener("click", () => {
    if (!premiumFreeChapterStream) {
      return;
    }

    premiumFreeChapterStream.status = "idle";
    premiumFreeChapterStream.errorResult = null;
    void loadPremiumFreeNextChapter();
  });
  actions.append(retryButton);

  const banner = findBuyChapterBanner();
  if (banner) {
    const fallbackButton = document.createElement("button");
    fallbackButton.type = "button";
    fallbackButton.setAttribute(CONTROL_ATTRIBUTE, "premium-free-stream-retry");
    fallbackButton.textContent = "Показать карточку ReManga";
    fallbackButton.addEventListener("click", () => {
      resetPremiumFreeChapterStream();
      restorePremiumFreeBanner(banner);
      banner
        .querySelector<HTMLElement>(`[${CONTROL_ATTRIBUTE}="${PREMIUM_FREE_ROOT_KEY}"]`)
        ?.remove();
    });
    actions.append(fallbackButton);
  }

  card.append(actions);
  return card;
};

const createPremiumFreeBranchSelector = (
  success: Extract<PremiumFreeClientResolveResult, { status: "success" }>,
  titleDir: string,
): HTMLElement | null => {
  const branches = success.branches;
  if (!branches || branches.length < 2) return null;

  const wrapper = document.createElement("div");
  wrapper.setAttribute(CONTROL_ATTRIBUTE, "premium-free-branch-selector");

  const label = document.createElement("span");
  label.setAttribute(CONTROL_ATTRIBUTE, "premium-free-branch-label");
  label.textContent = "Перевод:";
  wrapper.append(label);

  const select = document.createElement("select");
  select.setAttribute(CONTROL_ATTRIBUTE, "premium-free-branch-select");

  branches.forEach((branch) => {
    const option = document.createElement("option");
    option.value = branch.id;
    option.textContent = `${branch.name} · ${branch.chaptersCount} гл.`;
    if (branch.id === success.selectedBranchId) {
      option.selected = true;
    }
    select.append(option);
  });

  select.addEventListener("change", () => {
    const chosen = select.value;
    if (!chosen || chosen === success.selectedBranchId) return;
    persistPremiumFreeBranchPref(titleDir, {
      provider: success.provider,
      branchId: chosen,
    });
    // Clear cached results so the next resolve re-hits the server with the
    // new forcedBranchId. window.location.reload() is the simplest way to
    // tear down the current stream state and start fresh on the same URL.
    premiumFreeResultCache.clear();
    premiumFreeChapterStream = null;
    window.location.reload();
  });

  wrapper.append(select);
  return wrapper;
};

const renderPremiumFreeFeedStream = (
  container: HTMLElement,
  stream: PremiumFreeChapterStream,
  state: PremiumFreeReaderState,
): void => {
  const streamReader = document.createElement("div");
  streamReader.setAttribute(CONTROL_ATTRIBUTE, "premium-free-feed-reader");

  const firstEntry = stream.entries[0];
  if (firstEntry) {
    const selector = createPremiumFreeBranchSelector(
      firstEntry.result,
      firstEntry.reference.titleDir,
    );
    if (selector) streamReader.append(selector);
  }

  stream.entries.forEach((entry) => {
    const chapterSection = document.createElement("section");
    chapterSection.setAttribute(CONTROL_ATTRIBUTE, "premium-free-stream-chapter");
    chapterSection.dataset.rrePremiumFreeStreamKey = entry.key;
    renderPremiumFreeFeedPages(chapterSection, entry.result, state, entry.key);
    streamReader.append(chapterSection);
  });

  const tailSection = streamReader.lastElementChild;
  if (tailSection instanceof HTMLElement) {
    if (stream.status === "loading-next") {
      tailSection.append(createPremiumFreeStreamLoader());
    } else if (stream.status === "error" && stream.errorResult) {
      tailSection.append(
        createPremiumFreeStreamError(
          stream.errorResult,
          stream.entries.at(-1)?.reference.titleName ?? "Premium Free",
        ),
      );
    } else if (stream.status !== "exhausted" && stream.entries.at(-1)?.result.nextChapter) {
      const sentinel = document.createElement("div");
      sentinel.setAttribute(CONTROL_ATTRIBUTE, "premium-free-stream-sentinel");
      sentinel.style.width = "100%";
      sentinel.style.height = "1px";
      tailSection.append(sentinel);
    }
  }

  container.replaceChildren(streamReader);
  observePremiumFreeStreamPages(container);
  observePremiumFreeLoadSentinel();
  ensurePremiumFreeViewportListeners();
  syncPremiumFreeVisibleStreamPage();
  requestPremiumFreeViewportSync();
};

const observePremiumFreeLoadSentinel = (): void => {
  const stream = premiumFreeChapterStream;
  if (!stream?.container.isConnected) {
    return;
  }

  premiumFreeStreamLoadObserver?.disconnect();
  const sentinel = stream.container.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="premium-free-stream-sentinel"]`,
  );
  if (!sentinel) {
    return;
  }

  premiumFreeStreamLoadObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadPremiumFreeNextChapter();
      }
    },
    {
      rootMargin: "1200px 0px 400px 0px",
      threshold: 0,
    },
  );

  premiumFreeStreamLoadObserver.observe(sentinel);
};

const renderPremiumFreePagerPages = (
  container: HTMLElement,
  result: Extract<PremiumFreeClientResolveResult, { status: "success" }>,
  state: PremiumFreeReaderState,
  key: string,
): void => {
  const reader = document.createElement("div");
  reader.setAttribute(CONTROL_ATTRIBUTE, "premium-free-pager-reader");

  const currentPageIndex = clampPremiumFreePageIndex(
    premiumFreePageIndex.get(key) ?? 0,
    result.pages.length,
  );
  premiumFreePageIndex.set(key, currentPageIndex);

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

  const rerender = (nextIndex: number): void => {
    premiumFreePageIndex.set(
      key,
      clampPremiumFreePageIndex(nextIndex, result.pages.length),
    );
    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
    renderPremiumFreePagerPages(container, result, collectPremiumFreeReaderState(), key);
  };

  const previousZone = document.createElement("button");
  previousZone.type = "button";
  previousZone.setAttribute(CONTROL_ATTRIBUTE, "premium-free-click-zone-prev");
  previousZone.className = PREMIUM_FREE_CLICK_ZONE_CLASS;
  previousZone.setAttribute("aria-label", "Предыдущая страница");
  previousZone.addEventListener("click", () => {
    rerender(currentPageIndex - 1);
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
    rerender(currentPageIndex + 1);
  });

  clickableArea.append(previousZone, centerZone, nextZone);
  reader.append(clickableArea);
  container.replaceChildren(reader);
};

const syncPremiumFreeBanner = (
  banner: HTMLElement | null,
  enabled: boolean,
): void => {
  const existingPlaceholder = document.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="${PREMIUM_FREE_ROOT_KEY}"]`,
  );
  const existingKey = existingPlaceholder?.getAttribute(PREMIUM_FREE_KEY_ATTRIBUTE);

  if (!banner || !enabled) {
    abortPremiumFreeRequest();
    resetPremiumFreeChapterStream();
    if (existingKey) {
      premiumFreePageIndex.delete(existingKey);
    }
    restorePremiumFreeBanner(banner);
    existingPlaceholder?.remove();
    return;
  }

  const reference = collectPremiumFreeTargetReference(banner);
  if (!reference) {
    abortPremiumFreeRequest();
    resetPremiumFreeChapterStream();
    if (existingKey) {
      premiumFreePageIndex.delete(existingKey);
    }
    restorePremiumFreeBanner(banner);
    existingPlaceholder?.remove();
    return;
  }

  const key = createPremiumFreeKey(reference);
  const container = ensurePremiumFreeContainer(banner);
  if (existingKey && existingKey !== key) {
    premiumFreePageIndex.delete(existingKey);
    resetPremiumFreeChapterStream();
  }
  container.setAttribute(PREMIUM_FREE_KEY_ATTRIBUTE, key);

  if (premiumFreeActiveRequest && premiumFreeActiveRequest.key !== key) {
    abortPremiumFreeRequest();
  }

  const cacheEntry = premiumFreeResultCache.get(key);
  const cachedResult = cacheEntry ? readPremiumFreeCacheEntry(cacheEntry) : null;
  if (!cachedResult) {
    if (cacheEntry) {
      premiumFreeResultCache.delete(key);
    }

    renderPremiumFreeState(container, "resolving", {
      title: "Premium Free",
      copy: "Запускаем parser-server, ищем подходящий источник и подготавливаем главу к чтению.",
    });

    if (!premiumFreeActiveRequest || premiumFreeActiveRequest.key !== key) {
      const controller = new AbortController();
      premiumFreeActiveRequest = { key, controller };
      void requestPremiumFreeChapter(reference, key, controller);
    }

    return;
  }

  if (cachedResult.status === "failure") {
    renderPremiumFreeError(container, cachedResult, reference.titleName);
    if (cachedResult.reason === "resolver_unavailable") {
      appendPremiumFreeRetryButton(container, () => {
        premiumFreeResultCache.delete(key);
        renderPremiumFreeState(container, "resolving", {
          title: "Premium Free",
          copy: "Перезапускаем parser-server...",
        });
        const controller = new AbortController();
        premiumFreeActiveRequest = { key, controller };
        void requestPremiumFreeChapter(reference, key, controller);
      });
    }
    return;
  }

  renderPremiumFreePages(container, cachedResult, key, reference);
};

const findCommentsVisibilityBlocks = (root: ParentNode = document): HTMLElement[] => {
  const blocks = new Set<HTMLElement>();

  collectCommentsSections(root).forEach((commentsSection) => {
    const block = resolveCommentsVisibilityBlock(commentsSection);
    if (block) {
      blocks.add(block);
    }
  });

  return Array.from(blocks).sort(sortNodesInDocumentOrder);
};

const collectCommentsSections = (root: ParentNode = document): HTMLElement[] => {
  const writeCommentButton = queryAllWithSelf<HTMLButtonElement>(root, "button").filter(
    (button) => normalizeText(button.textContent) === "оставить комментарий",
  );

  const commentsSections = new Set<HTMLElement>();

  queryAllWithSelf<HTMLElement>(root, "section").filter(
    (section) =>
      normalizeText(section.textContent).includes("самые интересные комментарии"),
  ).forEach((section) => {
    commentsSections.add(section);
  });

  writeCommentButton.forEach((button) => {
    const directSection = button.closest<HTMLElement>("section");
    if (directSection) {
      commentsSections.add(directSection);
      return;
    }

    const inferredContainer = findCommentsContainerByMarkers(button);
    if (inferredContainer) {
      commentsSections.add(inferredContainer);
    }
  });

  queryAllWithSelf<HTMLElement>(root, "h1, h2, h3, h4, p, div, span").filter(
    (node) =>
      normalizeText(node.textContent) === "самые интересные комментарии",
  ).forEach((headingMarker) => {
    const inferredContainer = findCommentsContainerByMarkers(headingMarker);
    if (inferredContainer) {
      commentsSections.add(inferredContainer);
    }
  });

  return Array.from(commentsSections).sort(sortNodesInDocumentOrder);
};

const resolveCommentsVisibilityBlock = (
  commentsSection: HTMLElement,
): HTMLElement | null => {
  const wrapperBlock = commentsSection.closest<HTMLElement>('div.z-\\[1000\\]');
  if (wrapperBlock && isSafeCommentsVisibilityWrapper(wrapperBlock)) {
    return wrapperBlock;
  }

  const explicitBlock = commentsSection.closest<HTMLElement>('div.md\\:mx-12');
  if (explicitBlock) {
    const parentWrapper = explicitBlock.closest<HTMLElement>('div.z-\\[1000\\]');
    if (parentWrapper && isSafeCommentsVisibilityWrapper(parentWrapper)) {
      return parentWrapper;
    }

    return isSafeCommentsVisibilityBlock(explicitBlock) ? explicitBlock : null;
  }

  return isSafeCommentsVisibilityBlock(commentsSection) ? commentsSection : null;
};

const findDynamicCommentsVisibilityBlocks = (root: ParentNode): HTMLElement[] => {
  const blocks = new Set<HTMLElement>();

  queryAllWithSelf<HTMLElement>(root, 'div.z-\\[1000\\], div.md\\:mx-12').forEach(
    (candidate) => {
      if (isSafeCommentsVisibilityWrapper(candidate)) {
        blocks.add(candidate);
        return;
      }

      if (!candidate.matches('div.md\\:mx-12') || !isSafeCommentsVisibilityBlock(candidate)) {
        return;
      }

      const parentWrapper = candidate.closest<HTMLElement>('div.z-\\[1000\\]');
      if (parentWrapper && isSafeCommentsVisibilityWrapper(parentWrapper)) {
        blocks.add(parentWrapper);
        return;
      }

      blocks.add(candidate);
    },
  );

  return Array.from(blocks).sort(sortNodesInDocumentOrder);
};

const findInterChapterAdBlocks = (root: ParentNode = document): HTMLElement[] => {
  const blocks = new Set<HTMLElement>();

  queryAllWithSelf<HTMLButtonElement>(root, "button")
    .filter((button) => normalizeText(button.textContent) === "отключить рекламу")
    .forEach((button) => {
      const block = resolveInterChapterAdBlock(button);
      if (block) {
        blocks.add(block);
      }
    });

  return Array.from(blocks).sort(sortNodesInDocumentOrder);
};

const resolveInterChapterAdBlock = (
  adButton: HTMLButtonElement,
): HTMLElement | null =>
  adButton.closest<HTMLElement>('div.z-\\[1000\\]') ??
  (adButton.parentElement instanceof HTMLElement ? adButton.parentElement : null);

const isSafeCommentsVisibilityBlock = (node: HTMLElement): boolean => {
  if (node.matches("main, body, html")) {
    return false;
  }

  const text = normalizeText(node.textContent);
  const hasHeading = text.includes("самые интересные комментарии");
  const hasComposer = text.includes("оставить комментарий");

  if (node.matches('div.md\\:mx-12')) {
    return hasHeading || hasComposer;
  }

  const hasCommentItems = text.includes("ответить") || text.includes("посмотреть");
  const mediaCount = node.querySelectorAll("img, picture").length;
  return hasHeading && hasComposer && hasCommentItems && mediaCount <= 12;
};

const isSafeCommentsVisibilityWrapper = (node: HTMLElement): boolean => {
  if (node.matches("main, body, html")) {
    return false;
  }

  if (!node.matches('div.z-\\[1000\\]')) {
    return false;
  }

  const text = normalizeText(node.textContent);
  const hasHeading = text.includes("самые интересные комментарии");
  const hasComposer = text.includes("оставить комментарий");
  return hasHeading || hasComposer;
};

const isSafeAdVisibilityBlock = (node: HTMLElement): boolean => {
  if (node.matches("main, body, html")) {
    return false;
  }

  if (!node.matches('div.z-\\[1000\\]')) {
    return false;
  }

  return Array.from(node.querySelectorAll("button")).some(
    (button) => normalizeText(button.textContent) === "отключить рекламу",
  );
};

const queryAllWithSelf = <T extends Element>(
  root: ParentNode,
  selector: string,
): T[] => {
  const matches = Array.from(root.querySelectorAll<T>(selector));
  if (root instanceof Element && root.matches(selector)) {
    matches.unshift(root as T);
  }

  return matches;
};

const findCommentsContainerByMarkers = (
  startNode: HTMLElement,
): HTMLElement | null => {
  let current: HTMLElement | null = startNode;

  while (current && current !== document.body) {
    const text = normalizeText(current.textContent);
    const containsCommentsHeading = text.includes("самые интересные комментарии");
    const containsComposer = text.includes("оставить комментарий");
    const containsCommentItems = text.includes("ответить") || text.includes("посмотреть");

    if (containsCommentsHeading && containsComposer && containsCommentItems) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
};

const sortNodesInDocumentOrder = (left: HTMLElement, right: HTMLElement): number => {
  if (left === right) {
    return 0;
  }

  const position = left.compareDocumentPosition(right);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return -1;
  }

  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return 1;
  }

  return 0;
};

const findToolbarButtonByIcon = (
  iconName: string,
  root: ParentNode | null = document,
): HTMLButtonElement | null => {
  if (!root) {
    return null;
  }

  return (
    root
      .querySelector<SVGElement>(`svg[data-sentry-element="${iconName}"]`)
      ?.closest<HTMLButtonElement>("button") ?? null
  );
};

const findPageCounterButton = (
  railContainer: HTMLElement | null,
): HTMLButtonElement | null => {
  if (!railContainer) {
    return null;
  }

  return (
    Array.from(railContainer.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => /^\d+\/\d+$/.test(normalizeText(button.textContent)),
    ) ?? null
  );
};

const findAutoScrollButton = (
  railContainer: HTMLElement | null,
): HTMLButtonElement | null => {
  if (!railContainer) {
    return null;
  }

  return (
    railContainer.querySelector<HTMLButtonElement>(
      'button[data-sentry-component="AutoScroll"]',
    ) ??
    railContainer.querySelector<HTMLButtonElement>(
      'button[data-sentry-element="AutoScroll"]',
    ) ??
    findAutoScrollButtonByIcon(railContainer)
  );
};

const findAutoScrollButtonByIcon = (
  railContainer: HTMLElement,
): HTMLButtonElement | null => {
  const railStack = railContainer.firstElementChild;
  if (!(railStack instanceof HTMLElement)) {
    return null;
  }

  return (
    Array.from(railStack.children).find(
      (child): child is HTMLButtonElement =>
        child instanceof HTMLButtonElement &&
        child.tagName === "BUTTON" &&
        !child.matches('[data-sentry-element="PageIndicatorTrigger"]') &&
        !child.querySelector('svg[data-sentry-element]') &&
        !child.hasAttribute(CONTROL_ATTRIBUTE),
    ) ?? null
  );
};

const syncMainFullscreenButton = (readerDom: ReaderDom): void => {
  const { settingsButton, settingsGroup } = readerDom;
  if (!settingsButton || !settingsGroup) {
    return;
  }

  const existingButton = document.querySelector<HTMLButtonElement>(
    `[${CONTROL_ATTRIBUTE}="fullscreen-main"]`,
  );

  if (existingButton) {
    if (existingButton.nextElementSibling !== settingsGroup) {
      settingsGroup.before(existingButton);
    }

    existingButton.onclick = () => {
      void toggleFullscreen();
    };
    return;
  }

  const fullscreenButton = createFullscreenButton(settingsButton, "fullscreen-main");
  settingsGroup.before(fullscreenButton);
};

const syncSettingsPanel = (
  readerDom: ReaderDom,
  settings: ReaderEnhancerSettings,
  commitSettings: CommitSettings,
): void => {
  const { settingsPanel } = readerDom;
  if (!settingsPanel) {
    return;
  }

  const templateRow = settingsPanel.querySelector<HTMLElement>(
    'div.flex.items-center.gap-2 button[role="switch"]',
  )?.closest<HTMLElement>("div.flex.items-center.gap-2");
  const nativeToggleList = templateRow?.parentElement as HTMLElement | null;

  if (!templateRow || !nativeToggleList) {
    return;
  }

  const { section, rows, toggleButton } = ensureSettingsSection(
    settingsPanel,
    nativeToggleList,
    settings,
  );

  if (!rows) {
    return;
  }

  syncSettingsPanelLayout(section);
  syncSettingsSectionState({ section, rows, toggleButton }, settings, commitSettings);
  removeLegacyTopLevelRows(rows);
  syncToggleRows(rows, primaryToggleDefinitions, templateRow, settings, commitSettings);

  const rightRailRow = rows.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="setting-row-hide-right-rail"]`,
  );
  const settingsMenuRow = rows.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="setting-row-enhance-settings-menu"]`,
  );
  const actionButtonTemplate = readerDom.settingsButton
    ? resolveRowActionButtonTemplate(settingsPanel, readerDom.settingsButton)
    : null;

  if (rightRailRow && readerDom.settingsButton && actionButtonTemplate) {
    syncRightRailSubsection({
      rows,
      anchorRow: rightRailRow,
      templateRow,
      settings,
      commitSettings,
      actionButtonTemplate,
      settingsButtonTemplate: readerDom.settingsButton,
    });
  }

  if (settingsMenuRow && readerDom.settingsButton && actionButtonTemplate) {
    syncSettingsMenuSubsection({
      rows,
      anchorRow: settingsMenuRow,
      templateRow,
      settings,
      commitSettings,
      actionButtonTemplate,
      settingsButtonTemplate: readerDom.settingsButton,
    });
  }

  syncNativeSettingsMenuItems(settingsPanel, settings);
};

const ensureSettingsSection = (
  settingsPanel: HTMLElement,
  nativeToggleList: HTMLElement,
  settings: ReaderEnhancerSettings,
): SettingsSectionElements => {
  const existingSection = settingsPanel.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="settings-section"]`,
  );

  if (existingSection) {
    return {
      section: existingSection,
      toggleButton: existingSection.querySelector<HTMLButtonElement>(
        `[${CONTROL_ATTRIBUTE}="settings-section-toggle"]`,
      ),
      rows: existingSection.querySelector<HTMLElement>(`[${CONTROL_ATTRIBUTE}="settings-rows"]`),
    };
  }

  const extensionSection = document.createElement("div");
  extensionSection.className = "flex flex-col gap-4";
  extensionSection.setAttribute(CONTROL_ATTRIBUTE, "settings-section");

  const title = document.createElement("button");
  title.type = "button";
  title.className =
    "cs-text text-md leading-md flex w-full cursor-pointer items-center justify-between gap-3 text-left font-semibold text-foreground";
  title.setAttribute(CONTROL_ATTRIBUTE, "settings-section-toggle");

  const titleLabel = document.createElement("span");
  titleLabel.textContent = "Дополнительные настройки";

  const titleIndicator = document.createElement("span");
  titleIndicator.setAttribute(CONTROL_ATTRIBUTE, "settings-section-toggle-indicator");
  titleIndicator.className = "shrink-0 text-xs text-muted-foreground";

  title.append(titleLabel, titleIndicator);

  const rows = document.createElement("div");
  rows.className = "flex flex-col gap-4";
  rows.setAttribute(CONTROL_ATTRIBUTE, "settings-rows");

  const expanded = settings.isAdditionalSettingsExpanded;
  markHidden(rows, !settings.isAdditionalSettingsExpanded);
  title.setAttribute("aria-expanded", String(expanded));
  title.title = expanded
    ? "Свернуть дополнительные настройки"
    : "Развернуть дополнительные настройки";
  titleIndicator.textContent = expanded ? "Скрыть" : "Показать";
  extensionSection.setAttribute("data-rre-expanded", String(expanded));

  extensionSection.append(title, rows);
  nativeToggleList.insertAdjacentElement("afterend", extensionSection);

  return {
    section: extensionSection,
    toggleButton: title,
    rows,
  };
};

const syncSettingsSectionState = (
  elements: SettingsSectionElements,
  settings: ReaderEnhancerSettings,
  commitSettings: CommitSettings,
): void => {
  const { section, toggleButton, rows } = elements;
  if (!toggleButton || !rows) {
    return;
  }

  const indicator = toggleButton.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="settings-section-toggle-indicator"]`,
  );
  const expanded = settings.isAdditionalSettingsExpanded;

  syncSettingsRowsCollapse(rows, expanded);
  toggleButton.setAttribute("aria-expanded", String(expanded));
  toggleButton.title = expanded
    ? "Свернуть дополнительные настройки"
    : "Развернуть дополнительные настройки";
  section.setAttribute("data-rre-expanded", String(expanded));

  if (indicator) {
    indicator.textContent = expanded ? "Скрыть" : "Показать";
  }

  toggleButton.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    commitSettings((currentSettings) => ({
      ...cloneSettings(currentSettings),
      isAdditionalSettingsExpanded: !currentSettings.isAdditionalSettingsExpanded,
    }));
  };
};

const removeLegacyTopLevelRows = (rows: HTMLElement): void => {
  const allowedControls = new Set<string>([
    ...primaryToggleDefinitions.map((definition) => `setting-row-${definition.id}`),
    "right-rail-subsection",
    "settings-menu-subsection",
  ]);

  Array.from(rows.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) {
      return;
    }

    const controlName = child.getAttribute(CONTROL_ATTRIBUTE);
    if (!controlName) {
      return;
    }

    if (!allowedControls.has(controlName)) {
      child.remove();
    }
  });
};

const syncToggleRows = (
  container: HTMLElement,
  definitions: ToggleDefinition[],
  templateRow: HTMLElement,
  settings: ReaderEnhancerSettings,
  commitSettings: CommitSettings,
): void => {
  definitions.forEach((definition) => {
    const rowControlName = `setting-row-${definition.id}`;
    const existingRow = container.querySelector<HTMLElement>(
      `[${CONTROL_ATTRIBUTE}="${rowControlName}"]`,
    );

    if (existingRow) {
      syncSettingsToggleRow({
        row: existingRow,
        definition,
        settings,
        commitSettings,
      });
      return;
    }

    container.append(
      createSettingsToggleRow({
        templateRow,
        definition,
        settings,
        commitSettings,
      }),
    );
  });
};

const syncRightRailSubsection = ({
  rows,
  anchorRow,
  templateRow,
  settings,
  commitSettings,
  actionButtonTemplate,
  settingsButtonTemplate,
}: {
  rows: HTMLElement;
  anchorRow: HTMLElement;
  templateRow: HTMLElement;
  settings: ReaderEnhancerSettings;
  commitSettings: CommitSettings;
  actionButtonTemplate: HTMLButtonElement;
  settingsButtonTemplate: HTMLButtonElement;
}): void => {
  const subsection = ensureRightRailSubsection(rows, anchorRow);
  const subsectionRows = subsection.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="right-rail-subsection-rows"]`,
  );

  if (!subsectionRows) {
    return;
  }

  syncToggleRows(
    subsectionRows,
    rightRailToggleDefinitions,
    templateRow,
    settings,
    commitSettings,
  );

  const gearButton = ensureRightRailOptionsButton(
    anchorRow,
    actionButtonTemplate,
    settingsButtonTemplate,
  );
  const expanded = getRightRailOptionsExpanded(settings);
  syncRightRailSubsectionState(subsection, gearButton, expanded);
};

const syncSettingsMenuSubsection = ({
  rows,
  anchorRow,
  templateRow,
  settings,
  commitSettings,
  actionButtonTemplate,
  settingsButtonTemplate,
}: {
  rows: HTMLElement;
  anchorRow: HTMLElement;
  templateRow: HTMLElement;
  settings: ReaderEnhancerSettings;
  commitSettings: CommitSettings;
  actionButtonTemplate: HTMLButtonElement;
  settingsButtonTemplate: HTMLButtonElement;
}): void => {
  const subsection = ensureSettingsMenuSubsection(rows, anchorRow);
  const subsectionRows = subsection.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="settings-menu-subsection-rows"]`,
  );

  if (!subsectionRows) {
    return;
  }

  syncToggleRows(
    subsectionRows,
    settingsMenuToggleDefinitions,
    templateRow,
    settings,
    commitSettings,
  );

  const gearButton = ensureSettingsMenuOptionsButton(
    anchorRow,
    actionButtonTemplate,
    settingsButtonTemplate,
  );
  const expanded = getSettingsMenuOptionsExpanded(settings);
  syncSettingsMenuSubsectionState(subsection, gearButton, expanded);
};

const ensureRightRailSubsection = (
  rows: HTMLElement,
  anchorRow: HTMLElement,
): HTMLElement => {
  const existingSubsection = rows.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="right-rail-subsection"]`,
  );

  if (existingSubsection) {
    if (existingSubsection.previousElementSibling !== anchorRow) {
      anchorRow.insertAdjacentElement("afterend", existingSubsection);
    }

    return existingSubsection;
  }

  const subsection = document.createElement("div");
  subsection.className = "ml-4 flex flex-col gap-4 border-l border-border/40 pl-4";
  subsection.setAttribute(CONTROL_ATTRIBUTE, "right-rail-subsection");

  const subsectionRows = document.createElement("div");
  subsectionRows.className = "flex flex-col gap-4";
  subsectionRows.setAttribute(CONTROL_ATTRIBUTE, "right-rail-subsection-rows");

  subsection.append(subsectionRows);
  anchorRow.insertAdjacentElement("afterend", subsection);

  return subsection;
};

const ensureSettingsMenuSubsection = (
  rows: HTMLElement,
  anchorRow: HTMLElement,
): HTMLElement => {
  const existingSubsection = rows.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="settings-menu-subsection"]`,
  );

  if (existingSubsection) {
    if (existingSubsection.previousElementSibling !== anchorRow) {
      anchorRow.insertAdjacentElement("afterend", existingSubsection);
    }

    return existingSubsection;
  }

  const subsection = document.createElement("div");
  subsection.className = "ml-4 flex flex-col gap-4 border-l border-border/40 pl-4";
  subsection.setAttribute(CONTROL_ATTRIBUTE, "settings-menu-subsection");

  const subsectionRows = document.createElement("div");
  subsectionRows.className = "flex flex-col gap-4";
  subsectionRows.setAttribute(CONTROL_ATTRIBUTE, "settings-menu-subsection-rows");

  subsection.append(subsectionRows);
  anchorRow.insertAdjacentElement("afterend", subsection);

  return subsection;
};

const resolveRowActionButtonTemplate = (
  settingsPanel: HTMLElement,
  fallbackButton: HTMLButtonElement,
): HTMLButtonElement =>
  settingsPanel.querySelector<HTMLButtonElement>(
    "div.flex.items-center.justify-between button",
  ) ?? fallbackButton;

const ensureRightRailOptionsButton = (
  row: HTMLElement,
  actionButtonTemplate: HTMLButtonElement,
  settingsButtonTemplate: HTMLButtonElement,
): HTMLButtonElement => {
  const { switchButton, label } = getToggleRowControls(row);
  if (!switchButton || !label) {
    return cloneToolbarButton(actionButtonTemplate, "right-rail-options-toggle-fallback", {
      transparent: false,
    });
  }

  const content = ensureToggleRowContent(row, switchButton, label, "hide-right-rail");
  const existingButton = content.querySelector<HTMLButtonElement>(
    `[${CONTROL_ATTRIBUTE}="right-rail-options-toggle"]`,
  );

  if (existingButton) {
    wireRightRailOptionsButton(existingButton);
    return existingButton;
  }

  const button = cloneToolbarButton(actionButtonTemplate, "right-rail-options-toggle", {
    transparent: false,
  });
  button.setAttribute(IGNORE_TOGGLE_ATTRIBUTE, "true");
  button.setAttribute("aria-label", "Настройки скрытия боковой панели");
  button.replaceChildren(createSettingsIcon(settingsButtonTemplate));
  button.classList.add("shrink-0");

  content.append(button);
  wireRightRailOptionsButton(button);

  return button;
};

const ensureSettingsMenuOptionsButton = (
  row: HTMLElement,
  actionButtonTemplate: HTMLButtonElement,
  settingsButtonTemplate: HTMLButtonElement,
): HTMLButtonElement => {
  const { switchButton, label } = getToggleRowControls(row);
  if (!switchButton || !label) {
    return cloneToolbarButton(actionButtonTemplate, "settings-menu-options-toggle-fallback", {
      transparent: false,
    });
  }

  const content = ensureToggleRowContent(row, switchButton, label, "enhance-settings-menu");
  const existingButton = content.querySelector<HTMLButtonElement>(
    `[${CONTROL_ATTRIBUTE}="settings-menu-options-toggle"]`,
  );

  if (existingButton) {
    wireSettingsMenuOptionsButton(existingButton);
    return existingButton;
  }

  const button = cloneToolbarButton(actionButtonTemplate, "settings-menu-options-toggle", {
    transparent: false,
  });
  button.setAttribute(IGNORE_TOGGLE_ATTRIBUTE, "true");
  button.setAttribute("aria-label", "Настройки улучшения меню настроек");
  button.replaceChildren(createSettingsIcon(settingsButtonTemplate));
  button.classList.add("shrink-0");

  content.append(button);
  wireSettingsMenuOptionsButton(button);

  return button;
};

const wireRightRailOptionsButton = (button: HTMLButtonElement): void => {
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    rightRailOptionsExpansionTouched = true;
    rightRailOptionsExpanded = !rightRailOptionsExpanded;

    const subsection = document.querySelector<HTMLElement>(
      `[${CONTROL_ATTRIBUTE}="right-rail-subsection"]`,
    );
    syncRightRailSubsectionState(subsection, button, rightRailOptionsExpanded);
  };
};

const wireSettingsMenuOptionsButton = (button: HTMLButtonElement): void => {
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    settingsMenuOptionsExpansionTouched = true;
    settingsMenuOptionsExpanded = !settingsMenuOptionsExpanded;

    const subsection = document.querySelector<HTMLElement>(
      `[${CONTROL_ATTRIBUTE}="settings-menu-subsection"]`,
    );
    syncSettingsMenuSubsectionState(subsection, button, settingsMenuOptionsExpanded);
  };
};

const syncRightRailSubsectionState = (
  subsection: HTMLElement | null,
  button: HTMLButtonElement,
  expanded: boolean,
): void => {
  markHidden(subsection, !expanded);
  button.setAttribute("aria-expanded", String(expanded));
  button.title = expanded
    ? "Скрыть поднастройки боковой панели"
    : "Показать поднастройки боковой панели";

  if (expanded) {
    button.classList.add(...ACTIVE_FULLSCREEN_CLASSES);
    button.classList.remove(...INACTIVE_FULLSCREEN_CLASSES);
    return;
  }

  button.classList.remove(...ACTIVE_FULLSCREEN_CLASSES);
  button.classList.add(...INACTIVE_FULLSCREEN_CLASSES);
};

const syncSettingsMenuSubsectionState = (
  subsection: HTMLElement | null,
  button: HTMLButtonElement,
  expanded: boolean,
): void => {
  markHidden(subsection, !expanded);
  button.setAttribute("aria-expanded", String(expanded));
  button.title = expanded
    ? "Скрыть поднастройки улучшения меню настроек"
    : "Показать поднастройки улучшения меню настроек";

  if (expanded) {
    button.classList.add(...ACTIVE_FULLSCREEN_CLASSES);
    button.classList.remove(...INACTIVE_FULLSCREEN_CLASSES);
    return;
  }

  button.classList.remove(...ACTIVE_FULLSCREEN_CLASSES);
  button.classList.add(...INACTIVE_FULLSCREEN_CLASSES);
};

const getRightRailOptionsExpanded = (settings: ReaderEnhancerSettings): boolean => {
  if (!rightRailOptionsExpansionTouched) {
    rightRailOptionsExpanded = false;
  }

  return rightRailOptionsExpanded;
};

const getSettingsMenuOptionsExpanded = (
  settings: ReaderEnhancerSettings,
): boolean => {
  if (!settingsMenuOptionsExpansionTouched) {
    settingsMenuOptionsExpanded = false;
  }

  return settingsMenuOptionsExpanded;
};

const resetTransientSubsectionState = (): void => {
  rightRailOptionsExpanded = false;
  rightRailOptionsExpansionTouched = false;
  settingsMenuOptionsExpanded = false;
  settingsMenuOptionsExpansionTouched = false;
};

const syncNativeSettingsMenuItems = (
  settingsPanel: HTMLElement,
  settings: ReaderEnhancerSettings,
): void => {
  SETTINGS_MENU_ITEM_KEYS.forEach((key) => {
    resolveNativeSettingsMenuItemTargets(settingsPanel, key).forEach((node) => {
      syncMotionVisibility(node, {
        hidden: settings.enhanceSettingsMenu && settings.hideSettingsMenuItems[key],
        mode: "dissolve",
      });
    });
  });
};

const resolveNativeSettingsMenuItemTargets = (
  settingsPanel: HTMLElement,
  key: SettingsMenuItemKey,
): HTMLElement[] => {
  const item = SETTINGS_MENU_ITEMS[key];

  if (item.kind === "button") {
    return compactElements([findNativeSettingsMenuButton(settingsPanel, key)]);
  }

  if (item.kind === "switchRow") {
    return compactElements([findNativeSettingsMenuSwitchRow(settingsPanel, key)]);
  }

  return findNativeSettingsMenuSection(settingsPanel, key);
};

const findNativeSettingsMenuButton = (
  settingsPanel: HTMLElement,
  key: SettingsMenuItemKey,
): HTMLButtonElement | null =>
  Array.from(settingsPanel.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    if (button.closest(`[${CONTROL_ATTRIBUTE}]`)) {
      return false;
    }

    return matchesSettingsMenuItemText(key, button.textContent);
  }) ?? null;

const findNativeSettingsMenuSwitchRow = (
  settingsPanel: HTMLElement,
  key: SettingsMenuItemKey,
): HTMLElement | null => {
  const labelNode = findNativeSettingsMenuTextNode(settingsPanel, key);
  if (!labelNode) {
    return null;
  }

  return (
    labelNode.closest<HTMLElement>("div.flex.items-center.gap-2") ??
    labelNode.parentElement
  );
};

const findNativeSettingsMenuSection = (
  settingsPanel: HTMLElement,
  key: SettingsMenuItemKey,
): HTMLElement[] => {
  const labelNode = findNativeSettingsMenuTextNode(settingsPanel, key);
  if (!labelNode) {
    return [];
  }

  const canonicalLabel = normalizeText(SETTINGS_MENU_ITEMS[key].label);
  const sectionContainer = findClosestAncestor(labelNode, (node) => {
    const text = normalizeText(node.textContent);
    return (
      node !== settingsPanel &&
      text.includes(canonicalLabel) &&
      text.includes("постраничная") &&
      text.includes("лента") &&
      node.querySelectorAll('[role="radiogroup"]').length === 1
    );
  });

  if (sectionContainer) {
    return [sectionContainer];
  }

  const radioGroup = findFollowingElement(
    settingsPanel,
    labelNode,
    (node) =>
      node.getAttribute("role") === "radiogroup" &&
      normalizeText(node.textContent).includes("постраничная") &&
      normalizeText(node.textContent).includes("лента"),
  );

  return compactElements([labelNode, radioGroup]);
};

const findNativeSettingsMenuTextNode = (
  settingsPanel: HTMLElement,
  key: SettingsMenuItemKey,
): HTMLElement | null =>
  queryAllWithSelf<HTMLElement>(settingsPanel, "label, p, span, div").find((node) => {
    if (node.closest(`[${CONTROL_ATTRIBUTE}]`)) {
      return false;
    }

    return matchesSettingsMenuItemText(key, node.textContent);
  }) ?? null;

const findClosestAncestor = (
  startNode: HTMLElement,
  predicate: (node: HTMLElement) => boolean,
): HTMLElement | null => {
  let current = startNode.parentElement;

  while (current) {
    if (current.closest(`[${CONTROL_ATTRIBUTE}]`)) {
      current = current.parentElement;
      continue;
    }

    if (predicate(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
};

const findFollowingElement = (
  root: ParentNode,
  startNode: HTMLElement,
  predicate: (node: HTMLElement) => boolean,
): HTMLElement | null =>
  queryAllWithSelf<HTMLElement>(root, "*").find((node) => {
    if (node === startNode || node.closest(`[${CONTROL_ATTRIBUTE}]`)) {
      return false;
    }

    const position = startNode.compareDocumentPosition(node);
    return Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING) && predicate(node);
  }) ?? null;

const compactElements = <T extends HTMLElement>(elements: Array<T | null>): T[] =>
  elements.filter((element): element is T => element instanceof HTMLElement);

const syncSettingsPanelLayout = (extensionSection: HTMLElement): void => {
  const layoutContainer = extensionSection.parentElement;
  if (!(layoutContainer instanceof HTMLElement)) {
    return;
  }

  const contentSlide =
    layoutContainer.closest<HTMLElement>('div[class*="transitions_slide__"]') ?? null;
  const transitionContainer =
    contentSlide?.parentElement instanceof HTMLElement ? contentSlide.parentElement : null;

  applySettingsLayoutStyles(layoutContainer, {
    height: "auto",
    minHeight: "100%",
  });

  applySettingsLayoutStyles(contentSlide, {
    height: "auto",
    minHeight: "100%",
  });

  applySettingsLayoutStyles(transitionContainer, {
    height: "auto",
    overflow: "visible",
  });
};

const applySettingsLayoutStyles = (
  node: HTMLElement | null,
  styles: SettingsLayoutStyles,
): void => {
  if (!node) {
    return;
  }

  node.setAttribute(SETTINGS_STYLE_ATTRIBUTE, "true");
  if (styles.height) {
    node.style.height = styles.height;
  }
  if (styles.minHeight) {
    node.style.minHeight = styles.minHeight;
  }
  if (styles.overflow) {
    node.style.overflow = styles.overflow;
  }
};

const createSettingsToggleRow = ({
  templateRow,
  definition,
  settings,
  commitSettings,
}: {
  templateRow: HTMLElement;
  definition: ToggleDefinition;
  settings: ReaderEnhancerSettings;
  commitSettings: CommitSettings;
}): HTMLElement => {
  const row = templateRow.cloneNode(true) as HTMLElement;
  row.setAttribute(CONTROL_ATTRIBUTE, `setting-row-${definition.id}`);

  const switchButton = row.querySelector<HTMLButtonElement>('button[role="switch"]');
  const label = row.querySelector<HTMLLabelElement>("label");

  if (!switchButton || !label) {
    return row;
  }

  syncSettingsToggleRow({
    row,
    definition,
    settings,
    commitSettings,
  });

  return row;
};

const syncSettingsToggleRow = ({
  row,
  definition,
  settings,
  commitSettings,
}: ToggleRowSyncOptions): void => {
  const { switchButton, label } = getToggleRowControls(row);

  if (!switchButton || !label) {
    return;
  }

  const switchId = `rre-switch-${definition.id}`;
  switchButton.id = switchId;
  switchButton.type = "button";
  switchButton.removeAttribute("aria-describedby");
  switchButton.removeAttribute("aria-invalid");
  switchButton.removeAttribute("name");
  label.htmlFor = switchId;
  label.textContent = definition.label;
  label.title = definition.label;
  row.style.cursor = "pointer";

  setSwitchState(switchButton, definition.value(settings));

  const toggleSetting = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    commitSettings((currentSettings) => {
      const nextSettings = cloneSettings(currentSettings);
      definition.toggle(nextSettings);
      return nextSettings;
    });
  };

  switchButton.onclick = (event) => {
    toggleSetting(event);
  };

  label.onclick = (event) => {
    toggleSetting(event);
  };

  row.onclick = (event) => {
    if (!(event.target instanceof HTMLElement)) {
      return;
    }

    if (event.target.closest(`[${IGNORE_TOGGLE_ATTRIBUTE}="true"]`)) {
      return;
    }

    if (event.target.closest("a")) {
      return;
    }

    toggleSetting(event);
  };
};

const getToggleRowControls = (
  row: HTMLElement,
): {
  switchButton: HTMLButtonElement | null;
  label: HTMLLabelElement | null;
} => ({
  switchButton: row.querySelector<HTMLButtonElement>('button[role="switch"]'),
  label: row.querySelector<HTMLLabelElement>("label"),
});

const ensureToggleRowContent = (
  row: HTMLElement,
  switchButton: HTMLButtonElement,
  label: HTMLLabelElement,
  rowId: string,
): HTMLElement => {
  const existingContent = row.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="setting-row-content-${rowId}"]`,
  );

  if (existingContent) {
    return existingContent;
  }

  const content = document.createElement("div");
  content.className = "flex min-w-0 flex-1 items-center justify-between gap-2";
  content.setAttribute(CONTROL_ATTRIBUTE, `setting-row-content-${rowId}`);
  label.classList.add("min-w-0", "grow");
  switchButton.insertAdjacentElement("afterend", content);
  content.append(label);

  return content;
};

const setSwitchState = (
  switchButton: HTMLButtonElement,
  isChecked: boolean,
): void => {
  const thumb = switchButton.querySelector<HTMLElement>("span");
  const state = isChecked ? "checked" : "unchecked";

  switchButton.setAttribute("aria-checked", String(isChecked));
  switchButton.setAttribute("data-state", state);
  switchButton.value = isChecked ? "on" : "off";

  if (thumb) {
    thumb.setAttribute("data-state", state);
  }
};

const applyVisibilitySettings = (
  readerDom: ReaderDom,
  settings: ReaderEnhancerSettings,
): void => {
  const applyRightRailPreset = settings.hideRightRail;
  const settingsMotionTarget = readerDom.settingsGroup ?? readerDom.settingsButton;
  const mainFullscreenButton = document.querySelector<HTMLButtonElement>(
    `[${CONTROL_ATTRIBUTE}="fullscreen-main"]`,
  );
  const hidePageCounter = applyRightRailPreset && settings.hidePageCounter;
  if (!hidePageCounter) {
    revealRightRailMotionContext(readerDom.pageCounterButton);
  }

  markHidden(readerDom.header, settings.hideHeader);
  markHidden(readerDom.railContainer, false);
  syncMotionVisibility(readerDom.pageCounterButton, {
    hidden: hidePageCounter,
    mode: "slide-right",
    onSettled: syncRightRailVisibilityState,
  });
  readerDom.commentsBlocks.forEach((block) => {
    markHidden(block, settings.hideCommentsSection);
  });
  readerDom.adBlocks.forEach((block) => {
    markHidden(block, settings.hideCommentsSection);
  });

  const buyChapterBanner = findBuyChapterBanner();
  syncPremiumFreeBanner(buyChapterBanner, settings.premiumFree);

  Object.entries(TOOLBAR_ICON_NAMES).forEach(([key]) => {
    const toolbarKey = key as ToolbarButtonKey;
    const hidden = applyRightRailPreset && settings.hideToolbarButtons[toolbarKey];
    if (!hidden) {
      revealRightRailMotionContext(readerDom.toolbarButtons[toolbarKey] ?? null);
    }

    syncMotionVisibility(readerDom.toolbarButtons[toolbarKey] ?? null, {
      hidden,
      mode: "slide-right",
      onSettled: syncRightRailVisibilityState,
    });
  });
  const hideFullscreenButton = applyRightRailPreset && settings.hideRailFullscreenButton;
  if (!hideFullscreenButton) {
    revealRightRailMotionContext(mainFullscreenButton);
  }
  syncMotionVisibility(mainFullscreenButton, {
    hidden: hideFullscreenButton,
    mode: "slide-right",
    onSettled: syncRightRailVisibilityState,
  });
  revealRightRailMotionContext(settingsMotionTarget);
  syncMotionVisibility(settingsMotionTarget, {
    hidden: false,
    mode: "slide-right",
    onSettled: syncRightRailVisibilityState,
  });

  if (readerDom.main) {
    readerDom.main.style.paddingTop = settings.hideHeader ? "0px" : "";
  }

  if (readerDom.railContainer) {
    readerDom.railContainer.setAttribute(RAIL_STYLE_ATTRIBUTE, "true");
    readerDom.railContainer.style.marginTop = settings.hideHeader ? "0px" : "";
    readerDom.railContainer.style.height = settings.hideHeader ? "100vh" : "";
  }

  if (readerDom.settingsPanel) {
    readerDom.settingsPanel.style.paddingTop = settings.hideHeader ? "0px" : "";
  }

  syncRightRailGroups(readerDom.railContainer);
  syncRailContainerState(readerDom.railContainer);
};

const markHidden = (node: HTMLElement | null, hidden: boolean): void => {
  if (!node) {
    return;
  }

  if (hidden) {
    node.setAttribute(HIDDEN_ATTRIBUTE, "true");
    return;
  }

  node.removeAttribute(HIDDEN_ATTRIBUTE);
};

const syncMotionVisibility = (
  node: HTMLElement | null,
  {
    hidden,
    mode,
    onSettled,
  }: {
    hidden: boolean;
    mode: MotionMode;
    onSettled?: () => void;
  },
): void => {
  if (!node) {
    return;
  }

  const initialized = node.getAttribute(MOTION_INITIALIZED_ATTRIBUTE) === "true";
  const targetHidden =
    node.getAttribute(MOTION_TARGET_HIDDEN_ATTRIBUTE) === "true" || isMarkedHidden(node);

  node.setAttribute(MOTION_ATTRIBUTE, mode);

  if (!initialized) {
    finalizeMotionVisibility(node, hidden, onSettled);
    node.setAttribute(MOTION_INITIALIZED_ATTRIBUTE, "true");
    return;
  }

  if (targetHidden === hidden) {
    return;
  }

  if (prefersReducedMotion()) {
    finalizeMotionVisibility(node, hidden, onSettled);
    return;
  }

  node.setAttribute(MOTION_TARGET_HIDDEN_ATTRIBUTE, String(hidden));

  if (hidden) {
    node.removeAttribute(HIDDEN_ATTRIBUTE);
    node.setAttribute(MOTION_STATE_ATTRIBUTE, "shown");
    forceReflow(node);
    node.setAttribute(MOTION_STATE_ATTRIBUTE, "exit");
    scheduleFinalize(motionFinalizeHandles, node, getMotionDuration(mode), () => {
      finalizeMotionVisibility(node, true, onSettled);
    });
    return;
  }

  node.setAttribute(MOTION_STATE_ATTRIBUTE, "enter-from");
  node.removeAttribute(HIDDEN_ATTRIBUTE);
  forceReflow(node);
  node.setAttribute(MOTION_STATE_ATTRIBUTE, "enter");
  scheduleFinalize(motionFinalizeHandles, node, getMotionDuration(mode), () => {
    finalizeMotionVisibility(node, false, onSettled);
  });
};

const finalizeMotionVisibility = (
  node: HTMLElement,
  hidden: boolean,
  onSettled?: () => void,
): void => {
  clearFinalize(motionFinalizeHandles, node);
  node.setAttribute(MOTION_INITIALIZED_ATTRIBUTE, "true");
  node.setAttribute(MOTION_TARGET_HIDDEN_ATTRIBUTE, String(hidden));
  node.setAttribute(MOTION_STATE_ATTRIBUTE, hidden ? "hidden" : "shown");
  markHidden(node, hidden);
  onSettled?.();
};

const syncSettingsRowsCollapse = (rows: HTMLElement, expanded: boolean): void => {
  const initialized = rows.getAttribute(SECTION_COLLAPSE_INITIALIZED_ATTRIBUTE) === "true";
  const targetExpanded =
    rows.getAttribute(SECTION_COLLAPSE_TARGET_ATTRIBUTE) !== "false" && !isMarkedHidden(rows);

  if (!initialized) {
    finalizeSettingsRowsCollapse(rows, expanded);
    rows.setAttribute(SECTION_COLLAPSE_INITIALIZED_ATTRIBUTE, "true");
    return;
  }

  if (targetExpanded === expanded) {
    return;
  }

  if (prefersReducedMotion()) {
    finalizeSettingsRowsCollapse(rows, expanded);
    return;
  }

  clearFinalize(collapseFinalizeHandles, rows);
  rows.setAttribute(SECTION_COLLAPSE_TARGET_ATTRIBUTE, String(expanded));
  rows.style.overflow = "hidden";

  if (expanded) {
    rows.setAttribute(SECTION_COLLAPSE_ATTRIBUTE, "enter-from");
    rows.style.maxHeight = "0px";
    rows.removeAttribute(HIDDEN_ATTRIBUTE);
    forceReflow(rows);
    rows.style.maxHeight = `${rows.scrollHeight}px`;
    rows.setAttribute(SECTION_COLLAPSE_ATTRIBUTE, "enter");
    scheduleFinalize(collapseFinalizeHandles, rows, COLLAPSE_DURATION_MS, () => {
      finalizeSettingsRowsCollapse(rows, true);
    });
    return;
  }

  rows.removeAttribute(HIDDEN_ATTRIBUTE);
  rows.style.maxHeight = `${rows.scrollHeight}px`;
  rows.setAttribute(SECTION_COLLAPSE_ATTRIBUTE, "shown");
  forceReflow(rows);
  rows.style.maxHeight = "0px";
  rows.setAttribute(SECTION_COLLAPSE_ATTRIBUTE, "exit");
  scheduleFinalize(collapseFinalizeHandles, rows, COLLAPSE_DURATION_MS, () => {
    finalizeSettingsRowsCollapse(rows, false);
  });
};

const finalizeSettingsRowsCollapse = (rows: HTMLElement, expanded: boolean): void => {
  clearFinalize(collapseFinalizeHandles, rows);
  rows.setAttribute(SECTION_COLLAPSE_INITIALIZED_ATTRIBUTE, "true");
  rows.setAttribute(SECTION_COLLAPSE_TARGET_ATTRIBUTE, String(expanded));
  rows.setAttribute(SECTION_COLLAPSE_ATTRIBUTE, expanded ? "shown" : "hidden");
  markHidden(rows, !expanded);
  rows.style.maxHeight = expanded ? "" : "0px";
  rows.style.overflow = expanded ? "" : "hidden";
};

const scheduleFinalize = (
  store: Map<HTMLElement, number>,
  node: HTMLElement,
  delay: number,
  callback: () => void,
): void => {
  clearFinalize(store, node);

  const handle = window.setTimeout(() => {
    if (store.get(node) !== handle) {
      return;
    }

    store.delete(node);
    callback();
  }, delay);

  store.set(node, handle);
};

const clearFinalize = (store: Map<HTMLElement, number>, node: HTMLElement): void => {
  const handle = store.get(node);
  if (handle === undefined) {
    return;
  }

  window.clearTimeout(handle);
  store.delete(node);
};

const clearFinalizeHandles = (store: Map<HTMLElement, number>): void => {
  store.forEach((handle) => {
    window.clearTimeout(handle);
  });
  store.clear();
};

const getMotionDuration = (mode: MotionMode): number =>
  mode === "dissolve" ? DISSOLVE_DURATION_MS : SLIDE_RIGHT_DURATION_MS;

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const forceReflow = (node: HTMLElement): void => {
  node.getBoundingClientRect();
};

const syncRightRailVisibilityState = (): void => {
  const railContainer = findRailContainer();
  syncRightRailGroups(railContainer);
  syncRailContainerState(railContainer);
};

const revealRightRailMotionContext = (node: HTMLElement | null): void => {
  if (!node) {
    return;
  }

  const railContainer = findRailContainer();
  if (!railContainer) {
    return;
  }

  railContainer.removeAttribute(EMPTY_RAIL_ATTRIBUTE);
  railContainer.style.opacity = "";
  railContainer.style.pointerEvents = "";

  const group = findRightRailGroup(node, railContainer);
  if (group) {
    markHidden(group, false);
  }
};

const findRightRailGroup = (
  node: HTMLElement,
  railContainer: HTMLElement,
): HTMLElement | null => {
  const railStack = railContainer.firstElementChild;
  if (!(railStack instanceof HTMLElement)) {
    return null;
  }

  let current: HTMLElement | null = node;
  while (current && current.parentElement instanceof HTMLElement) {
    if (current.parentElement === railStack) {
      return current.tagName === "BUTTON" ? null : current;
    }

    current = current.parentElement;
  }

  return null;
};

const syncRightRailGroups = (railContainer: HTMLElement | null): void => {
  const railStack = railContainer?.firstElementChild;
  if (!(railStack instanceof HTMLElement)) {
    return;
  }

  Array.from(railStack.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) {
      return;
    }

    if (child.tagName === "BUTTON") {
      return;
    }

    const hasVisibleButton = Array.from(child.querySelectorAll<HTMLButtonElement>("button")).some(
      (button) => !isMarkedHidden(button),
    );

    if (!hasVisibleButton) {
      markHidden(child, true);
      return;
    }

    // Respect an explicit hide applied by finalize/syncMotion code paths:
    // when a wrapper is marked with MOTION_TARGET_HIDDEN_ATTRIBUTE="true"
    // (e.g. the minimized settings group), the inner button stays unmarked
    // but the wrapper must remain hidden. Without this guard, the heuristic
    // above would revive the wrapper and the original button would appear
    // alongside the peek button.
    if (child.getAttribute(MOTION_TARGET_HIDDEN_ATTRIBUTE) === "true") {
      return;
    }

    markHidden(child, false);
  });
};

const syncRailContainerState = (railContainer: HTMLElement | null): void => {
  if (!railContainer) {
    return;
  }

  const railStack = railContainer.firstElementChild;
  if (!(railStack instanceof HTMLElement)) {
    railContainer.removeAttribute(EMPTY_RAIL_ATTRIBUTE);
    railContainer.style.opacity = "";
    railContainer.style.pointerEvents = "";
    return;
  }

  const hasVisibleControls = Array.from(railStack.children).some((child) => {
    if (!(child instanceof HTMLElement)) {
      return false;
    }

    if (isMarkedHidden(child)) {
      return false;
    }

    if (child.tagName === "BUTTON") {
      return true;
    }

    return Array.from(child.querySelectorAll<HTMLButtonElement>("button")).some(
      (button) => !isMarkedHidden(button),
    );
  });

  railContainer.setAttribute(EMPTY_RAIL_ATTRIBUTE, String(!hasVisibleControls));
  railContainer.style.opacity = hasVisibleControls ? "" : "0";
  railContainer.style.pointerEvents = hasVisibleControls ? "" : "none";
};

const isMarkedHidden = (node: HTMLElement): boolean =>
  node.getAttribute(HIDDEN_ATTRIBUTE) === "true";

const dismissPopups = (settings: ReaderEnhancerSettings): void => {
  const popupSelector = POPUP_SELECTORS.join(", ");

  Array.from(new Set(document.querySelectorAll<HTMLElement>(popupSelector)))
    .filter((popup) => !popup.querySelector<HTMLElement>(popupSelector))
    .forEach((popup) => {
      if (popup.dataset.rreDismissed === "true") {
        return;
      }

      const popupType = classifyPopup(popup);
      if (!popupType) {
        return;
      }

      if (!shouldDismissPopup(popupType, settings)) {
        return;
      }

      const closeButton = findPopupCloseButton(popup);

      if (closeButton) {
        popup.dataset.rreDismissed = "true";
        closeButton.click();
        return;
      }

      if (popupType === "otherNonBlocking" && isSafeToForceHide(popup)) {
        popup.dataset.rreDismissed = "true";
        popup.setAttribute(HIDDEN_ATTRIBUTE, "true");
      }
    });
};

const classifyPopup = (popup: HTMLElement): PopupSettingKey | null => {
  const text = normalizeText(popup.textContent);
  if (!text) {
    return null;
  }

  if (containsAny(text, HINT_KEYWORDS)) {
    return "hints";
  }

  if (containsAny(text, GIFT_PROMO_KEYWORDS)) {
    return "giftsPromo";
  }

  if (popup.matches('[data-dismissible="true"]') && isSafeToForceHide(popup)) {
    return "otherNonBlocking";
  }

  return null;
};

const shouldDismissPopup = (
  popupType: PopupSettingKey,
  settings: ReaderEnhancerSettings,
): boolean => {
  if (popupType === "hints") {
    return settings.hidePopups.hints;
  }

  if (popupType === "giftsPromo") {
    return settings.hidePopups.giftsPromo;
  }

  return settings.hidePopups.otherNonBlocking;
};

const findPopupCloseButton = (popup: HTMLElement): HTMLButtonElement | null => {
  const directMatch = popup.querySelector<HTMLButtonElement>(
    POPUP_CLOSE_BUTTON_SELECTORS.join(", "),
  );

  if (directMatch && isVisibleButton(directMatch)) {
    return directMatch;
  }

  const popupRect = popup.getBoundingClientRect();
  if (popupRect.width <= 0 || popupRect.height <= 0) {
    return null;
  }

  const likelyCornerButtons = Array.from(popup.querySelectorAll<HTMLButtonElement>("button"))
    .filter((button) => isVisibleButton(button))
    .map((button) => ({
      button,
      rect: button.getBoundingClientRect(),
    }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0)
    .filter(({ button, rect }) =>
      isLikelyCornerCloseButton({
        text: button.textContent,
        ariaLabel: button.getAttribute("aria-label"),
        title: button.getAttribute("title"),
        hasSvg: Boolean(button.querySelector("svg")),
        relativeTop: Math.max(0, rect.top - popupRect.top) / popupRect.height,
        relativeRight: Math.max(0, popupRect.right - rect.right) / popupRect.width,
        widthRatio: rect.width / popupRect.width,
        heightRatio: rect.height / popupRect.height,
      }),
    )
    .sort((left, right) => {
      const topDelta = left.rect.top - right.rect.top;
      if (topDelta !== 0) {
        return topDelta;
      }

      return right.rect.right - left.rect.right;
    });

  return likelyCornerButtons[0]?.button ?? null;
};

const isVisibleButton = (button: HTMLButtonElement): boolean => {
  if (button.disabled || button.closest(`[${HIDDEN_ATTRIBUTE}="true"]`)) {
    return false;
  }

  const rect = button.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const isSafeToForceHide = (toast: HTMLElement): boolean => {
  const text = normalizeText(toast.textContent);
  const hasFormControls = toast.querySelector(
    'input, textarea, select, form, [role="dialog"], [role="alertdialog"]',
  );

  if (hasFormControls) {
    return false;
  }

  const blockedKeywords = [
    "жалоб",
    "редакт",
    "оплат",
    "логин",
    "войти",
    "подтверд",
    "удал",
    "поддерж",
  ];

  return !containsAny(text, blockedKeywords);
};

const syncFullscreenButtonStates = (): void => {
  const isActive = Boolean(document.fullscreenElement);

  document
    .querySelectorAll<HTMLButtonElement>(
      `[${CONTROL_ATTRIBUTE}="fullscreen-main"], [${CONTROL_ATTRIBUTE}="fullscreen-recovery"]`,
    )
    .forEach((button) => {
      button.setAttribute("aria-pressed", String(isActive));
      button.setAttribute("data-rre-active", String(isActive));
      button.title = isActive
        ? "Выйти из полноэкранного режима"
        : "Полноэкранный режим";

      if (isActive) {
        button.classList.remove("bg-transparent");
        button.classList.add(...ACTIVE_FULLSCREEN_CLASSES);
        return;
      }

      button.classList.remove(...ACTIVE_FULLSCREEN_CLASSES);
      button.classList.add(...INACTIVE_FULLSCREEN_CLASSES);
    });
};

const createFullscreenButton = (
  templateButton: HTMLButtonElement,
  controlName: "fullscreen-main" | "fullscreen-recovery",
): HTMLButtonElement => {
  const button = cloneToolbarButton(templateButton, controlName);
  button.setAttribute("aria-label", "Полноэкранный режим");
  button.title = "Полноэкранный режим";
  button.onclick = () => {
    void toggleFullscreen();
  };
  button.replaceChildren(createFullscreenIcon());
  syncFullscreenButtonStates();
  return button;
};

const cloneToolbarButton = (
  templateButton: HTMLButtonElement,
  controlName: string,
  options: {
    transparent?: boolean;
  } = {},
): HTMLButtonElement => {
  const button = templateButton.cloneNode(true) as HTMLButtonElement;
  button.setAttribute(CONTROL_ATTRIBUTE, controlName);
  button.removeAttribute("id");
  button.removeAttribute("aria-controls");
  button.removeAttribute("aria-expanded");
  button.removeAttribute("aria-haspopup");
  button.removeAttribute("data-state");
  button.removeAttribute(HIDDEN_ATTRIBUTE);
  button.removeAttribute(MOTION_ATTRIBUTE);
  button.removeAttribute(MOTION_STATE_ATTRIBUTE);
  button.removeAttribute(MOTION_INITIALIZED_ATTRIBUTE);
  button.removeAttribute(MOTION_TARGET_HIDDEN_ATTRIBUTE);
  button.removeAttribute("data-rre-active");
  button.type = "button";
  if (options.transparent ?? true) {
    button.classList.add("bg-transparent");
  } else {
    button.classList.remove("bg-transparent");
  }
  button.onclick = null;
  return button;
};

const createSettingsIcon = (templateButton: HTMLButtonElement): SVGSVGElement =>
  templateButton.querySelector<SVGSVGElement>("svg")?.cloneNode(true) as SVGSVGElement ??
  createFallbackSettingsIcon();

const createFullscreenIcon = (): SVGSVGElement => {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("xmlns", namespace);
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("display", "inline-block");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("fill", "none");

  [
    "M7 2.5H2.5V7",
    "M13 2.5H17.5V7",
    "M17.5 13V17.5H13",
    "M7 17.5H2.5V13",
  ].forEach((pathDefinition) => {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", pathDefinition);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
  });

  return svg;
};

const createFallbackSettingsIcon = (): SVGSVGElement => {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("xmlns", namespace);
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("display", "inline-block");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");

  [
    "M10 2.75V4.25",
    "M10 15.75V17.25",
    "M4.87 4.87L5.93 5.93",
    "M14.07 14.07L15.13 15.13",
    "M2.75 10H4.25",
    "M15.75 10H17.25",
    "M4.87 15.13L5.93 14.07",
    "M14.07 5.93L15.13 4.87",
  ].forEach((pathDefinition) => {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", pathDefinition);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
  });

  const circle = document.createElementNS(namespace, "circle");
  circle.setAttribute("cx", "10");
  circle.setAttribute("cy", "10");
  circle.setAttribute("r", "3");
  svg.append(circle);

  return svg;
};

const toggleFullscreen = async (): Promise<void> => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await document.documentElement.requestFullscreen();
  } catch {
    syncFullscreenButtonStates();
  }
};

const containsAny = (text: string, keywords: string[]): boolean =>
  keywords.some((keyword) => text.includes(keyword));

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const abortPremiumFreeRequest = (): void => {
  premiumFreeActiveRequest?.controller.abort();
  premiumFreeActiveRequest = null;
  premiumFreeNextRequest?.controller.abort();
  premiumFreeNextRequest = null;
};

const createPremiumFreeKey = (reference: RemangaChapterReference): string =>
  [reference.titleDir, reference.tome ?? "untomed", reference.chapter].join(":");

const formatPremiumFreeChapterLabel = (
  tome: number | undefined,
  chapter: string,
): string => (typeof tome === "number" ? `${tome} - ${chapter}` : chapter);

const findPremiumFreeChapterLabelControl = (): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>("button, a"))
    .find((node) => /^\d+\s*-\s*[\d.]+$/.test(node.textContent?.trim() ?? "")) ?? null;

const findPremiumFreeNextChapterHref = (): string | null => {
  const chapterLabelControl = findPremiumFreeChapterLabelControl();
  const navigationRow = chapterLabelControl?.parentElement;
  if (!navigationRow) {
    return null;
  }

  const chapterLinks = Array.from(navigationRow.querySelectorAll<HTMLAnchorElement>('a[href*="/manga/"]'))
    .filter((link) => !link.href.includes("/main"));

  return chapterLinks.at(-1)?.href ?? null;
};

const hasNativePremiumFreeReaderPages = (): boolean =>
  Array.from(document.querySelectorAll<HTMLElement>(".reader-container-width")).some(
    (node) =>
      !node.closest(`[${CONTROL_ATTRIBUTE}]`) &&
      !node.closest('[data-sentry-component="BuyChapterActions"]'),
  );

const collectPremiumFreeReference = (): RemangaChapterReference | null =>
  extractRemangaChapterReference({
    href: window.location.href,
    canonicalHref:
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
    documentTitle: document.title,
    descriptionContent:
      document
        .querySelector<HTMLMetaElement>('meta[name="description"]')
        ?.getAttribute("content") ?? null,
    headerTitle:
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/main"]'))
        .map((node) => node.textContent?.trim() ?? "")
        .find(Boolean) ?? null,
    headerChapterLabel:
      Array.from(document.querySelectorAll<HTMLElement>("button, a"))
        .map((node) => node.textContent?.trim() ?? "")
        .find((text) => /^\d+\s*-\s*[\d.]+$/.test(text)) ?? null,
  });

const collectPremiumFreeTargetReference = (
  banner: HTMLElement | null,
): RemangaChapterReference | null =>
  derivePremiumFreeTargetReference({
    currentReference: collectPremiumFreeReference(),
    hasNativeReaderPages: hasNativePremiumFreeReaderPages(),
    bannerText: banner?.textContent ?? null,
    nextChapterHref: findPremiumFreeNextChapterHref(),
  });

const createPremiumFreeStreamEntry = (
  reference: RemangaChapterReference,
  result: PremiumFreeSuccessResult,
): PremiumFreeStreamEntry => ({
  key: createPremiumFreeKey(reference),
  reference,
  result,
  chapterLabel: formatPremiumFreeChapterLabel(
    result.matchedChapter.volume,
    result.matchedChapter.chapter,
  ),
});

const capturePremiumFreeReaderIndicators = (): PremiumFreeIndicatorSnapshot => ({
  chapterLabelText: findPremiumFreeChapterLabelControl()?.textContent?.trim() ?? null,
  pageCounterText: getReaderDom().pageCounterButton?.textContent?.trim() ?? null,
  url: window.location.href,
});

const restorePremiumFreeReaderIndicators = (): void => {
  const stream = premiumFreeChapterStream;
  if (!stream?.indicatorSnapshot) {
    return;
  }

  const chapterLabelControl = findPremiumFreeChapterLabelControl();
  if (chapterLabelControl && stream.indicatorSnapshot.chapterLabelText) {
    chapterLabelControl.textContent = stream.indicatorSnapshot.chapterLabelText;
  }

  const pageCounterButton = getReaderDom().pageCounterButton;
  if (pageCounterButton && stream.indicatorSnapshot.pageCounterText) {
    pageCounterButton.textContent = stream.indicatorSnapshot.pageCounterText;
  }

  if (stream.activeHistoryUrl && stream.indicatorSnapshot.url !== window.location.href) {
    history.replaceState(history.state, "", stream.indicatorSnapshot.url);
  }

  stream.activeHistoryUrl = null;
};

const syncPremiumFreeReaderIndicators = (
  entry: PremiumFreeStreamEntry | null,
  pageIndex: number | null,
): void => {
  const stream = premiumFreeChapterStream;
  if (!stream) {
    return;
  }

  if (!entry || pageIndex === null) {
    restorePremiumFreeReaderIndicators();
    return;
  }

  stream.indicatorSnapshot ??= capturePremiumFreeReaderIndicators();

  const chapterLabelControl = findPremiumFreeChapterLabelControl();
  if (chapterLabelControl) {
    chapterLabelControl.textContent = entry.chapterLabel;
  }

  const pageCounterButton = getReaderDom().pageCounterButton;
  if (pageCounterButton) {
    pageCounterButton.textContent = `${pageIndex + 1}/${entry.result.totalPages}`;
  }

  if (entry.reference.chapterId) {
    if (stream.activeHistoryUrl) {
      history.replaceState(history.state, "", stream.indicatorSnapshot.url);
      stream.activeHistoryUrl = null;
    }

    return;
  }

  const nextUrl = new URL(stream.indicatorSnapshot.url);
  nextUrl.hash = `rre-chapter=${encodeURIComponent(entry.chapterLabel)}`;
  const nextHref = nextUrl.toString();
  if (nextHref !== window.location.href) {
    history.replaceState(history.state, "", nextHref);
  }
  stream.activeHistoryUrl = nextHref;
};

const disconnectPremiumFreeStreamObservers = (): void => {
  premiumFreeStreamPageObserver?.disconnect();
  premiumFreeStreamPageObserver = null;
  premiumFreeStreamLoadObserver?.disconnect();
  premiumFreeStreamLoadObserver = null;
  disconnectPremiumFreeViewportListeners();
};

const resetPremiumFreeChapterStream = (): void => {
  disconnectPremiumFreeStreamObservers();
  restorePremiumFreeReaderIndicators();
  premiumFreeChapterStream?.visiblePages.clear();
  premiumFreeChapterStream = null;
};

const ensurePremiumFreeChapterStream = (
  container: HTMLElement,
  key: string,
  reference: RemangaChapterReference,
  result: PremiumFreeSuccessResult,
): PremiumFreeChapterStream => {
  if (!premiumFreeChapterStream || premiumFreeChapterStream.rootKey !== key) {
    resetPremiumFreeChapterStream();
    premiumFreeChapterStream = {
      rootKey: key,
      container,
      entries: [createPremiumFreeStreamEntry(reference, result)],
      status: "idle",
      errorResult: null,
      visiblePages: new Map<HTMLElement, PremiumFreeVisiblePage>(),
      indicatorSnapshot: null,
      activeHistoryUrl: null,
    };

    return premiumFreeChapterStream;
  }

  premiumFreeChapterStream.container = container;
  premiumFreeChapterStream.entries[0] = createPremiumFreeStreamEntry(reference, result);
  premiumFreeChapterStream.errorResult = null;
  premiumFreeChapterStream.status =
    premiumFreeChapterStream.status === "exhausted" && result.nextChapter ? "idle" : premiumFreeChapterStream.status;
  return premiumFreeChapterStream;
};

const restorePremiumFreeBanner = (banner: HTMLElement | null): void => {
  if (!banner) {
    return;
  }

  banner.removeAttribute(PREMIUM_FREE_BANNER_ATTRIBUTE);
  banner.style.height = "";
  banner.style.minHeight = "";
  banner.style.display = "";
  banner.style.alignItems = "";
  banner.style.justifyContent = "";

  Array.from(banner.children).forEach((child) => {
    if (child instanceof HTMLElement && !child.hasAttribute(CONTROL_ATTRIBUTE)) {
      child.removeAttribute(HIDDEN_ATTRIBUTE);
    }
  });
};

const ensurePremiumFreeContainer = (banner: HTMLElement): HTMLElement => {
  banner.setAttribute(PREMIUM_FREE_BANNER_ATTRIBUTE, "true");
  banner.style.height = "auto";
  banner.style.minHeight = "100vh";
  banner.style.display = "block";

  Array.from(banner.children).forEach((child) => {
    if (child instanceof HTMLElement && child.getAttribute(CONTROL_ATTRIBUTE) !== PREMIUM_FREE_ROOT_KEY) {
      markHidden(child, true);
    }
  });

  const existing = banner.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="${PREMIUM_FREE_ROOT_KEY}"]`,
  );
  if (existing) {
    return existing;
  }

  const root = document.createElement("div");
  root.setAttribute(CONTROL_ATTRIBUTE, PREMIUM_FREE_ROOT_KEY);
  root.setAttribute(PREMIUM_FREE_STATE_ATTRIBUTE, "idle");
  banner.append(root);
  return root;
};

const createPremiumFreeStatusCard = (
  title: string,
  copy: string,
  linkHref?: string,
  linkLabel?: string,
): HTMLElement => {
  const card = document.createElement("div");
  card.setAttribute(CONTROL_ATTRIBUTE, "premium-free-status");

  const titleNode = document.createElement("div");
  titleNode.setAttribute(CONTROL_ATTRIBUTE, "premium-free-title");
  titleNode.textContent = title;
  card.append(titleNode);

  const copyNode = document.createElement("div");
  copyNode.setAttribute(CONTROL_ATTRIBUTE, "premium-free-copy");
  copyNode.textContent = copy;
  card.append(copyNode);

  if (linkHref && linkLabel) {
    const link = document.createElement("a");
    link.setAttribute(CONTROL_ATTRIBUTE, "premium-free-link");
    link.href = linkHref;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    link.textContent = linkLabel;
    card.append(link);
  }

  return card;
};

const renderPremiumFreeState = (
  container: HTMLElement,
  state: PremiumFreeState,
  options: {
    title: string;
    copy: string;
    linkHref?: string;
    linkLabel?: string;
  },
): void => {
  container.setAttribute(PREMIUM_FREE_STATE_ATTRIBUTE, state);
  container.replaceChildren(
    createPremiumFreeStatusCard(
      options.title,
      options.copy,
      options.linkHref,
      options.linkLabel,
    ),
  );

  if (state !== "resolving") {
    return;
  }

  const skeletonList = document.createElement("div");
  skeletonList.setAttribute(CONTROL_ATTRIBUTE, "premium-free-skeleton-list");
  [96, 84, 132, 108, 88].forEach((height) => {
    const line = document.createElement("div");
    line.setAttribute(CONTROL_ATTRIBUTE, "premium-free-skeleton-line");
    line.style.height = `${height}px`;
    skeletonList.append(line);
  });
  container.append(skeletonList);
};

const renderPremiumFreePages = (
  container: HTMLElement,
  result: PremiumFreeSuccessResult,
  key: string,
  reference: RemangaChapterReference,
): void => {
  container.setAttribute(PREMIUM_FREE_STATE_ATTRIBUTE, "rendering");
  syncPremiumFreeChapterAsViewed(reference.chapterId);
  const readerState = collectPremiumFreeReaderState();

  if (readerState.mode === "pager") {
    resetPremiumFreeChapterStream();
    renderPremiumFreePagerPages(container, result, readerState, key);
    return;
  }

  const stream = ensurePremiumFreeChapterStream(container, key, reference, result);
  renderPremiumFreeFeedStream(container, stream, readerState);
};

const renderPremiumFreeError = (
  container: HTMLElement,
  result: Extract<PremiumFreeClientResolveResult, { status: "failure" }>,
  titleName: string,
): void => {
  renderPremiumFreeState(
    container,
    "error",
    describePremiumFreeFailure(result, titleName),
  );
};

const appendPremiumFreeRetryButton = (
  container: HTMLElement,
  onClick: () => void,
): void => {
  const card = container.querySelector<HTMLElement>(
    `[${CONTROL_ATTRIBUTE}="premium-free-status"]`,
  );
  if (!card) {
    return;
  }

  const button = document.createElement("button");
  button.setAttribute(CONTROL_ATTRIBUTE, "premium-free-link");
  button.textContent = "Запустить парсер";
  button.addEventListener("click", onClick, { once: true });
  card.append(button);
};

const resolvePremiumFreeChapterResult = async (
  reference: RemangaChapterReference,
  controller: AbortController,
): Promise<PremiumFreeClientResolveResult> => {
  let result: PremiumFreeClientResolveResult;

  try {
    const parserServerStatus = await ensureParserServerReady();
    if (parserServerStatus.status === "ready" && typeof parserServerStatus.port === "number") {
      activeParserServerPort = parserServerStatus.port;
    }
    const parserServerFailure = mapParserServerFailure(parserServerStatus);
    if (parserServerFailure) {
      result = {
        ...parserServerFailure,
        manualUrl: buildPremiumFreeSearchUrl(reference.titleName),
      };
    } else {
      const pref = readPremiumFreeBranchPreference(
        premiumFreeBranchPrefs,
        reference.titleDir,
      );
      const requestedBranchId = pref?.branchId ?? null;
      const response = await fetch(`${getParserServerBaseUrl()}/api/chapters/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          remanga: reference,
          ...(requestedBranchId ? { forcedBranchId: requestedBranchId } : {}),
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as PremiumFreeClientResolveResult;
      if (
        !payload ||
        typeof payload !== "object" ||
        !("status" in payload) ||
        (payload.status !== "success" && payload.status !== "failure")
      ) {
        throw new Error("Unexpected premium-free response");
      }

      result = payload;
      purgeStaleBranchPrefIfNeeded(reference.titleDir, requestedBranchId, result);
    }
  } catch (error) {
    if (controller.signal.aborted) {
      throw error;
    }

    result = {
      status: "failure",
      reason: "resolver_unavailable",
      provider: "unknown",
      manualUrl: buildPremiumFreeSearchUrl(reference.titleName),
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  premiumFreeResultCache.set(
    createPremiumFreeKey(reference),
    createPremiumFreeCacheEntry(result),
  );

  return result;
};

const loadPremiumFreeNextChapter = async (): Promise<void> => {
  const stream = premiumFreeChapterStream;
  if (!stream || !stream.container.isConnected || stream.status === "loading-next") {
    return;
  }

  const lastEntry = stream.entries.at(-1);
  if (!lastEntry?.result.nextChapter) {
    stream.status = "exhausted";
    renderPremiumFreeFeedStream(stream.container, stream, collectPremiumFreeReaderState());
    return;
  }

  const nextReference = createPremiumFreeStreamReference(
    lastEntry.reference,
    lastEntry.result.nextChapter,
  );
  const nextKey = createPremiumFreeKey(nextReference);
  if (stream.entries.some((entry) => entry.key === nextKey)) {
    stream.status = "exhausted";
    renderPremiumFreeFeedStream(stream.container, stream, collectPremiumFreeReaderState());
    return;
  }

  const cacheEntry = premiumFreeResultCache.get(nextKey);
  const cachedResult = cacheEntry ? readPremiumFreeCacheEntry(cacheEntry) : null;
  if (cachedResult) {
    if (cachedResult.status === "failure") {
      stream.status = "error";
      stream.errorResult = cachedResult;
    } else {
      stream.entries.push(createPremiumFreeStreamEntry(nextReference, cachedResult));
      stream.status = cachedResult.nextChapter ? "idle" : "exhausted";
      stream.errorResult = null;
      if (prefetchNextChapterEnabled) {
        const { titleDir, chapterId } = nextReference;
        if (typeof titleDir === "string" && typeof chapterId === "number") {
          void prefetchRemangaNextChapter(titleDir, chapterId);
        }
      }
    }

    renderPremiumFreeFeedStream(stream.container, stream, collectPremiumFreeReaderState());
    return;
  }

  stream.status = "loading-next";
  stream.errorResult = null;
  renderPremiumFreeFeedStream(stream.container, stream, collectPremiumFreeReaderState());

  premiumFreeNextRequest?.controller.abort();
  const controller = new AbortController();
  premiumFreeNextRequest = {
    key: nextKey,
    controller,
  };

  let result: PremiumFreeClientResolveResult;
  try {
    result = await resolvePremiumFreeChapterResult(nextReference, controller);
  } catch {
    if (controller.signal.aborted) {
      return;
    }

    throw new Error("Unexpected premium-free next-chapter abort state");
  } finally {
    if (premiumFreeNextRequest?.key === nextKey) {
      premiumFreeNextRequest = null;
    }
  }

  if (
    controller.signal.aborted ||
    !premiumFreeChapterStream ||
    premiumFreeChapterStream.rootKey !== stream.rootKey ||
    !stream.container.isConnected
  ) {
    return;
  }

  if (result.status === "failure") {
    stream.status = "error";
    stream.errorResult = result;
    renderPremiumFreeFeedStream(stream.container, stream, collectPremiumFreeReaderState());
    return;
  }

  stream.entries.push(createPremiumFreeStreamEntry(nextReference, result));
  stream.status = result.nextChapter ? "idle" : "exhausted";
  stream.errorResult = null;
  if (prefetchNextChapterEnabled) {
    const { titleDir, chapterId } = nextReference;
    if (typeof titleDir === "string" && typeof chapterId === "number") {
      void prefetchRemangaNextChapter(titleDir, chapterId);
    }
  }
  renderPremiumFreeFeedStream(stream.container, stream, collectPremiumFreeReaderState());
};

const requestPremiumFreeChapter = async (
  reference: RemangaChapterReference,
  key: string,
  controller: AbortController,
): Promise<void> => {
  try {
    await resolvePremiumFreeChapterResult(reference, controller);
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }
    throw error;
  }

  if (controller.signal.aborted) {
    return;
  }

  if (premiumFreeActiveRequest?.key === key) {
    premiumFreeActiveRequest = null;
  }

  const banner = findBuyChapterBanner();
  if (!banner) {
    return;
  }

  const currentReference = collectPremiumFreeTargetReference(banner);
  if (!currentReference || createPremiumFreeKey(currentReference) !== key) {
    return;
  }

  syncPremiumFreeBanner(banner, true);
};
