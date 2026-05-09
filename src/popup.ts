import {
  loadSettings,
  saveSettings,
  type HeaderButtonKey,
  type ReaderEnhancerSettings,
} from "./settings.js";
import {
  RESTART_PARSER_SERVER_MESSAGE_TYPE,
  STATUS_PARSER_SERVER_MESSAGE_TYPE,
  isParserServerStatus,
  type ParserServerStatus,
} from "./parser-server.js";

const STATUS_POLL_MS = 5000;

const HEADER_BUTTON_LABELS: ReadonlyArray<[HeaderButtonKey, string]> = [
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

const HOME_TOGGLES: ReadonlyArray<{ key: "hideHomeGameBanner"; label: string }> = [
  { key: "hideHomeGameBanner", label: "Скрыть баннер игры" },
];

void main();

async function main(): Promise<void> {
  const settings = await loadSettings();

  renderVersionChip();
  renderHeaderToggles(settings);
  renderHomeToggles(settings);
  bindRestartButton();
  startStatusPolling();
}

function startStatusPolling(): void {
  void refreshServerStatus();
  window.setInterval(() => {
    void refreshServerStatus();
  }, STATUS_POLL_MS);
}

function refreshServerStatus(): Promise<void> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: STATUS_PARSER_SERVER_MESSAGE_TYPE },
      (response: unknown) => {
        void chrome.runtime?.lastError;
        renderServerStatus(
          isParserServerStatus(response) ? response : { status: "down" },
        );
        resolve();
      },
    );
  });
}

function renderServerStatus(status: ParserServerStatus): void {
  const root = document.querySelector<HTMLElement>("[data-server-status]");
  const label = document.querySelector<HTMLElement>("[data-server-label]");
  if (!root || !label) return;

  if (status.status === "ok") {
    root.dataset.state = "ok";
    label.textContent = `Parser-server работает на :${status.port}`;
  } else {
    root.dataset.state = "down";
    label.textContent = "Parser-server не запущен";
  }
}

function renderVersionChip(): void {
  const chip = document.querySelector<HTMLElement>(".header__chip");
  if (!chip) return;
  const version = chrome.runtime?.getManifest?.().version;
  if (version) chip.textContent = `v${version}`;
}

function renderHeaderToggles(settings: ReaderEnhancerSettings): void {
  const group = document.querySelector<HTMLElement>(
    '[data-toggle-group="hideHeaderButtons"]',
  );
  if (!group) return;

  HEADER_BUTTON_LABELS.forEach(([key, label], index) => {
    group.appendChild(
      buildToggle({
        label,
        checked: settings.hideHeaderButtons[key],
        delayMs: 180 + index * 25,
        onChange: async (checked) => {
          const current = await loadSettings();
          current.hideHeaderButtons = {
            ...current.hideHeaderButtons,
            [key]: checked,
          };
          await saveSettings(current);
        },
      }),
    );
  });
}

function renderHomeToggles(settings: ReaderEnhancerSettings): void {
  const group = document.querySelector<HTMLElement>(
    '[data-toggle-group="home"]',
  );
  if (!group) return;

  HOME_TOGGLES.forEach(({ key, label }, index) => {
    group.appendChild(
      buildToggle({
        label,
        checked: settings[key],
        delayMs: 250 + index * 25,
        onChange: async (checked) => {
          const current = await loadSettings();
          current[key] = checked;
          await saveSettings(current);
        },
      }),
    );
  });
}

function buildToggle(options: {
  label: string;
  checked: boolean;
  delayMs?: number;
  onChange: (checked: boolean) => void | Promise<void>;
}): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "toggle";
  if (typeof options.delayMs === "number") {
    wrapper.style.animationDelay = `${options.delayMs}ms`;
  }

  const text = document.createElement("span");
  text.className = "toggle__label";
  text.textContent = options.label;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = options.checked;

  const switchEl = document.createElement("span");
  switchEl.className = "toggle__switch";

  input.addEventListener("change", () => {
    void options.onChange(input.checked);
  });

  wrapper.append(text, input, switchEl);
  return wrapper;
}

function bindRestartButton(): void {
  const button = document.querySelector<HTMLButtonElement>(
    'button[data-action="restart-parser"]',
  );
  const status = document.querySelector<HTMLElement>("[data-status]");
  if (!button || !status) return;

  button.addEventListener("click", () => {
    button.dataset.state = "busy";
    status.textContent = "Перезапуск…";

    chrome.runtime.sendMessage(
      { type: RESTART_PARSER_SERVER_MESSAGE_TYPE },
      (response: unknown) => {
        const error = chrome.runtime?.lastError?.message;
        if (error || !isReady(response)) {
          button.dataset.state = "error";
          status.textContent = error ?? describeFailure(response);
          window.setTimeout(() => {
            button.dataset.state = "";
            status.textContent = "";
          }, 3500);
          return;
        }

        button.dataset.state = "";
        status.textContent = "Готово";
        const port = extractPort(response);
        if (port !== null) {
          renderServerStatus({ status: "ok", port });
        }
        window.setTimeout(() => {
          status.textContent = "";
          void refreshServerStatus();
        }, 1500);
      },
    );
  });
}

function extractPort(response: unknown): number | null {
  if (
    response &&
    typeof response === "object" &&
    "port" in response &&
    typeof (response as { port: unknown }).port === "number"
  ) {
    return (response as { port: number }).port;
  }
  return null;
}

function isReady(response: unknown): boolean {
  return (
    response !== null &&
    typeof response === "object" &&
    "status" in response &&
    (response as { status: unknown }).status === "ready"
  );
}

function describeFailure(response: unknown): string {
  if (
    response &&
    typeof response === "object" &&
    "detail" in response &&
    typeof (response as { detail: unknown }).detail === "string"
  ) {
    return (response as { detail: string }).detail;
  }
  return "Не удалось перезапустить parser-server";
}
