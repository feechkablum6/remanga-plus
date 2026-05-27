export interface TitleOverride {
  provider: string;
  titleId: string;
}

export const DEFAULT_PROVIDER_PRIORITY = ["mangabuff", "senkuro", "inkstory", "telemanga", "teletype", "usagi", "wamanga"];

export const DEFAULT_TITLE_OVERRIDES: Record<string, TitleOverride> = {
  "the-return-of-the-immortals_": {
    provider: "mangabuff",
    titleId: "vozvrashchenie-eretika",
  },
};
