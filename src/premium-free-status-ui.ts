import type { ProviderChipInfo } from "./premium-free.js";

export type { ProviderChipInfo };

export type StatusBlockUpdate = {
  phase: "connecting" | "searching" | "found" | "not_found" | "parser_down";
  providers: ProviderChipInfo[];
};

const SVG_NS = "http://www.w3.org/2000/svg";

type IconName = "lightning" | "search" | "check" | "cross" | "warning";
type ChipIconName = "search" | "check" | "cross";

const createSvgElement = (tag: string): SVGElement =>
  document.createElementNS(SVG_NS, tag) as SVGElement;

const ICON_PATHS: Record<IconName, string> = {
  lightning:
    "M13 2L4.5 13.5h4.3L11 22l8.5-11.5h-4.3z",
  search:
    "M10.5 3a7.5 7.5 0 1 0 5.3 12.8l4.7 4.7 1.4-1.4-4.7-4.7A7.5 7.5 0 0 0 10.5 3zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11z",
  check:
    "M5 12l4.5 4.5L19 7",
  cross:
    "M6 6l12 12M18 6L6 18",
  warning: "M12 3L2 21h20L12 3z",
};

const warningMark = "M12 10v4M12 17h.01";
const warningTriangle = ICON_PATHS.warning;

const CHIP_ICON_PATHS: Record<ChipIconName, string> = {
  search: "M8 2a6 6 0 1 0 4.2 10.2l3.4 3.4.8-.8-3.4-3.4A6 6 0 0 0 8 2zm0 1.6a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8z",
  check: "M4 8l3 3 7-7",
  cross: "M5 5l6 6M11 5L5 11",
};

const createIconSvg = (name: IconName, size: number): SVGElement => {
  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", name === "lightning" ? "1.5" : "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  if (name === "warning") {
    const path1 = createSvgElement("path");
    path1.setAttribute("d", warningTriangle);
    const path2 = createSvgElement("path");
    path2.setAttribute("d", warningMark);
    svg.append(path1, path2);
  } else {
    const path = createSvgElement("path");
    path.setAttribute("d", ICON_PATHS[name]);
    svg.append(path);
  }

  return svg;
};

const createChipIconSvg = (name: ChipIconName): SVGElement => {
  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = createSvgElement("path");
  path.setAttribute("d", CHIP_ICON_PATHS[name]);
  svg.append(path);
  return svg;
};

const PHASE_CONFIG = {
  connecting: {
    text: "Подключение\u2026",
    iconName: "lightning" as IconName,
    borderColor: "#334155",
    bgColor: "transparent",
  },
  searching: {
    text: "Ищем главу\u2026",
    iconName: "search" as IconName,
    borderColor: "#1d4ed8",
    bgColor: "transparent",
  },
  found: {
    text: "Глава найдена",
    iconName: "check" as IconName,
    borderColor: "#16a34a",
    bgColor: "#052e16",
  },
  not_found: {
    text: "Глава не найдена",
    iconName: "warning" as IconName,
    borderColor: "#dc2626",
    bgColor: "#1c0a0a",
  },
  parser_down: {
    text: "Парсер не запущен",
    iconName: "warning" as IconName,
    borderColor: "#dc2626",
    bgColor: "#1c0a0a",
  },
} as const;

type Phase = keyof typeof PHASE_CONFIG;

const CHIP_STATUS_CONFIG: Record<string, {
  iconName: ChipIconName;
  borderColor: string;
  textColor: string;
  label?: string;
}> = {
  pending: { iconName: "search", borderColor: "#334155", textColor: "rgba(226, 232, 240, 0.5)" },
  searching: { iconName: "search", borderColor: "#334155", textColor: "rgba(226, 232, 240, 0.7)" },
  found_title: { iconName: "search", borderColor: "#1d4ed8", textColor: "rgba(226, 232, 240, 0.8)" },
  loading_chapters: { iconName: "search", borderColor: "#1d4ed8", textColor: "rgba(226, 232, 240, 0.8)" },
  parsing: { iconName: "search", borderColor: "#1d4ed8", textColor: "rgba(226, 232, 240, 0.8)" },
  success: { iconName: "check", borderColor: "#16a34a", textColor: "#4ade80", label: "найдено" },
  not_found: { iconName: "cross", borderColor: "#64748b", textColor: "rgba(226, 232, 240, 0.55)", label: "не найдено" },
  provider_error: { iconName: "cross", borderColor: "#dc2626", textColor: "rgba(226, 232, 240, 0.7)", label: "ошибка" },
};

const DATA_ATTR = "data-rre-control";

