import type { ReaderEnhancerSettings, HeaderButtonKey } from "./settings.js";

export type CategoryKey = "site" | "reader" | "premium-free";

export type SiteSubsection = "КНОПКИ ШАПКИ" | "ГЛАВНАЯ СТРАНИЦА";

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
      >;
    }
  | { kind: "header-button"; key: HeaderButtonKey };

export type ToggleDescriptor = {
  label: string;
  caption?: string;
  accessor: ToggleAccessor;
  subsection?: SiteSubsection;
};

export type CategoryMeta = {
  label: string;
  icon: "globe" | "book" | "bolt";
  toggles: ReadonlyArray<ToggleDescriptor>;
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
  },
  {
    label: "Скрыть промо-плашку Telegram",
    accessor: { kind: "scalar", key: "hideHomePromoBanner" },
    subsection: "ГЛАВНАЯ СТРАНИЦА",
  },
];

const readerToggles: ReadonlyArray<ToggleDescriptor> = [
  { label: "Скрыть шапку сайта в читалке", accessor: { kind: "scalar", key: "hideHeader" } },
  { label: "Скрыть правую панель", accessor: { kind: "scalar", key: "hideRightRail" } },
  { label: "Скрыть счётчик страниц", accessor: { kind: "scalar", key: "hidePageCounter" } },
  { label: "Улучшить меню настроек", accessor: { kind: "scalar", key: "enhanceSettingsMenu" } },
  { label: "Скрыть комментарии", accessor: { kind: "scalar", key: "hideCommentsSection" } },
  { label: "Плотный фид глав", accessor: { kind: "scalar", key: "tightenChapterFeed" } },
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
];

export const CATEGORY_KEYS: ReadonlyArray<CategoryKey> = ["site", "reader", "premium-free"];

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  site: { label: "Сайт", icon: "globe", toggles: siteToggles },
  reader: { label: "Читалка", icon: "book", toggles: readerToggles },
  "premium-free": { label: "Premium Free", icon: "bolt", toggles: premiumFreeToggles },
};

export const countCategoryToggles = (key: CategoryKey): number =>
  CATEGORIES[key].toggles.length;
