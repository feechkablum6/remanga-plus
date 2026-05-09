import {
  SETTINGS_MENU_ITEMS,
  type SettingsMenuItemKey,
} from "./settings-menu-items.js";

export type ToolbarButtonKey =
  | "list"
  | "comments"
  | "like"
  | "addImage"
  | "edit"
  | "autoScroll"
  | "report";

export type PopupSettingKey = "hints" | "giftsPromo" | "otherNonBlocking";

export type HeaderButtonKey =
  | "logo"
  | "catalog"
  | "tops"
  | "forum"
  | "ellipsis"
  | "search"
  | "bookmarks"
  | "chat"
  | "notifications"
  | "avatar";

export type ReaderEnhancerSettings = {
  hideHeader: boolean;
  hideRightRail: boolean;
  hidePageCounter: boolean;
  hideRailFullscreenButton: boolean;
  isAdditionalSettingsExpanded: boolean;
  enhanceSettingsMenu: boolean;
  hideCommentsSection: boolean;
  premiumFree: boolean;
  prefetchNextChapter: boolean;
  showPremiumFreeProgress: boolean;
  tightenChapterFeed: boolean;
  hideToolbarButtons: Record<ToolbarButtonKey, boolean>;
  hideSettingsMenuItems: Record<SettingsMenuItemKey, boolean>;
  hidePopups: Record<PopupSettingKey, boolean>;
  hideHeaderButtons: Record<HeaderButtonKey, boolean>;
  hideHomeGameBanner: boolean;
};

type PartialSettings = Partial<
  Omit<
    ReaderEnhancerSettings,
    "hideToolbarButtons" | "hidePopups" | "hideSettingsMenuItems" | "hideHeaderButtons"
  >
> & {
  hideBuyChapterBanner?: boolean;
  hideToolbarButtons?: Partial<Record<ToolbarButtonKey, boolean>>;
  hideSettingsMenuItems?: Partial<Record<SettingsMenuItemKey, boolean>>;
  hidePopups?: Partial<Record<PopupSettingKey, boolean>>;
  hideHeaderButtons?: Partial<Record<HeaderButtonKey, boolean>>;
};

const createDefaultSettingsMenuItems = (): Record<SettingsMenuItemKey, boolean> =>
  Object.fromEntries(
    Object.keys(SETTINGS_MENU_ITEMS).map((key) => [key, true]),
  ) as Record<SettingsMenuItemKey, boolean>;

export const DEFAULT_SETTINGS: ReaderEnhancerSettings = {
  hideHeader: false,
  hideRightRail: false,
  hidePageCounter: false,
  hideRailFullscreenButton: false,
  isAdditionalSettingsExpanded: true,
  enhanceSettingsMenu: false,
  hideCommentsSection: false,
  premiumFree: false,
  prefetchNextChapter: true,
  showPremiumFreeProgress: true,
  tightenChapterFeed: true,
  hideToolbarButtons: {
    list: false,
    comments: false,
    like: false,
    addImage: false,
    edit: false,
    autoScroll: false,
    report: false,
  },
  hideSettingsMenuItems: createDefaultSettingsMenuItems(),
  hidePopups: {
    hints: false,
    giftsPromo: false,
    otherNonBlocking: false,
  },
  hideHeaderButtons: {
    logo: false,
    catalog: false,
    tops: false,
    forum: false,
    ellipsis: false,
    search: false,
    bookmarks: false,
    chat: false,
    notifications: false,
    avatar: false,
  },
  hideHomeGameBanner: false,
};

export const cloneSettings = (
  settings: ReaderEnhancerSettings,
): ReaderEnhancerSettings => ({
  hideHeader: settings.hideHeader,
  hideRightRail: settings.hideRightRail,
  hidePageCounter: settings.hidePageCounter,
  hideRailFullscreenButton: settings.hideRailFullscreenButton,
  isAdditionalSettingsExpanded: settings.isAdditionalSettingsExpanded,
  enhanceSettingsMenu: settings.enhanceSettingsMenu,
  hideCommentsSection: settings.hideCommentsSection,
  premiumFree: settings.premiumFree,
  prefetchNextChapter: settings.prefetchNextChapter,
  showPremiumFreeProgress: settings.showPremiumFreeProgress,
  tightenChapterFeed: settings.tightenChapterFeed,
  hideToolbarButtons: { ...settings.hideToolbarButtons },
  hideSettingsMenuItems: { ...settings.hideSettingsMenuItems },
  hidePopups: { ...settings.hidePopups },
  hideHeaderButtons: { ...settings.hideHeaderButtons },
  hideHomeGameBanner: settings.hideHomeGameBanner,
});

