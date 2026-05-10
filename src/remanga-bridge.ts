// Remanga content-script bridge: reads bookmark category names from the user's
// bookmarks page DOM. Triggered via chrome.runtime.onMessage from background.

const READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE = "import-mangalib/read-remanga-bookmark-types";

interface BookmarkType {
  typeId: number;
  name: string;
}

function readBookmarkTypesFromDom(): BookmarkType[] {
  const tabs = Array.from(document.querySelectorAll<HTMLElement>('[role="tab"]'));
  const out: BookmarkType[] = [];
  for (const t of tabs) {
    const m = (t.id || "").match(/trigger-(\d+)/);
    if (!m) continue;
    const typeId = Number(m[1]);
    if (!Number.isFinite(typeId)) continue;
    const text = (t.textContent || "").trim();
    // Strip trailing count digits (e.g. "Читаю4" -> "Читаю")
    const name = text.replace(/\d+$/, "").trim();
    if (!name) continue;
    out.push({ typeId, name });
  }
  return out;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === READ_REMANGA_BOOKMARK_TYPES_MESSAGE_TYPE
  ) {
    sendResponse({ types: readBookmarkTypesFromDom() });
    return true;
  }
  return false;
});
