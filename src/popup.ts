import {
  loadSettings,
  saveSettings,
  watchSettings,
  type ReaderEnhancerSettings,
} from "./settings.js";
import {
  createPopupRouter,
  type PopupRouter,
  type PopupScreen,
} from "./popup-router.js";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  countCategoryToggles,
  type ToggleDescriptor,
  type CategoryKey,
  type SiteSubsection,
} from "./popup-categories.js";
import {
  renderServerStatus,
  wireRestartButton,
  type ServerStatusState,
} from "./popup-service-status.js";
import {
  RESTART_PARSER_SERVER_MESSAGE_TYPE,
  STATUS_PARSER_SERVER_MESSAGE_TYPE,
  isParserServerStatus,
} from "./parser-server.js";
import { renderAuthRow, type AuthState } from "./popup-auth-row.js";
import {
  CHECK_AUTH_MESSAGE_TYPE,
  type CheckAuthRequest,
  type CheckAuthResponse,
} from "./import-mangalib/messages.js";

type CommitSettings = (next: ReaderEnhancerSettings) => Promise<void>;

const STATUS_POLL_MS = 5000;

if (typeof document !== "undefined") void main();

async function main(): Promise<void> {
  const settings = await loadSettings();
  const router = createPopupRouter();

  renderVersionChip();
  wireScreenVisibility(document, router);
  wireCardNavigation(document, router);
  wireBackButtons(document, router);
  renderCardSubtitles(document);

  const commit: CommitSettings = async (next) => {
    await saveSettings(next);
  };
  renderToggles(document, settings, commit);
  watchSettings((next) => renderToggles(document, next, commit));

  renderServerStatus(document, { kind: "checking" });
  wireRestart();
  startServerStatusPolling();
  void wireAuthRow();
}

function startServerStatusPolling(): void {
  void refreshServerStatus();
  setInterval(() => void refreshServerStatus(), STATUS_POLL_MS);
}

function refreshServerStatus(): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: STATUS_PARSER_SERVER_MESSAGE_TYPE },
      (response: unknown) => {
        void chrome.runtime?.lastError;
        renderServerStatus(document, mapStatus(response));
        resolve();
      },
    );
  });
}

function mapStatus(response: unknown): ServerStatusState {
  if (!isParserServerStatus(response)) return { kind: "down" };
  return response.status === "ok"
    ? { kind: "ok", port: response.port }
    : { kind: "down" };
}

function wireRestart(): void {
  wireRestartButton(document, () => {
    renderServerStatus(document, { kind: "busy" });
    chrome.runtime.sendMessage(
      { type: RESTART_PARSER_SERVER_MESSAGE_TYPE },
      (response: unknown) => {
        void chrome.runtime?.lastError;
        if (isParserServerStatus(response) && response.status === "ok") {
          renderServerStatus(document, { kind: "ok", port: response.port });
        } else {
          renderServerStatus(document, { kind: "down" });
        }
      },
    );
  });
}

async function wireAuthRow(): Promise<void> {
  renderAuthRow(document, { mangalib: "checking", remanga: "checking" });
  const [mangalib, remanga] = await Promise.all([
    checkAuth("mangalib"),
    checkAuth("remanga"),
  ]);
  renderAuthRow(document, { mangalib, remanga });
}

function checkAuth(site: "mangalib" | "remanga"): Promise<AuthState> {
  return new Promise((resolve) => {
    const req: CheckAuthRequest = { type: CHECK_AUTH_MESSAGE_TYPE, site };
    chrome.runtime.sendMessage(req, (response: unknown) => {
      void chrome.runtime?.lastError;
      if (response && typeof response === "object" && "signedIn" in response) {
        resolve((response as CheckAuthResponse).signedIn ? "ok" : "bad");
      } else {
        resolve("bad");
      }
    });
  });
}

export function wireScreenVisibility(doc: Document, router: PopupRouter): void {
  const apply = (screen: PopupScreen): void => {
    for (const section of doc.querySelectorAll<HTMLElement>("[data-screen]")) {
      const key = section.dataset.screen as PopupScreen;
      if (key === screen) section.removeAttribute("hidden");
      else section.setAttribute("hidden", "");
    }
  };
  apply(router.current());
  router.subscribe(apply);
}