export const createStatusBlock = (initialPhase: "connecting" | "searching"): HTMLElement => {
  const config = PHASE_CONFIG[initialPhase];

  const block = document.createElement("div");
  block.setAttribute(DATA_ATTR, "premium-free-status-block");
  block.setAttribute("data-rre-phase", initialPhase);
  block.style.display = "flex";
  block.style.flexDirection = "column";
  block.style.alignItems = "center";
  block.style.gap = "8px";
  block.style.padding = "32px 24px";

  const iconContainer = document.createElement("div");
  iconContainer.setAttribute(DATA_ATTR, "premium-free-status-icon");
  iconContainer.style.borderColor = config.borderColor;
  iconContainer.style.backgroundColor = config.bgColor;

  const iconInner = document.createElement("div");
  iconInner.setAttribute(DATA_ATTR, "premium-free-status-icon-inner");
  iconInner.setAttribute("data-rre-icon-active", "true");
  iconInner.append(createIconSvg(config.iconName, 28));
  iconContainer.append(iconInner);

  const title = document.createElement("div");
  title.setAttribute(DATA_ATTR, "premium-free-title");
  title.textContent = config.text;
  title.style.fontSize = "14px";
  title.style.fontWeight = "600";
  title.style.color = "rgba(226, 232, 240, 0.88)";
  title.style.textAlign = "center";

  const chips = document.createElement("div");
  chips.setAttribute(DATA_ATTR, "premium-free-provider-chips");
  chips.style.display = initialPhase === "connecting" ? "none" : "flex";

  block.append(iconContainer, title, chips);
  return block;
};

export const updateStatusBlock = (
  block: HTMLElement,
  update: StatusBlockUpdate,
): void => {
  const prevPhase = block.getAttribute("data-rre-phase");
  const config = PHASE_CONFIG[update.phase];

  block.setAttribute("data-rre-phase", update.phase);

  const iconContainer = block.querySelector<HTMLElement>(`[${DATA_ATTR}="premium-free-status-icon"]`);
  const title = block.querySelector<HTMLElement>(`[${DATA_ATTR}="premium-free-title"]`);

  if (iconContainer) {
    iconContainer.style.borderColor = config.borderColor;
    iconContainer.style.backgroundColor = config.bgColor;

    const currentIcon = iconContainer.querySelector<HTMLElement>(`[${DATA_ATTR}="premium-free-status-icon-inner"]`);

    if (currentIcon) {
      if (prevPhase !== update.phase) {
        const oldInner = iconContainer.querySelector<HTMLElement>(`[${DATA_ATTR}="premium-free-status-icon-inner"][data-rre-icon-active="true"]`);
        if (oldInner) {
          oldInner.setAttribute("data-rre-icon-active", "false");
        }
        const newInner = document.createElement("div");
        newInner.setAttribute(DATA_ATTR, "premium-free-status-icon-inner");
        newInner.setAttribute("data-rre-icon-active", "false");
        newInner.append(createIconSvg(config.iconName, 28));
        iconContainer.append(newInner);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            newInner.setAttribute("data-rre-icon-active", "true");
          });
        });
        setTimeout(() => oldInner?.remove(), 500);
      }
    }
  }

  if (title) {
    title.textContent = config.text;
  }

  const chips = block.querySelector<HTMLElement>(`[${DATA_ATTR}="premium-free-provider-chips"]`);
  if (chips) {
    if (update.phase === "connecting") {
      chips.style.display = "none";
    } else {
      chips.style.display = "flex";
      renderProviderChips(chips, update.providers);
    }
  }
};

const renderProviderChips = (container: HTMLElement, providers: ProviderChipInfo[]): void => {
  const existing = new Map<string, HTMLElement>();
  for (const chip of container.querySelectorAll<HTMLElement>(`[${DATA_ATTR}="premium-free-chip"]`)) {
    existing.set(chip.getAttribute("data-rre-provider") ?? "", chip);
  }

  for (const provider of providers) {
    const chipConfig = CHIP_STATUS_CONFIG[provider.status] ?? CHIP_STATUS_CONFIG.pending;
    let chip = existing.get(provider.name);

    if (!chip) {
      chip = document.createElement("div");
      chip.setAttribute(DATA_ATTR, "premium-free-chip");
      chip.setAttribute("data-rre-provider", provider.name);

      const iconSpan = document.createElement("span");
      iconSpan.setAttribute(DATA_ATTR, "premium-free-chip-icon");
      iconSpan.append(createChipIconSvg("search"));
      chip.append(iconSpan);

      const nameSpan = document.createElement("span");
      nameSpan.setAttribute(DATA_ATTR, "premium-free-chip-name");
      chip.append(nameSpan);
      container.append(chip);
    }

    chip.style.borderColor = chipConfig.borderColor;
    chip.style.color = chipConfig.textColor;

    const iconSpan = chip.querySelector(`[${DATA_ATTR}="premium-free-chip-icon"]`);
    if (iconSpan) {
      const currentSvg = iconSpan.querySelector("svg");
      const desiredIcon = chipConfig.iconName;
      if (currentSvg && currentSvg.getAttribute("data-rre-chip-icon") !== desiredIcon) {
        const newSvg = createChipIconSvg(desiredIcon);
        newSvg.setAttribute("data-rre-chip-icon", desiredIcon);
        currentSvg.replaceWith(newSvg);
      } else if (!currentSvg) {
        const newSvg = createChipIconSvg(desiredIcon);
        newSvg.setAttribute("data-rre-chip-icon", desiredIcon);
        iconSpan.append(newSvg);
      }
    }

    const nameSpan = chip.querySelector(`[${DATA_ATTR}="premium-free-chip-name"]`);
    if (nameSpan) {
      const label = chipConfig.label
        ? `${provider.displayName} \u2014 ${chipConfig.label}`
        : provider.displayName;
      nameSpan.textContent = label;
    }

    existing.delete(provider.name);
  }

  for (const stale of existing.values()) {
    stale.remove();
  }
};

