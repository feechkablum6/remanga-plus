export type ProgressEmitterEvent = { proxyPath: string; success: boolean };
export type ProgressEmitter = (
  listener: (event: ProgressEmitterEvent) => void,
) => () => void;

export type ProgressTracker = {
  snapshot(): { loaded: number; total: number };
  dispose(): void;
};

const SHOW_DELAY_MS = 500;
const HIDE_DELAY_MS = 1000;
const FADE_MS = 200;
const CHIP_ATTR = "data-rre-control";
const CHIP_VALUE = "premium-free-progress";
const CHIP_STYLES = `
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 2147483000;
  background: rgba(20, 20, 25, 0.85);
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 999px;
  font: 600 13px/1 -apple-system, system-ui, sans-serif;
  pointer-events: none;
  opacity: 1;
  transition: opacity ${FADE_MS}ms ease-out;
`;

const findChip = (): HTMLElement | null =>
  (document.querySelector(`[${CHIP_ATTR}="${CHIP_VALUE}"]`) as HTMLElement | null) ?? null;

const ensureChip = (loaded: number, total: number): HTMLElement => {
  let chip = findChip();
  if (!chip) {
    chip = document.createElement("div") as HTMLElement;
    chip.setAttribute(CHIP_ATTR, CHIP_VALUE);
    chip.setAttribute("style", CHIP_STYLES);
    document.body.appendChild(chip);
  }
  chip.textContent = `⏳ ${loaded} / ${total}`;
  chip.removeAttribute("data-rre-motion-state");
  if (chip.style) chip.style.opacity = "1";
  return chip;
};

const removeChip = (): void => {
  const chip = findChip();
  if (chip) chip.remove();
};

export const createProgressTracker = (options: {
  total: number;
  subscribe: ProgressEmitter;
}): ProgressTracker => {
  const seen = new Set<string>();
  let loaded = 0;
  const total = options.total;

  let showHandle: number | null = null;
  let hideHandle: number | null = null;
  let removeHandle: number | null = null;

  const cancelShow = () => {
    if (showHandle !== null) {
      window.clearTimeout(showHandle);
      showHandle = null;
    }
  };

  const cancelHide = () => {
    if (hideHandle !== null) {
      window.clearTimeout(hideHandle);
      hideHandle = null;
    }
    if (removeHandle !== null) {
      window.clearTimeout(removeHandle);
      removeHandle = null;
    }
  };

  const scheduleShow = () => {
    if (showHandle !== null || loaded >= total) return;
    showHandle = window.setTimeout(() => {
      showHandle = null;
      if (loaded >= total) return;
      ensureChip(loaded, total);
    }, SHOW_DELAY_MS);
  };

  const scheduleHide = () => {
    if (hideHandle !== null) return;
    hideHandle = window.setTimeout(() => {
      hideHandle = null;
      const chip = findChip();
      if (!chip) return;
      chip.setAttribute("data-rre-motion-state", "hidden");
      if (chip.style) chip.style.opacity = "0";
      removeHandle = window.setTimeout(() => {
        removeHandle = null;
        chip.remove();
      }, FADE_MS);
    }, HIDE_DELAY_MS);
  };

  const update = () => {
    const chip = findChip();
    if (chip) {
      chip.textContent = `⏳ ${loaded} / ${total}`;
    }
    if (loaded >= total) {
      cancelShow();
      scheduleHide();
    } else {
      cancelHide();
      scheduleShow();
    }
  };

  const unsubscribe = options.subscribe((event) => {
    if (seen.has(event.proxyPath)) return;
    seen.add(event.proxyPath);
    loaded += 1;
    update();
  });

  scheduleShow();

  return {
    snapshot: () => ({ loaded, total }),
    dispose: () => {
      unsubscribe();
      cancelShow();
      cancelHide();
      removeChip();
    },
  };
};
