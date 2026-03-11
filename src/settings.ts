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

export type ReaderEnhancerSettings = {
  hideHeader: boolean;
  hideRightRail: boolean;
  hidePageCounter: boolean;
  hideRailFullscreenButton: boolean;
  minimizeSettingsButton: boolean;
  isAdditionalSettingsExpanded: boolean;
  enhanceSettingsMenu: boolean;
  hideCommentsSection: boolean;
  hideToolbarButtons: Record<ToolbarButtonKey, boolean>;
  hideSettingsMenuItems: Record<SettingsMenuItemKey, boolean>;
  hidePopups: Record<PopupSettingKey, boolean>;
};

type PartialSettings = Partial<
  Omit<
    ReaderEnhancerSettings,
    "hideToolbarButtons" | "hidePopups" | "hideSettingsMenuItems"
  >
> & {
  hideToolbarButtons?: Partial<Record<ToolbarButtonKey, boolean>>;
  hideSettingsMenuItems?: Partial<Record<SettingsMenuItemKey, boolean>>;
  hidePopups?: Partial<Record<PopupSettingKey, boolean>>;
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
  minimizeSettingsButton: false,
  isAdditionalSettingsExpanded: true,
  enhanceSettingsMenu: false,
  hideCommentsSection: false,
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
};

export const cloneSettings = (
  settings: ReaderEnhancerSettings,
): ReaderEnhancerSettings => ({
  hideHeader: settings.hideHeader,
  hideRightRail: settings.hideRightRail,
  hidePageCounter: settings.hidePageCounter,
  hideRailFullscreenButton: settings.hideRailFullscreenButton,
  minimizeSettingsButton: settings.minimizeSettingsButton,
  isAdditionalSettingsExpanded: settings.isAdditionalSettingsExpanded,
  enhanceSettingsMenu: settings.enhanceSettingsMenu,
  hideCommentsSection: settings.hideCommentsSection,
  hideToolbarButtons: { ...settings.hideToolbarButtons },
  hideSettingsMenuItems: { ...settings.hideSettingsMenuItems },
  hidePopups: { ...settings.hidePopups },
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
  minimizeSettingsButton:
    partialSettings?.minimizeSettingsButton ??
    DEFAULT_SETTINGS.minimizeSettingsButton,
  isAdditionalSettingsExpanded:
    partialSettings?.isAdditionalSettingsExpanded ??
    DEFAULT_SETTINGS.isAdditionalSettingsExpanded,
  enhanceSettingsMenu:
    partialSettings?.enhanceSettingsMenu ?? DEFAULT_SETTINGS.enhanceSettingsMenu,
  hideCommentsSection:
    partialSettings?.hideCommentsSection ?? DEFAULT_SETTINGS.hideCommentsSection,
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
});

const getStorageArea = (): chrome.storage.SyncStorageArea | null =>
  typeof chrome !== "undefined" && chrome.storage?.sync ? chrome.storage.sync : null;

export const loadSettings = async (): Promise<ReaderEnhancerSettings> => {
  const storageArea = getStorageArea();
  if (!storageArea) {
    return cloneSettings(DEFAULT_SETTINGS);
  }

  return new Promise((resolve) => {
    storageArea.get(DEFAULT_SETTINGS, (storedSettings) => {
      if (chrome.runtime?.lastError) {
        resolve(cloneSettings(DEFAULT_SETTINGS));
        return;
      }

      resolve(mergeSettings(storedSettings as PartialSettings));
    });
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
