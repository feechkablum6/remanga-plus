import type {
  ReaderEnhancerSettings,
  HeaderButtonKey,
  BookmarkFilterCategoryKey,
  PopupSettingKey,
  ProviderKey,
  RecommendationTypeKey,
  RecommendationTypeState,
} from "./settings.js";

export type CategoryKey = "site" | "reader" | "premium-free";

export type SiteSubsection =
  | "КНОПКИ ШАПКИ"
  | "ГЛАВНАЯ СТРАНИЦА"
  | "АВТО-СКРЫТИЯ";

export type ToggleAccessor =
  | {
      kind: "scalar";
      key: keyof Pick<
        ReaderEnhancerSettings,
        | "hideHomeGameBanner"
        | "hideHomePromoBanner"
        | "hideHeader"
        | "hideRightRail"
        | "hidePageCounter"
        | "enhanceSettingsMenu"
        | "hideCommentsSection"
        | "tightenChapterFeed"
        | "premiumFree"
        | "prefetchNextChapter"
      | "showPremiumFreeProgress"
      | "personalRecommendations"
      | "filterHomeBookmarks"
    >;
    }
  | { kind: "header-button"; key: HeaderButtonKey }
  | { kind: "bookmark-category"; key: BookmarkFilterCategoryKey }
  | { kind: "popup"; key: PopupSettingKey }
  | { kind: "provider"; key: ProviderKey }
  | { kind: "rec-type"; key: RecommendationTypeKey };

export type ToggleDescriptor = {
  label: string;
  caption?: string;
  accessor: ToggleAccessor;
  subsection?: SiteSubsection;
  collapsibleGroup?: string;
};

export type CategoryMeta = {
  label: string;
  icon: "globe" | "book" | "bolt";
  toggles: ReadonlyArray<ToggleDescriptor>;
};

export const COLLAPSIBLE_GROUPS: Record<string, string> = {
  homeHiding: "Скрытие на главной",
  bookmarkFilter: "Фильтровать закладки",
  providerToggles: "Провайдеры",
  recTypeFilter: "Типы в рекомендациях",
};

const HEADER_BUTTONS: ReadonlyArray<[HeaderButtonKey, string]> = [
  ["logo", "Логотип"],
  ["catalog", "Каталог"],
  ["tops", "Топы"],
  ["forum", "Форум"],
  ["ellipsis", "Троеточие"],
  ["search", "Поиск"],
  ["bookmarks", "Закладки"],
  ["chat", "Чат"],
  ["notifications", "Уведомления"],
  ["avatar", "Профиль"],
];

const BOOKMARK_FILTER_CATEGORIES: ReadonlyArray<[BookmarkFilterCategoryKey, string]> = [
  ["reading", "Читаю"],
  ["planned", "Буду читать"],
  ["completed", "Прочитано"],
  ["dropped", "Брошено"],
  ["notInterest", "Не интересно"],
  ["favorite", "Любимое"],
];

const PROVIDER_KEYS: ReadonlyArray<[ProviderKey, string]> = [
  ["mangabuff", "Mangabuff"],
  ["senkuro", "Senkuro"],
  ["inkstory", "InkStory"],
  ["telemanga", "Telemanga"],
  ["teletype", "Teletype"],
  ["usagi", "Usagi"],
  ["wamanga", "WaManga"],
];

export const REC_TYPE_KEY_TO_LABEL: Record<RecommendationTypeKey, string> = {
  manga: "Манга",
  manhwa: "Манхва",
  manhua: "Маньхуа",
};

export const REC_TYPE_STATE_LABEL: Record<RecommendationTypeState, string> = {
  neutral: "Не важно",
  priority: "Приоритет",
  excluded: "Скрыто",
};

const REC_TYPE_STATE_ORDER: ReadonlyArray<RecommendationTypeState> = [
  "neutral",
  "priority",
  "excluded",
];

export const cycleRecTypeState = (
  current: RecommendationTypeState,
): RecommendationTypeState => {
  const idx = REC_TYPE_STATE_ORDER.indexOf(current);
  return REC_TYPE_STATE_ORDER[(idx + 1) % REC_TYPE_STATE_ORDER.length];
};

export const applyRecTypeChange = (
  settings: ReaderEnhancerSettings,
  key: RecommendationTypeKey,
  next: RecommendationTypeState,
): ReaderEnhancerSettings => ({
  ...settings,
  recommendationTypePreferences: {
    ...settings.recommendationTypePreferences,
    [key]: next,
  },
});

const siteToggles: ReadonlyArray<ToggleDescriptor> = [
  ...HEADER_BUTTONS.map(
    ([key, label]): ToggleDescriptor => ({
      label,
      accessor: { kind: "header-button", key },
      subsection: "КНОПКИ ШАПКИ",
    }),
  ),
  {
    label: "Скрыть баннер игры",
    accessor: { kind: "scalar", key: "hideHomeGameBanner" },
    subsection: "ГЛАВНАЯ СТРАНИЦА",
    collapsibleGroup: "homeHiding",
  },
  {
    label: "Скрыть промо-плашку Telegram",
    accessor: { kind: "scalar", key: "hideHomePromoBanner" },
    subsection: "ГЛАВНАЯ СТРАНИЦА",
    collapsibleGroup: "homeHiding",
  },
  {
    label: "Скрыть окно Premium подписки",
    accessor: { kind: "popup", key: "premiumSubscription" },
    subsection: "ГЛАВНАЯ СТРАНИЦА",
    collapsibleGroup: "homeHiding",
  },
  ...BOOKMARK_FILTER_CATEGORIES.map(
    ([key, label]): ToggleDescriptor => ({
      label,
      accessor: { kind: "bookmark-category", key },
      subsection: "ГЛАВНАЯ СТРАНИЦА",
      collapsibleGroup: "bookmarkFilter",
    }),
  ),
];

