import { parseMangalibBookmarks } from "./bookmarks-parser.js";
import type { MangalibBookmark } from "./types.js";

const MANGALIB_API_BASE = "https://api.cdnlibs.org";

type AuthFailReason = "no-tab" | "no-token" | "unauthorized" | "network";

export interface MangalibToken {
  token: string | null;
  userId: number | null;
  reason?: "no-tab" | "no-token";
}
export type MangalibTokenProvider = () => Promise<MangalibToken>;

interface AuthStatus {
  signedIn: boolean;
  username?: string;
  reason?: AuthFailReason;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/json",
    "Site-Id": "1",
  };
}

export interface MangalibResponse {
  status: number;
  ok: boolean;
  json(): Promise<unknown>;
}
export type MangalibFetch = (
  url: string,
  headers: Record<string, string>,
) => Promise<MangalibResponse>;

const defaultFetch: MangalibFetch = async (url, headers) => {
  const r = await fetch(url, { credentials: "omit", headers });
  return {
    status: r.status,
    ok: r.ok,
    json: () => r.json(),
  };
};

export async function fetchMangalibAuthStatus(
  tokenProvider: MangalibTokenProvider,
  customFetch: MangalibFetch = defaultFetch,
): Promise<AuthStatus> {
  const t = await tokenProvider();
  if (!t.token) return { signedIn: false, reason: t.reason ?? "no-token" };
  try {
    const r = await customFetch(`${MANGALIB_API_BASE}/api/auth/me`, authHeaders(t.token));
    if (r.status === 401 || r.status === 403) return { signedIn: false, reason: "unauthorized" };
    if (!r.ok) return { signedIn: false, reason: "network" };
    const body = (await r.json()) as { data?: { username?: string } };
    const username = body?.data?.username;
    if (!username) return { signedIn: false, reason: "unauthorized" };
    return { signedIn: true, username };
  } catch {
    return { signedIn: false, reason: "network" };
  }
}

export async function fetchMangalibBookmarks(
  tokenProvider: MangalibTokenProvider,
  siteId: number,
  customFetch: MangalibFetch = defaultFetch,
): Promise<MangalibBookmark[]> {
  const { token, userId } = await tokenProvider();
  if (!token || !userId) return [];
  const all: MangalibBookmark[] = [];
  for (const status of [1, 2, 3, 4, 5]) {
    const u = new URL(`${MANGALIB_API_BASE}/api/bookmarks`);
    u.searchParams.set("page", "1");
    u.searchParams.set("sort_by", "name");
    u.searchParams.set("sort_type", "desc");
    u.searchParams.set("status", String(status));
    u.searchParams.set("user_id", String(userId));
    void siteId;
    const r = await customFetch(u.toString(), authHeaders(token));
    if (!r.ok) continue;
    const body = (await r.json()) as unknown;
    all.push(...parseMangalibBookmarks(body));
  }
  return all;
}