export function wireCardNavigation(doc: Document, router: PopupRouter): void {
  for (const card of doc.querySelectorAll<HTMLElement>("[data-card]")) {
    const key = card.dataset.card as PopupScreen;
    card.addEventListener("click", () => router.navigate(key));
  }
}

export function wireBackButtons(doc: Document, router: PopupRouter): void {
  for (const btn of doc.querySelectorAll<HTMLElement>("[data-back]")) {
    btn.addEventListener("click", () => router.back());
  }
}

export function renderCardSubtitles(doc: Document): void {
  for (const key of CATEGORY_KEYS) {
    const el = doc.querySelector<HTMLElement>(`[data-card-subtitle="${key}"]`);
    if (!el) continue;
    el.textContent = formatCount(countCategoryToggles(key));
  }
}

function formatCount(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${n} настроек`;
  if (last === 1) return `${n} настройка`;
  if (last >= 2 && last <= 4) return `${n} настройки`;
  return `${n} настроек`;
}

function renderVersionChip(): void {
  const chip = document.querySelector<HTMLElement>(".header__chip");
  if (!chip) return;
  const version = chrome.runtime?.getManifest?.().version;
  if (version) chip.textContent = `v${version}`;
}

export function renderToggles(
  doc: Document,
  settings: ReaderEnhancerSettings,
  commit: CommitSettings,
): void {
  for (const key of CATEGORY_KEYS) {
    const container = doc.querySelector<HTMLElement>(`[data-toggle-list="${key}"]`);
    if (!container) continue;
    container.replaceChildren(...buildToggles(doc, key, settings, commit));
  }
}

function buildToggles(
  doc: Document,
  key: CategoryKey,
  settings: ReaderEnhancerSettings,
  commit: CommitSettings,
): Node[] {
  const toggles = CATEGORIES[key].toggles;
  const nodes: Node[] = [];
  let lastSubsection: SiteSubsection | undefined = undefined;

  for (const toggle of toggles) {
    if (toggle.subsection && toggle.subsection !== lastSubsection) {
      const heading = doc.createElement("h3");
      heading.className = "drill-subheading";
      heading.textContent = toggle.subsection;
      nodes.push(heading);
      lastSubsection = toggle.subsection;
    }
    nodes.push(buildToggleRow(doc, toggle, settings, commit));
  }
  return nodes;
}

function buildToggleRow(
  doc: Document,
  toggle: ToggleDescriptor,
  settings: ReaderEnhancerSettings,
  commit: CommitSettings,
): HTMLLabelElement {
  const wrapper = doc.createElement("label");
  wrapper.className = "toggle";

  const body = doc.createElement("span");
  body.className = "toggle__body";

  const labelText = doc.createElement("span");
  labelText.className = "toggle__label";
  labelText.textContent = toggle.label;
  body.appendChild(labelText);

  if (toggle.caption) {
    const cap = doc.createElement("span");
    cap.className = "toggle__caption";
    cap.textContent = toggle.caption;
    body.appendChild(cap);
  }

  const input = doc.createElement("input");
  input.type = "checkbox";
  input.checked = readToggleValue(settings, toggle);

  const switchEl = doc.createElement("span");
  switchEl.className = "toggle__switch";

  input.addEventListener("change", () => {
    const next = applyToggleChange(settings, toggle, input.checked);
    void commit(next);
  });

  wrapper.append(body, input, switchEl);
  return wrapper;
}

function readToggleValue(s: ReaderEnhancerSettings, toggle: ToggleDescriptor): boolean {
  if (toggle.accessor.kind === "scalar") return s[toggle.accessor.key];
  return s.hideHeaderButtons[toggle.accessor.key];
}

function applyToggleChange(
  s: ReaderEnhancerSettings,
  toggle: ToggleDescriptor,
  next: boolean,
): ReaderEnhancerSettings {
  if (toggle.accessor.kind === "scalar") {
    return { ...s, [toggle.accessor.key]: next };
  }
  return {
    ...s,
    hideHeaderButtons: { ...s.hideHeaderButtons, [toggle.accessor.key]: next },
  };
}
