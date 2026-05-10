import {
  fetchMangalibBookmarks,
  type MangalibFetch,
  type MangalibTokenProvider,
} from "./import-mangalib/mangalib-client.js";
import {
  searchRemanga,
  fetchExistingRemangaBookmarks,
  fetchRemangaTitleDetail,
  fetchRemangaChapters,
  addRemangaBookmark,
  type RemangaBookmarkType,
  type RemangaTokenProvider,
} from "./import-mangalib/remanga-client.js";
import {
  runImport,
  type PreviewRow,
  type ImportProgress,
  type ExecutionReport,
} from "./import-mangalib/orchestrator.js";
import { saveImportState, clearImportState } from "./import-mangalib/state.js";
import {
  CHECK_AUTH_MESSAGE_TYPE,
  MANGALIB_PROXIED_FETCH_MESSAGE_TYPE,
  READ_MANGALIB_TOKEN_MESSAGE_TYPE,
  READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE,
  type CheckAuthRequest,
  type CheckAuthResponse,
  type MangalibProxiedFetchResponse,
  type ReadMangalibTokenResponse,
  type ReadRemangaBookmarkTypesResponse,
} from "./import-mangalib/messages.js";
import { markRemangaChapterAsViewed } from "./premium-free.js";

void main();

async function main(): Promise<void> {
  await renderAuthStrip();
  const preview = await buildPreviewWithProgress();
  renderPreview(preview);
  bindExecuteButton(preview);
}

function askBackground<T>(message: object): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: unknown) => {
      void chrome.runtime?.lastError;
      resolve((response ?? null) as T | null);
    });
  });
}

const mangalibTokenProvider: MangalibTokenProvider = async () => {
  const r = await askBackground<ReadMangalibTokenResponse>({ type: READ_MANGALIB_TOKEN_MESSAGE_TYPE });
  return r ?? { token: null, userId: null };
};

const mangalibBridgeFetch: MangalibFetch = async (url, headers) => {
  const resp = await askBackground<MangalibProxiedFetchResponse>({
    type: MANGALIB_PROXIED_FETCH_MESSAGE_TYPE,
    url,
    headers,
  });
  if (!resp || !resp.ok) throw new Error("mangalib bridge fetch failed");
  const body = resp.body;
  return {
    status: resp.status,
    ok: resp.httpOk,
    json: async () => JSON.parse(body) as unknown,
  };
};

const remangaTokenProvider: RemangaTokenProvider = async () => {
  const cookies = await chrome.cookies.getAll({ url: "https://remanga.org/" });
  const tokenCookie = cookies.find((c) => c.name === "token");
  return tokenCookie?.value ?? null;
};

let remangaUserId: number | null = null;

const fetchExistingForCurrentUser = async (): Promise<Set<number>> => {
  if (remangaUserId === null) return new Set();
  return fetchExistingRemangaBookmarks(remangaTokenProvider, remangaUserId);
};

const fetchRemangaBookmarkTypesViaBridge = async (): Promise<RemangaBookmarkType[]> => {
  const resp = await askBackground<ReadRemangaBookmarkTypesResponse>({
    type: READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE,
  });
  if (!resp || !Array.isArray(resp.types)) return [];
  return resp.types.map((t) => ({ id: t.typeId, name: t.name }));
};

async function renderAuthStrip(): Promise<void> {
  const set = (site: "mangalib" | "remanga", text: string, state: "ok" | "bad") => {
    const span = document.querySelector<HTMLElement>(`[data-site="${site}"]`);
    if (!span) return;
    span.textContent = text;
    span.dataset.state = state;
  };
  const failText = (site: "mangalib" | "remanga", reason: string | undefined): string => {
    if (reason === "no-permission") return "✗ Переустановите расширение";
    if (reason === "no-tab") return site === "mangalib" ? "✗ Откройте mangalib.me" : "✗ Откройте remanga.org";
    if (reason === "no-token") return "✗ Войдите на сайт";
    if (reason === "unauthorized") return "✗ Войдите снова";
    if (reason === "network") return "✗ Нет сети";
    return "✗ Не авторизован";
  };
  const [m, r] = await Promise.all([
    askBackground<CheckAuthResponse>({ type: CHECK_AUTH_MESSAGE_TYPE, site: "mangalib" } satisfies CheckAuthRequest),
    askBackground<CheckAuthResponse>({ type: CHECK_AUTH_MESSAGE_TYPE, site: "remanga" } satisfies CheckAuthRequest),
  ]);
  set("mangalib", m?.signedIn ? `✓ Вошли как ${m.username ?? ""}` : failText("mangalib", m?.reason), m?.signedIn ? "ok" : "bad");
  set("remanga", r?.signedIn ? `✓ Вошли как ${r.username ?? ""}` : failText("remanga", r?.reason), r?.signedIn ? "ok" : "bad");
  if (typeof r?.userId === "number") remangaUserId = r.userId;
}

