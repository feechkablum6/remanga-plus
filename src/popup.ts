import {
  loadSettings,
  saveSettings,
  type HeaderButtonKey,
  type ReaderEnhancerSettings,
} from "./settings.js";
import { RESTART_PARSER_SERVER_MESSAGE_TYPE } from "./parser-server.js";

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

  renderHeaderToggles(settings);
  renderHomeToggles(settings);
  bindRestartButton();
}

function renderHeaderToggles(settings: ReaderEnhancerSettings): void {
  const group = document.querySelector<HTMLElement>(
    '[data-toggle-group="hideHeaderButtons"]',
  );
  if (!group) return;

  for (const [key, label] of HEADER_BUTTON_LABELS) {
    group.appendChild(
      buildToggle({
        label,
        checked: settings.hideHeaderButtons[key],
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
  }
}

function renderHomeToggles(settings: ReaderEnhancerSettings): void {
  const group = document.querySelector<HTMLElement>(
    '[data-toggle-group="home"]',
  );
  if (!group) return;

  for (const { key, label } of HOME_TOGGLES) {
    group.appendChild(
      buildToggle({
        label,
        checked: settings[key],
        onChange: async (checked) => {
          const current = await loadSettings();
          current[key] = checked;
          await saveSettings(current);
        },
      }),
    );
  }
}

function buildToggle(options: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<void>;
}): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "toggle";

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
        window.setTimeout(() => {
          status.textContent = "";
        }, 2000);
      },
    );
  });
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
