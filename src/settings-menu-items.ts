export const SETTINGS_MENU_ITEMS = {
  imageSettings: {
    label: "Настройка изображения",
    kind: "button",
  },
  hotkeys: {
    label: "Настройка горячих клавиш",
    aliases: ["Настройка горячих клавишь"],
    kind: "button",
  },
  scrollSettings: {
    label: "Настройка скролла",
    kind: "button",
  },
  otherSettings: {
    label: "Другие настройки",
    kind: "button",
  },
  readerType: {
    label: "Тип читалки",
    kind: "section",
  },
  pageIndicator: {
    label: "Отображение индикатора номера страницы",
    aliases: ["Отображение индикатора номера страниц"],
    kind: "switchRow",
  },
  notes: {
    label: "Показывать заметки",
    kind: "switchRow",
  },
} as const;

export type SettingsMenuItemKey = keyof typeof SETTINGS_MENU_ITEMS;
export const SETTINGS_MENU_ITEM_KEYS = Object.keys(
  SETTINGS_MENU_ITEMS,
) as SettingsMenuItemKey[];

export const matchSettingsMenuItemKey = (
  text: string | null | undefined,
): SettingsMenuItemKey | null => {
  return (
    SETTINGS_MENU_ITEM_KEYS.find((key) => matchesSettingsMenuItemText(key, text)) ??
    null
  );
};

export const matchesSettingsMenuItemText = (
  key: SettingsMenuItemKey,
  text: string | null | undefined,
): boolean => {
  const normalizedText = normalizeText(text);
  const item = SETTINGS_MENU_ITEMS[key];
  const aliases = "aliases" in item ? item.aliases : [];

  return [item.label, ...aliases].some((label) => {
    return normalizeText(label) === normalizedText;
  });
};

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
