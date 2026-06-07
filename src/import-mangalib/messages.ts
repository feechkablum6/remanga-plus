export const CHECK_AUTH_MESSAGE_TYPE = "import-mangalib/check-auth";
export const READ_MANGALIB_TOKEN_MESSAGE_TYPE = "import-mangalib/read-mangalib-token";
export const MANGALIB_PROXIED_FETCH_MESSAGE_TYPE = "import-mangalib/proxied-fetch";
export const READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE = "import-mangalib/read-remanga-bookmark-types";

export interface ReadRemangaBookmarkTypesResponse {
  types: Array<{ typeId: number; name: string }>;
}

export type MangalibProxiedFetchResponse =
  | { ok: true; status: number; httpOk: boolean; body: string }
  | { ok: false; error: string };

export interface CheckAuthRequest {
  type: typeof CHECK_AUTH_MESSAGE_TYPE;
  site: "mangalib" | "remanga";
}

type AuthFailReason = "no-tab" | "no-token" | "unauthorized" | "network" | "no-permission";

export interface CheckAuthResponse {
  signedIn: boolean;
  username?: string;
  userId?: number;
  reason?: AuthFailReason;
}

export interface ReadMangalibTokenResponse {
  token: string | null;
  userId: number | null;
}
