import { type ReadMangalibTokenResponse } from "./import-mangalib/messages.js";

const READ_MANGALIB_TOKEN_MESSAGE_TYPE = "import-mangalib/read-mangalib-token";
const MANGALIB_PROXIED_FETCH_MESSAGE_TYPE = "import-mangalib/proxied-fetch";

function readToken(): ReadMangalibTokenResponse {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return { token: null, userId: null };
    const parsed = JSON.parse(raw) as {
      token?: { access_token?: string };
      auth?: { id?: number };
    };
    const token = parsed?.token?.access_token ?? null;
    const userId =
      typeof parsed?.auth?.id === "number" && parsed.auth.id > 0
        ? parsed.auth.id
        : null;
    if (!token) return { token: null, userId: null };
    return { token, userId };
  } catch {
    return { token: null, userId: null };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === READ_MANGALIB_TOKEN_MESSAGE_TYPE
  ) {
    sendResponse(readToken());
    return true;
  }
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === MANGALIB_PROXIED_FETCH_MESSAGE_TYPE
  ) {
    const m = message as { url: string; headers: Record<string, string> };
    void (async () => {
      try {
        const r = await fetch(m.url, { credentials: "omit", headers: m.headers });
        const body = await r.text();
        sendResponse({ ok: true, status: r.status, httpOk: r.ok, body });
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  }
  return false;
});
