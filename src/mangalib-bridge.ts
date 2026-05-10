import { type ReadMangalibTokenResponse } from "./import-mangalib/messages.js";

const READ_MANGALIB_TOKEN_MESSAGE_TYPE = "import-mangalib/read-mangalib-token";

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
  return false;
});
