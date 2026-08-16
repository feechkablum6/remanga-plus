export type ServerStatusState =
  | { kind: "checking" }
  /** `port` for the local server, `host` for a self-hosted one. */
  | { kind: "ok"; port?: number; host?: string }
  | { kind: "down" }
  | { kind: "busy" };

const describeReady = (state: { port?: number; host?: string }): string => {
  if (state.host) {
    return `Свой сервер · ${state.host}`;
  }
  return state.port ? `Parser-server :${state.port}` : "Parser-server работает";
};

export function renderServerStatus(doc: Document, state: ServerStatusState): void {
  const row = doc.querySelector<HTMLElement>("[data-server-status]");
  const label = doc.querySelector<HTMLElement>("[data-server-label]");
  const btn = doc.querySelector<HTMLElement>("[data-server-restart]");
  if (!row || !label || !btn) return;

  switch (state.kind) {
    case "checking":
      row.dataset.state = "checking";
      label.textContent = "Проверка…";
      btn.setAttribute("hidden", "");
      delete btn.dataset.state;
      break;
    case "ok":
      row.dataset.state = "ok";
      label.textContent = describeReady(state);
      btn.setAttribute("hidden", "");
      delete btn.dataset.state;
      break;
    case "down":
      row.dataset.state = "down";
      label.textContent = "Parser-server не запущен";
      btn.removeAttribute("hidden");
      delete btn.dataset.state;
      break;
    case "busy":
      btn.removeAttribute("hidden");
      btn.dataset.state = "busy";
      break;
  }
}

export function wireRestartButton(doc: Document, handler: () => void): void {
  const btn = doc.querySelector<HTMLElement>("[data-server-restart]");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (btn.dataset.state === "busy") return;
    handler();
  });
}