async function buildPreviewWithProgress(): Promise<PreviewRow[]> {
  const fetchEl = document.querySelector<HTMLElement>("[data-progress-fetch]");
  const matchEl = document.querySelector<HTMLElement>("[data-progress-match]");
  const onProgress = (p: ImportProgress) => {
    if (p.phase === "fetching" && fetchEl) fetchEl.textContent = `Получаю закладки с MangaLib… ${p.current}`;
    if (p.phase === "matching" && matchEl) matchEl.textContent = `Ищу совпадения на Remanga… ${p.current} / ${p.total}`;
  };

  const deps = {
    fetchBookmarks: () => fetchMangalibBookmarks(mangalibTokenProvider, 1, mangalibBridgeFetch),
    fetchBookmarkTypes: fetchRemangaBookmarkTypesViaBridge,
    fetchExistingBookmarks: fetchExistingForCurrentUser,
    searchRemanga: (q: string) => searchRemanga(remangaTokenProvider, q),
    fetchTitleDetail: (dir: string) => fetchRemangaTitleDetail(remangaTokenProvider, dir),
    fetchChapters: (b: number) => fetchRemangaChapters(remangaTokenProvider, b),
    addBookmark: (titleId: number, typeId: number) => addRemangaBookmark(remangaTokenProvider, titleId, typeId),
    markChapterViewed: async (chapterId: number) => {
      const cookies = await chrome.cookies.getAll({ url: "https://remanga.org/" });
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      await markRemangaChapterAsViewed({ chapterId, cookie: cookieHeader, fetchImpl: fetch });
    },
    sleepMs: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  };

  await saveImportState({ startedAt: Date.now(), phase: "fetching", totalSelected: 0, doneIds: [], failedIds: [] });
  const preview = await runImport.buildPreview(deps, onProgress);
  await saveImportState({
    startedAt: Date.now(), phase: "preview",
    totalSelected: preview.filter((r) => r.selected).length,
    doneIds: [], failedIds: [],
  });
  if (matchEl) matchEl.textContent = `Готово, найдено ${preview.length} записей.`;
  return preview;
}

function renderPreview(preview: PreviewRow[]): void {
  const root = document.querySelector<HTMLElement>("[data-preview-table]");
  if (!root) return;
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>Перенести</th><th>MangaLib</th><th>Категория</th><th>Глава</th><th>Кандидат на Remanga</th></tr>`;
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  for (const row of preview) {
    const tr = document.createElement("tr");
    tr.dataset.kind = row.match.kind;
    tr.dataset.alreadyExists = String(row.alreadyExists);
    const tdSel = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = row.selected;
    cb.disabled = row.match.kind !== "certain" || row.targetBookmarkTypeId === null;
    cb.addEventListener("change", () => { row.selected = cb.checked; updateExecBtn(preview); });
    tdSel.appendChild(cb);
    const tdName = document.createElement("td");
    tdName.textContent = row.bookmark.rusName || row.bookmark.shortName || row.bookmark.slug;
    const tdCat = document.createElement("td");
    tdCat.textContent = row.targetCategoryName + (row.targetBookmarkTypeId === null ? " (категория не найдена)" : "");
    const tdCh = document.createElement("td");
    tdCh.textContent = row.bookmark.lastReadChapter !== null ? String(row.bookmark.lastReadChapter) : "—";
    const tdCand = document.createElement("td");
    tdCand.textContent =
      row.match.kind === "certain"
        ? row.match.chosen.main_name + (row.alreadyExists ? " (уже есть)" : "")
        : row.match.kind === "ambiguous"
          ? row.match.candidates.map((c) => c.main_name).join(" / ")
          : "не нашлось";
    tr.append(tdSel, tdName, tdCat, tdCh, tdCand);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  root.replaceChildren(table);
  updateExecBtn(preview);
}

function updateExecBtn(preview: PreviewRow[]): void {
  const btn = document.querySelector<HTMLButtonElement>("[data-execute-button]");
  if (!btn) return;
  const n = preview.filter((r) => r.selected).length;
  btn.disabled = n === 0;
  btn.textContent = `Перенести отмеченные (${n})`;
}

function bindExecuteButton(preview: PreviewRow[]): void {
  const btn = document.querySelector<HTMLButtonElement>("[data-execute-button]");
  const progressEl = document.querySelector<HTMLElement>("[data-progress-execute]");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const deps = {
      fetchBookmarks: () => fetchMangalibBookmarks(mangalibTokenProvider, 1, mangalibBridgeFetch),
      fetchBookmarkTypes: fetchRemangaBookmarkTypesViaBridge,
      fetchExistingBookmarks: fetchExistingForCurrentUser,
      searchRemanga: (q: string) => searchRemanga(remangaTokenProvider, q),
      fetchTitleDetail: (dir: string) => fetchRemangaTitleDetail(remangaTokenProvider, dir),
      fetchChapters: (b: number) => fetchRemangaChapters(remangaTokenProvider, b),
      addBookmark: (titleId: number, typeId: number) => addRemangaBookmark(remangaTokenProvider, titleId, typeId),
      markChapterViewed: async (chapterId: number) => {
        const cookies = await chrome.cookies.getAll({ url: "https://remanga.org/" });
        const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
        await markRemangaChapterAsViewed({ chapterId, cookie: cookieHeader, fetchImpl: fetch });
      },
      sleepMs: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    };
    const report = await runImport.execute(deps, preview, (p) => {
      if (p.phase === "executing" && progressEl) progressEl.textContent = `Перенос: ${p.current + 1} / ${p.total} — ${p.slug}`;
    });
    renderReport(report);
    await clearImportState();
  });
}

function renderReport(report: ExecutionReport): void {
  const root = document.querySelector<HTMLElement>("[data-report]");
  if (!root) return;
  root.hidden = false;
  root.innerHTML = `
    <h2>Готово</h2>
    <p>Перенесено: <b>${report.added.length}</b></p>
    <p>Пропущено: <b>${report.skipped.length}</b></p>
    <p>Не удалось: <b>${report.failed.length}</b></p>
    ${report.failed.length === 0 ? "" : `<details><summary>Подробности об ошибках</summary><ul>${report.failed.map((f) => `<li>${f.slug}: ${f.reason}</li>`).join("")}</ul></details>`}
  `;
}
