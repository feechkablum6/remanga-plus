export type ServerStatusState =
  | { kind: "checking" }
  | { kind: "ok"; port: number }
  | { kind: "down" }
  | { kind: "busy" };

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
      label.textContent = `Parser-server :${state.port}`;
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
