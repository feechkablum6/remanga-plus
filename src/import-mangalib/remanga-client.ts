import type { RemangaCandidate } from "./title-matcher.js";
import type { RemangaChapter } from "./chapter-progress.js";

const REMANGA_API = "https://api.remanga.org";

export type RemangaTokenProvider = () => Promise<string | null>;

export type AuthFailReason = "no-tab" | "no-token" | "unauthorized" | "network";

export interface AuthStatus {
  signedIn: boolean;
  username?: string;
  userId?: number;
  reason?: AuthFailReason;
}

export interface RemangaTitleDetail {
  id: number;
  dir: string;
  activeBranch: number | null;
}

export interface RemangaBookmarkType {
  id: number;
  name: string;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: "bearer " + token,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function getJson<T>(url: string, token: string): Promise<T | null> {
  const r = await fetch(url, { credentials: "omit", headers: headers(token) });
  if (!r.ok) return null;
  return (await r.json()) as T;
}

export async function fetchRemangaAuthStatus(provider: RemangaTokenProvider): Promise<AuthStatus> {
  const token = await provider();
  if (!token) return { signedIn: false, reason: "no-token" };
  try {
    const r = await fetch(`${REMANGA_API}/api/v2/users/current/`, {
      credentials: "omit",
      headers: headers(token),
    });
    if (r.status === 401 || r.status === 403) return { signedIn: false, reason: "unauthorized" };
    if (!r.ok) return { signedIn: false, reason: "network" };
    const body = (await r.json()) as { username?: string; id?: number };
    if (!body?.username) return { signedIn: false, reason: "unauthorized" };
    return {
      signedIn: true,
      username: body.username,
      ...(typeof body.id === "number" ? { userId: body.id } : {}),
    };
  } catch {
    return { signedIn: false, reason: "network" };
  }
}

export async function searchRemanga(
  provider: RemangaTokenProvider,
  query: string,
): Promise<RemangaCandidate[]> {
  const token = await provider();
  if (!token) return [];
  const u = new URL(`${REMANGA_API}/api/v2/search/`);
  u.searchParams.set("query", query);
  u.searchParams.set("count", "5");
  const body = await getJson<{ results?: Array<{ id: number; dir: string; main_name?: string; secondary_name?: string; another_name?: string }> }>(u.toString(), token);
  const list = body?.results ?? [];
  return list.slice(0, 3).map((r) => ({
    id: r.id,
    dir: r.dir,
    main_name: r.main_name ?? "",
    secondary_name: r.secondary_name ?? "",
    another_name: r.another_name ?? "",
  }));
}

export async function fetchRemangaBookmarkTypes(
  provider: RemangaTokenProvider,
): Promise<RemangaBookmarkType[]> {
  const token = await provider();
  if (!token) return [];
  const body = await getJson<{ content?: Array<{ id: number; name: string }> }>(
    `${REMANGA_API}/api/v2/bookmark-types/`,
    token,
  );
  return body?.content ?? [];
}

export async function fetchExistingRemangaBookmarks(
  provider: RemangaTokenProvider,
  userId: number,
): Promise<Set<number>> {
  const token = await provider();
  if (!token) return new Set();
  const out = new Set<number>();
  let page = 1;
  for (;;) {
    const u = new URL(`${REMANGA_API}/api/v2/users/${userId}/bookmarks/`);
    u.searchParams.set("page", String(page));
    const body = await getJson<{ next?: number | null; results?: Array<{ title?: { id?: number } }> }>(u.toString(), token);
    if (!body || !Array.isArray(body.results)) break;
    for (const row of body.results) {
      const id = row.title?.id;
      if (typeof id === "number") out.add(id);
    }
    if (!body.next || body.next <= page) break;
    page = body.next;
  }
  return out;
}

export async function addRemangaBookmark(
  provider: RemangaTokenProvider,
  titleId: number,
  bookmarkTypeId: number,
): Promise<void> {
  const token = await provider();
  if (!token) throw new Error("no remanga token");
  const r = await fetch(`${REMANGA_API}/api/users/bookmarks/`, {
    method: "POST",
    credentials: "omit",
    headers: headers(token),
    body: JSON.stringify({ title: titleId, type: bookmarkTypeId }),
  });
  if (r.status === 400) {
    // Server rejects with messages like "Тайтл уже в этом списке" — treat as benign skip.
    const text = await r.text();
    if (text.includes("уже в этом списке")) return;
    throw new Error("Remanga add bookmark: HTTP 400 " + text.slice(0, 200));
  }
  if (!r.ok) throw new Error("Remanga add bookmark: HTTP " + r.status);
}

export async function fetchRemangaTitleDetail(
  provider: RemangaTokenProvider,
  dir: string,
): Promise<RemangaTitleDetail | null> {
  const token = await provider();
  if (!token) return null;
  const body = await getJson<{ id?: number; dir?: string; active_branch?: number; branches?: Array<{ id: number }> }>(`${REMANGA_API}/api/v2/titles/${dir}/`, token);
  if (!body || !body.id) return null;
  const activeBranch = typeof body.active_branch === "number" ? body.active_branch : body.branches?.[0]?.id ?? null;
  return { id: body.id, dir: body.dir ?? dir, activeBranch };
}

export async function fetchRemangaChapters(
  provider: RemangaTokenProvider,
  branchId: number,
): Promise<RemangaChapter[]> {
  const token = await provider();
  if (!token) return [];
  const out: RemangaChapter[] = [];
  let page = 1;
  for (;;) {
    const u = new URL(`${REMANGA_API}/api/v2/titles/chapters/`);
    u.searchParams.set("branch_id", String(branchId));
    u.searchParams.set("page", String(page));
    u.searchParams.set("count", "100");
    const body = await getJson<{ next?: number | null; results?: Array<{ id: number; index: number | string; chapter?: string }> }>(u.toString(), token);
    if (!body || !Array.isArray(body.results)) break;
    for (const ch of body.results) {
      const idx = typeof ch.index === "number" ? ch.index : Number(ch.index ?? ch.chapter ?? NaN);
      out.push({ id: ch.id, index: idx });
    }
    if (!body.next || body.next <= page) break;
    page = body.next;
  }
  return out;
}
