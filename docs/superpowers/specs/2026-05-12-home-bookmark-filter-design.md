# Home Bookmark Filter — Design Spec

## Goal

Hide title cards on the ReManga home page when the user has those titles in selected bookmark categories. Initially supports 6 fixed categories; will be extended to dynamic categories later.

## User-Facing Behavior

- A master toggle "Фильтровать закладки на главной" appears in the "ГЛАВНАЯ СТРАНИЦА" subsection of the "Сайт" settings card.
- When the master toggle is ON, 6 category sub-toggles appear (collapsed by default):
  - Читаю
  - Буду читать
  - Прочитано
  - Брошено
  - Не интересно
  - Любимое
- Each sub-toggle controls whether titles in that category are hidden on the home page.
- All toggles default to OFF.
- When ON, matching title cards get `display: none` — they are completely invisible.
- The filter only applies on the home page (`remanga.org/` root), not in the catalog.
- If the user is not signed in, the feature silently does nothing.

## Architecture

### Data Flow

```
Content script (home page)
  ├── on load / on refresh / on settings change
  │   → checks settings: master toggle ON + any category ON?
  │   → sends message to background: "load bookmarks for categories X, Y, Z"
  │   → background loads from ReManga API or cache
  │   → background returns { [dir]: Set<categoryId> }
  │   → content script scans DOM for <a href="/manga/{dir}/...">
  │   → hides cards whose dir matches a filtered category
  └── MutationObserver (already in content.ts)
      → applies filter to newly added cards
```

### Bookmark Data Loading

- **Background** owns the API call and caching.
- Request: `{ type: "load-home-bookmarks" }` (no category list — background fetches ALL bookmarks, content script filters by category key)
- Response: `{ dirs: Record<string, string[]> }` — maps each title `dir` to the list of bookmark-category keys it belongs to (e.g. `{ "onepunchman": ["reading", "favorite"] }`). Key mapping uses name-to-key resolution from `BOOKMARK_CATEGORIES` against the API-returned category names.
- Cache: `chrome.storage.local` key `"rre:homeBookmarkDirs"`, shape `{ dirs: Record<string, string[]>; userId: number; updatedAt: number }`, TTL 30 minutes.
- On cache miss or expiry:
  1. Background fetches bookmark types via `/api/v2/bookmark-types/` to build a name→key map.
  2. Background calls `https://api.remanga.org/api/v2/users/{userId}/bookmarks/?page=N` with auth token to fetch all bookmarks.
  3. Each bookmark's `type` (ID) is mapped to a key via the name→key map.
  4. Each bookmark's `title.dir` (slug) is recorded under that key.
- This approach means we fetch all bookmarks once, and let the content script decide which categories to filter based on current settings — no re-fetch needed when toggling categories.
- Auth token obtained via existing `readRemangaAuthToken` in `background.ts`.
- User ID obtained from `/api/v2/users/current/` (already in `fetchRemangaAuthStatus`).

### Card Matching

- On the home page, title cards are `<a>` elements with `href="/manga/{dir}/..."`.
- Extract `dir` from the href: `/^\/manga\/([^/]+)/`.
- A card is hidden when its `dir` appears in the filtered set AND the category it belongs to has its toggle ON.

### New Settings

```typescript
filterHomeBookmarks: boolean;  // master toggle, default false
filterBookmarkCategories: Record<string, boolean>;  // keyed by category key (reading, planned, etc.), default all false
```

Fixed category definition (for the initial implementation):

```typescript
const BOOKMARK_CATEGORIES = [
  { name: "Читаю", key: "reading" },
  { name: "Буду читать", key: "planned" },
  { name: "Прочитано", key: "completed" },
  { name: "Брошено", key: "dropped" },
  { name: "Не интересно", key: "notInterest" },
  { name: "Любимое", key: "favorite" },
];
```

The `key` field is the settings key. Category IDs (`typeId`) are NOT hardcoded — they are resolved at runtime by matching category names from the ReManga API (`/api/v2/bookmark-types/`) against the names above. This avoids breakage if ReManga changes IDs, supports the dynamic/custom category extension, and correctly maps "Любимое" which may be a bookmark type rather than a separate favorites list.

### Files to Change

| File | Change |
|---|---|
| `src/bookmark-filter.ts` | **New** — content-script logic: request bookmarks from background, match cards, hide/unhide |
| `src/home-enhancer.ts` | Add `applyBookmarkFilter()` call inside `applyHomeEnhancements()` |
| `src/settings.ts` | Add `filterHomeBookmarks` and `filterBookmarkCategories` to `ReaderEnhancerSettings` |
| `src/popup-categories.ts` | Add master toggle + category sub-toggles to `siteToggles` under "ГЛАВНАЯ СТРАНИЦА" |
| `src/content.ts` | Add bookmark dirs to module-level state, pass into `applyHomeEnhancements`; wire refresh on settings change |
| `src/background.ts` | Add handler for `"load-home-bookmarks"` message type; load/clear bookmarks from API/cache |

### Settings UI

The master toggle appears as a regular toggle row:

- **"Фильтровать закладки на главной"** → `filterHomeBookmarks`

When ON, a collapsible subsection "КАТЕГОРИИ ЗАКЛАДОК" appears under it with 6 sub-toggles:

- **"Читаю"** → `filterBookmarkCategories.reading`
- **"Буду читать"** → `filterBookmarkCategories.planned`
- **"Прочитано"** → `filterBookmarkCategories.completed`
- **"Брошено"** → `filterBookmarkCategories.dropped`
- **"Не интересно"** → `filterBookmarkCategories.notInterest`
- **"Любимое"** → `filterBookmarkCategories.favorite`

These follow the same collapsed-by-default pattern as "Скрывать боковую панель" sub-toggles in the reader drawer.

### Error Handling

- Not signed in → feature does nothing, no error shown.
- API unreachable → use stale cache if available; otherwise skip silently.
- No matching cards on page → no-op.

### Future Extension

Replace `BOOKMARK_CATEGORIES` hardcoded list with dynamic categories fetched via `resolveRemangaBookmarkTypes`. The settings keys will remain stable string identifiers; only the label text and IDs will update dynamically.