const readerToggles: ReadonlyArray<ToggleDescriptor> = [
  { label: "Скрыть шапку сайта в читалке", accessor: { kind: "scalar", key: "hideHeader" } },
  { label: "Скрыть правую панель", accessor: { kind: "scalar", key: "hideRightRail" } },
  { label: "Улучшить меню настроек", accessor: { kind: "scalar", key: "enhanceSettingsMenu" } },
  { label: "Скрыть комментарии", accessor: { kind: "scalar", key: "hideCommentsSection" } },
  { label: "Плотный фид глав", accessor: { kind: "scalar", key: "tightenChapterFeed" } },
  {
    label: "Авто-скрывать подсказки",
    accessor: { kind: "popup", key: "hints" },
    subsection: "АВТО-СКРЫТИЯ",
  },
  {
    label: "Авто-скрывать подарки и промо",
    accessor: { kind: "popup", key: "giftsPromo" },
    subsection: "АВТО-СКРЫТИЯ",
  },
  {
    label: "Авто-скрывать прочие всплывающие окна",
    accessor: { kind: "popup", key: "otherNonBlocking" },
    subsection: "АВТО-СКРЫТИЯ",
  },
];

const premiumFreeToggles: ReadonlyArray<ToggleDescriptor> = [
  {
    label: "Premium Free режим",
    caption: "Бесплатный доступ к платным главам",
    accessor: { kind: "scalar", key: "premiumFree" },
  },
  {
    label: "Префетч следующей главы",
    accessor: { kind: "scalar", key: "prefetchNextChapter" },
  },
  {
    label: "Показывать прогресс загрузки",
    accessor: { kind: "scalar", key: "showPremiumFreeProgress" },
  },
  {
    label: "Персональные рекомендации",
    caption: "Заменить рекомендации на главной с учётом ваших закладок",
    accessor: { kind: "scalar", key: "personalRecommendations" },
  },
  {
    label: "Манга",
    accessor: { kind: "rec-type", key: "manga" },
    collapsibleGroup: "recTypeFilter",
  },
  {
    label: "Манхва",
    accessor: { kind: "rec-type", key: "manhwa" },
    collapsibleGroup: "recTypeFilter",
  },
  {
    label: "Маньхуа",
    accessor: { kind: "rec-type", key: "manhua" },
    collapsibleGroup: "recTypeFilter",
  },
  ...PROVIDER_KEYS.map(
    ([key, label]): ToggleDescriptor => ({
      label,
      accessor: { kind: "provider", key },
      collapsibleGroup: "providerToggles",
    }),
  ),
];

export const CATEGORY_KEYS: ReadonlyArray<CategoryKey> = ["site", "reader", "premium-free"];

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  site: { label: "Сайт", icon: "globe", toggles: siteToggles },
  reader: { label: "Читалка", icon: "book", toggles: readerToggles },
  "premium-free": { label: "Premium Free", icon: "bolt", toggles: premiumFreeToggles },
};

export const countCategoryToggles = (key: CategoryKey): number =>
  CATEGORIES[key].toggles.length;

export const getReaderDrawerToggles = (): ReadonlyArray<ToggleDescriptor> => [
  ...CATEGORIES.reader.toggles,
  ...CATEGORIES["premium-free"].toggles,
];

export const readToggleValue = (
  settings: ReaderEnhancerSettings,
  toggle: ToggleDescriptor,
): boolean => {
  const a = toggle.accessor;
  if (a.kind === "scalar") return settings[a.key];
  if (a.kind === "header-button") return settings.hideHeaderButtons[a.key];
  if (a.kind === "bookmark-category") return settings.filterBookmarkCategories[a.key];
  if (a.kind === "provider") return !settings.disabledProviders[a.key];
  if (a.kind === "rec-type") return settings.recommendationTypePreferences[a.key] !== "excluded";
  return settings.hidePopups[a.key];
};

export const applyToggleChange = (
  settings: ReaderEnhancerSettings,
  toggle: ToggleDescriptor,
  next: boolean,
): ReaderEnhancerSettings => {
  const a = toggle.accessor;
  if (a.kind === "scalar") {
    return { ...settings, [a.key]: next };
  }
  if (a.kind === "header-button") {
    return {
      ...settings,
      hideHeaderButtons: { ...settings.hideHeaderButtons, [a.key]: next },
    };
  }
  if (a.kind === "bookmark-category") {
    return {
      ...settings,
      filterBookmarkCategories: { ...settings.filterBookmarkCategories, [a.key]: next },
    };
  }
  if (a.kind === "provider") {
    return {
      ...settings,
      disabledProviders: { ...settings.disabledProviders, [a.key]: !next },
    };
  }
  if (a.kind === "rec-type") {
    // rec-type toggles use a cycling state button, not a checkbox;
    // the full state change goes through applyRecTypeChange instead.
    return settings;
  }
  return {
    ...settings,
    hidePopups: { ...settings.hidePopups, [a.key]: next },
  };
};
