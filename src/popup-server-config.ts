import { normalizeOrigin } from "./settings.js";

export type ServerConfigState = {
  url: string;
  token: string;
};

/**
 * Chrome tears the popup down the moment it loses focus, so waiting for the
 * "change" event (which fires on blur) loses the value the user just typed.
 * Saving on "input" behind a short debounce is what actually persists it.
 */
const SAVE_DEBOUNCE_MS = 250;

const urlInput = (doc: Document): HTMLInputElement | null =>
  doc.querySelector<HTMLInputElement>("[data-server-url]");

const tokenInput = (doc: Document): HTMLInputElement | null =>
  doc.querySelector<HTMLInputElement>("[data-server-token]");

/**
 * Idempotent: skips inputs the user is currently editing so a settings-change
 * re-render never overwrites half-typed text.
 */
export function renderServerConfig(doc: Document, state: ServerConfigState): void {
  const url = urlInput(doc);
  const token = tokenInput(doc);

  if (url && doc.activeElement !== url) {
    url.value = state.url;
    delete url.dataset.state;
  }
  if (token && doc.activeElement !== token) {
    token.value = state.token;
  }
}

export function wireServerConfig(
  doc: Document,
  onCommit: (state: ServerConfigState) => void,
): void {
  const url = urlInput(doc);
  const token = tokenInput(doc);
  if (!url || !token) return;

  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancelPending = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  /**
   * @param rewriteField replace the field with the normalized origin — only safe
   * once the user stopped editing, otherwise it fights with typing.
   */
  const commit = (rewriteField: boolean): void => {
    cancelPending();

    const rawUrl = url.value.trim();
    const normalized = normalizeOrigin(rawUrl);

    if (rawUrl && !normalized) {
      // Half-typed URLs are normal mid-editing; only flag them once settled.
      if (rewriteField) {
        url.dataset.state = "invalid";
      }
      return;
    }

    delete url.dataset.state;
    if (rewriteField) {
      url.value = normalized;
    }
    onCommit({ url: normalized, token: token.value.trim() });
  };

  const scheduleCommit = (): void => {
    cancelPending();
    timer = setTimeout(() => commit(false), SAVE_DEBOUNCE_MS);
  };

  for (const field of [url, token]) {
    field.addEventListener("input", scheduleCommit);
    field.addEventListener("change", () => commit(true));
    field.addEventListener("blur", () => commit(true));
  }

  wirePasteButton(doc, "url", url, commit);
  wirePasteButton(doc, "token", token, commit);
}

const PASTE_FEEDBACK_MS = 1_200;

/**
 * Reaching the clipboard needs the "clipboardRead" permission; without it the
 * read rejects and the button turns red so the user falls back to Ctrl+V.
 */
function wirePasteButton(
  doc: Document,
  target: "url" | "token",
  field: HTMLInputElement,
  commit: (rewriteField: boolean) => void,
): void {
  const button = doc.querySelector<HTMLButtonElement>(
    `[data-server-paste="${target}"]`,
  );
  if (!button) return;

  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  const flash = (state: "done" | "failed"): void => {
    button.dataset.state = state;
    if (feedbackTimer !== null) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => delete button.dataset.state, PASTE_FEEDBACK_MS);
  };

  button.addEventListener("click", () => {
    void (async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (!text.trim()) {
          flash("failed");
          return;
        }
        field.value = text.trim();
        commit(true);
        flash("done");
      } catch {
        flash("failed");
        field.focus();
      }
    })();
  });
}