export const mergeSettings = (
  partialSettings?: PartialSettings,
): ReaderEnhancerSettings => ({
  hideHeader: partialSettings?.hideHeader ?? DEFAULT_SETTINGS.hideHeader,
  hideRightRail: partialSettings?.hideRightRail ?? DEFAULT_SETTINGS.hideRightRail,
  hidePageCounter:
    partialSettings?.hidePageCounter ?? DEFAULT_SETTINGS.hidePageCounter,
  hideRailFullscreenButton:
    partialSettings?.hideRailFullscreenButton ??
    DEFAULT_SETTINGS.hideRailFullscreenButton,
  isAdditionalSettingsExpanded:
    partialSettings?.isAdditionalSettingsExpanded ??
    DEFAULT_SETTINGS.isAdditionalSettingsExpanded,
  enhanceSettingsMenu:
    partialSettings?.enhanceSettingsMenu ?? DEFAULT_SETTINGS.enhanceSettingsMenu,
  hideCommentsSection:
    partialSettings?.hideCommentsSection ?? DEFAULT_SETTINGS.hideCommentsSection,
  premiumFree:
    partialSettings?.premiumFree ??
    partialSettings?.hideBuyChapterBanner ??
    DEFAULT_SETTINGS.premiumFree,
  prefetchNextChapter:
    partialSettings?.prefetchNextChapter ?? DEFAULT_SETTINGS.prefetchNextChapter,
  showPremiumFreeProgress:
    partialSettings?.showPremiumFreeProgress ?? DEFAULT_SETTINGS.showPremiumFreeProgress,
  tightenChapterFeed:
    partialSettings?.tightenChapterFeed ?? DEFAULT_SETTINGS.tightenChapterFeed,
  hideToolbarButtons: {
    ...DEFAULT_SETTINGS.hideToolbarButtons,
    ...partialSettings?.hideToolbarButtons,
  },
  hideSettingsMenuItems: {
    ...DEFAULT_SETTINGS.hideSettingsMenuItems,
    ...partialSettings?.hideSettingsMenuItems,
  },
  hidePopups: {
    ...DEFAULT_SETTINGS.hidePopups,
    ...partialSettings?.hidePopups,
  },
  hideHeaderButtons: {
    ...DEFAULT_SETTINGS.hideHeaderButtons,
    ...partialSettings?.hideHeaderButtons,
  },
  hideHomeGameBanner:
    partialSettings?.hideHomeGameBanner ?? DEFAULT_SETTINGS.hideHomeGameBanner,
});

const getStorageArea = (): chrome.storage.SyncStorageArea | null =>
  typeof chrome !== "undefined" && chrome.storage?.sync ? chrome.storage.sync : null;

export const loadSettings = async (): Promise<ReaderEnhancerSettings> => {
  const storageArea = getStorageArea();
  if (!storageArea) {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  return new Promise((resolve) => {
    storageArea.get(
      {
        ...DEFAULT_SETTINGS,
        hideBuyChapterBanner: DEFAULT_SETTINGS.premiumFree,
      },
      (storedSettings) => {
      if (chrome.runtime?.lastError) {
        resolve(cloneSettings(DEFAULT_SETTINGS));
        return;
      }

      resolve(mergeSettings(storedSettings as PartialSettings));
      },
    );
  });
};

export const saveSettings = async (
  settings: ReaderEnhancerSettings,
): Promise<void> => {
  const storageArea = getStorageArea();
  if (!storageArea) {
    return;
  }

  return new Promise((resolve) => {
    storageArea.set(settings, () => {
      resolve();
    });
  });
};

export const watchSettings = (
  onChange: (settings: ReaderEnhancerSettings) => void,
): (() => void) => {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return () => {};
  }

  const listener = async (
    _changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "sync") {
      return;
    }

    onChange(await loadSettings());
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
};
