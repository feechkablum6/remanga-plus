export type AuthState = "ok" | "bad" | "checking";

export type AuthSnapshot = {
  mangalib: AuthState;
  remanga: AuthState;
};

export function renderAuthRow(doc: Document, snapshot: AuthSnapshot): void {
  setSiteState(doc, "mangalib", snapshot.mangalib);
  setSiteState(doc, "remanga", snapshot.remanga);
  setImportButton(doc, snapshot);
  setHint(doc, snapshot);
}

function setSiteState(doc: Document, site: "mangalib" | "remanga", state: AuthState): void {
  const icon = doc.querySelector<HTMLElement>(`[data-auth-icon="${site}"]`);
  const link = doc.querySelector<HTMLElement>(`[data-auth-link="${site}"]`);
  if (icon) icon.dataset.state = state;
  if (link) link.dataset.state = state;
}

function setImportButton(doc: Document, snapshot: AuthSnapshot): void {
  const btn = doc.querySelector<HTMLButtonElement>("[data-import-button]");
  if (!btn) return;
  btn.disabled = !(snapshot.mangalib === "ok" && snapshot.remanga === "ok");
  const tooltip = computeTooltip(snapshot);
  if (tooltip === "") {
    btn.removeAttribute("title");
  } else {
    btn.title = tooltip;
  }
}

function computeTooltip(s: AuthSnapshot): string {
  if (s.mangalib === "checking" || s.remanga === "checking") return "";
  const mlBad = s.mangalib === "bad";
  const rmBad = s.remanga === "bad";
  if (mlBad && rmBad) return "Войдите в MangaLib и Remanga, чтобы импортировать";
  if (mlBad) return "Войдите в MangaLib, чтобы импортировать";
  if (rmBad) return "Войдите в Remanga, чтобы импортировать";
  return "";
}

function setHint(doc: Document, snapshot: AuthSnapshot): void {
  const hint = doc.querySelector<HTMLElement>("[data-auth-hint]");
  if (!hint) return;
  const text = computeHint(snapshot);
  if (text === null) {
    hint.hidden = true;
    hint.textContent = "";
  } else {
    hint.hidden = false;
    hint.textContent = text;
  }
}

function computeHint(s: AuthSnapshot): string | null {
  if (s.mangalib === "checking" || s.remanga === "checking") return null;
  const mlBad = s.mangalib === "bad";
  const rmBad = s.remanga === "bad";
  if (mlBad && rmBad) return "Войдите в MangaLib и Remanga для импорта";
  if (mlBad) return "Войдите в MangaLib для импорта";
  if (rmBad) return "Войдите в Remanga для импорта";
  return null;
}
