import { parseMangalibBookmarks } from "./bookmarks-parser.js";
import type { MangalibBookmark } from "./types.js";

const MANGALIB_API_BASE = "https://api.cdnlibs.org";

export interface MangalibToken {
  token: string | null;
  userId: number | null;
}
export type MangalibTokenProvider = () => Promise<MangalibToken>;

export interface AuthStatus {
  signedIn: boolean;
  username?: string;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/json",
    "Site-Id": "1",
  };
}

export async function fetchMangalibAuthStatus(
  tokenProvider: MangalibTokenProvider,
): Promise<AuthStatus> {
  const { token } = await tokenProvider();
  if (!token) return { signedIn: false };
  const r = await fetch(`${MANGALIB_API_BASE}/api/auth/me`, {
    credentials: "omit",
    headers: authHeaders(token),
  });
  if (r.status === 401 || r.status === 403) return { signedIn: false };
  if (!r.ok) return { signedIn: false };
  const body = (await r.json()) as { data?: { username?: string } };
  const username = body?.data?.username;
  if (!username) return { signedIn: false };
  return { signedIn: true, username };
}

export async function fetchMangalibBookmarks(
  tokenProvider: MangalibTokenProvider,
  siteId: number,
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
    const r = await fetch(u, { credentials: "omit", headers: authHeaders(token) });
    if (!r.ok) continue;
    const body = (await r.json()) as unknown;
    all.push(...parseMangalibBookmarks(body));
  }
  return all;
}
