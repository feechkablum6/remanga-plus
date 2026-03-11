type SettledRefreshInput = {
  mutationType: "attributes" | "childList" | "characterData";
  attributeName: string | null;
  targetMatchesSettingsPanel: boolean;
  targetText: string | null;
};

const SETTINGS_PANEL_TEXT_MARKER = "настройки читалки";
const SETTINGS_PANEL_TRANSITION_ATTRIBUTES = new Set([
  "class",
  "style",
  "data-state",
  "aria-hidden",
]);

export const shouldScheduleSettledRefresh = ({
  mutationType,
  attributeName,
  targetMatchesSettingsPanel,
  targetText,
}: SettledRefreshInput): boolean =>
  mutationType === "attributes" &&
  targetMatchesSettingsPanel &&
  SETTINGS_PANEL_TRANSITION_ATTRIBUTES.has(attributeName ?? "") &&
  normalizeText(targetText).includes(SETTINGS_PANEL_TEXT_MARKER);

const normalizeText = (value: string | null): string =>
  (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
