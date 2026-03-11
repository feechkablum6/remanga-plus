export type RailOverlayState = {
  hideRailContainer: boolean;
  showSettingsPeekZone: boolean;
};

export type RailOverlayStateInput = {
  isSettingsPanelOpen: boolean;
  hideRightRail: boolean;
  minimizeSettingsButton: boolean;
  hasRailContainer: boolean;
  hasSettingsButton: boolean;
};

export const getRailOverlayState = ({
  isSettingsPanelOpen,
  hideRightRail,
  minimizeSettingsButton,
  hasRailContainer,
  hasSettingsButton,
}: RailOverlayStateInput): RailOverlayState => ({
  hideRailContainer: false,
  showSettingsPeekZone:
    !isSettingsPanelOpen &&
    hideRightRail &&
    minimizeSettingsButton &&
    hasRailContainer &&
    hasSettingsButton,
});