export const createMiniStatusBlock = (): HTMLElement => {
  const block = document.createElement("div");
  block.setAttribute(DATA_ATTR, "premium-free-stream-loader");
  block.style.display = "inline-flex";
  block.style.alignItems = "center";
  block.style.justifyContent = "center";
  block.style.gap = "8px";
  block.style.margin = "24px auto 32px";
  block.style.padding = "12px 18px";
  block.style.borderRadius = "9999px";
  block.style.background = "rgba(15, 23, 42, 0.74)";
  block.style.color = "rgba(226, 232, 240, 0.88)";
  block.style.fontSize = "13px";
  block.style.lineHeight = "1.4";

  const iconWrapper = document.createElement("span");
  iconWrapper.setAttribute(DATA_ATTR, "mini-status-icon");
  iconWrapper.style.width = "20px";
  iconWrapper.style.height = "20px";
  iconWrapper.style.display = "flex";
  iconWrapper.style.alignItems = "center";
  iconWrapper.style.justifyContent = "center";
  iconWrapper.append(createIconSvg("search", 20));
  block.append(iconWrapper);

  const text = document.createElement("span");
  text.setAttribute(DATA_ATTR, "mini-status-text");
  text.textContent = "Ищем следующую главу\u2026";
  block.append(text);

  const miniChips = document.createElement("span");
  miniChips.setAttribute(DATA_ATTR, "mini-status-chips");
  miniChips.style.display = "inline-flex";
  miniChips.style.gap = "4px";
  miniChips.style.marginLeft = "4px";
  block.append(miniChips);

  return block;
};

export const updateMiniStatusBlock = (
  block: HTMLElement,
  update: { phase: "connecting" | "searching" | "found" | "not_found" | "parser_down"; providers: ProviderChipInfo[] },
): void => {
  const iconWrapper = block.querySelector<HTMLElement>(`[${DATA_ATTR}="mini-status-icon"]`);
  const text = block.querySelector<HTMLElement>(`[${DATA_ATTR}="mini-status-text"]`);
  const miniChips = block.querySelector<HTMLElement>(`[${DATA_ATTR}="mini-status-chips"]`);

  const config = PHASE_CONFIG[update.phase];

  if (iconWrapper) {
    const oldSvg = iconWrapper.querySelector("svg");
    const newSvg = createIconSvg(config.iconName, 20);
    oldSvg?.remove();
    iconWrapper.append(newSvg);
  }

  if (text) {
    switch (update.phase) {
      case "connecting":
        text.textContent = "Подключение\u2026";
        break;
      case "searching":
        text.textContent = "Ищем следующую главу\u2026";
        break;
      case "found":
        text.textContent = "Глава найдена";
        break;
          case "not_found":
            text.textContent = "Глава не найдена";
            break;
          case "parser_down":
            text.textContent = "Парсер не запущен";
            break;
        }
      }

  if (miniChips && update.phase === "searching") {
    renderMiniChips(miniChips, update.providers);
  }
};

const renderMiniChips = (container: HTMLElement, providers: ProviderChipInfo[]): void => {
  container.replaceChildren();
  for (const provider of providers) {
    if (provider.status === "pending" || provider.status === "searching") continue;
    const chipConfig = CHIP_STATUS_CONFIG[provider.status] ?? CHIP_STATUS_CONFIG.pending;
    const dot = document.createElement("span");
    dot.style.display = "inline-block";
    dot.style.width = "8px";
    dot.style.height = "8px";
    dot.style.borderRadius = "50%";
    dot.style.backgroundColor = chipConfig.borderColor;
    dot.title = provider.displayName;
    container.append(dot);
  }
};
