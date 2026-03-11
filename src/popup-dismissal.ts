export const POPUP_SELECTORS = [
  'ol.toaster[data-sonner-toaster] > li[data-sonner-toast]',
  'section[aria-label^="Notifications"] > div',
  'div[data-sonner-toast]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[aria-modal="true"]',
];

export const POPUP_CLOSE_BUTTON_SELECTORS = [
  'button[data-close-button="true"]',
  'button[aria-label="Close toast"]',
  'button[data-dismiss]',
  'button[aria-label="Close"]',
  'button[aria-label="Закрыть"]',
  'button[title="Close"]',
  'button[title="Закрыть"]',
  'button[data-radix-dialog-close]',
  '[data-radix-dialog-close] button',
  'button[data-dialog-close]',
  '[data-dialog-close] button',
];

export type CornerCloseButtonSnapshot = {
  text: string | null;
  ariaLabel: string | null;
  title: string | null;
  hasSvg: boolean;
  relativeTop: number;
  relativeRight: number;
  widthRatio: number;
  heightRatio: number;
};

const normalizeText = (value: string | null | undefined): string =>
  value?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";

export const isLikelyCornerCloseButton = (
  snapshot: CornerCloseButtonSnapshot,
): boolean => {
  const actionText = normalizeText(snapshot.text);
  const closeLabel = normalizeText(
    [snapshot.ariaLabel, snapshot.title].filter(Boolean).join(" "),
  );

  if (closeLabel.includes("close") || closeLabel.includes("закры")) {
    return true;
  }

  if (!snapshot.hasSvg || actionText.length > 2) {
    return false;
  }

  return (
    snapshot.relativeTop <= 0.18 &&
    snapshot.relativeRight <= 0.18 &&
    snapshot.widthRatio <= 0.18 &&
    snapshot.heightRatio <= 0.18
  );
};
