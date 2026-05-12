# Home Bookmark Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Скрывать карточки тайтлов на главной странице ReManga, если они есть в закладках пользователя по выбранным категориям.

**Architecture:** Content script на главной запрашивает данные закладок у background через message passing. Background загружает все закладки из ReManga API, кэширует в `chrome.storage.local`, возвращает content script'у маппинг `dir → [categoryKey]`. Content script скрывает карточки, у которых `dir` совпадает с включённой категорией.

**Tech Stack:** TypeScript, Chrome Extension MV3, chrome.storage.local, chrome.runtime.sendMessage.

---

### Task 1: Типы и константы закладок

**Files:**
- Create: `src/bookmark-filter.ts`

- [ ] **Step 1: Создать `src/bookmark-filter.ts` с типами и категориями**

```typescript
export const BOOKMARK_CATEGORIES = [
  { name: "Читаю", key: "reading" },
  { name: "Буду читать", key: "planned" },
  { name: "Прочитано", key: "completed" },
  { name: "Брошено", key: "dropped" },
  { name: "Не интересно", key: "notInterest" },
  { name: "Любимое", key: "favorite" },
] as const;

export type BookmarkCategoryKey = typeof BOOKMARK_CATEGORIES[number]["key"];

export interface HomeBookmarksCache {
  dirs: Record<string, string[]>;
  userId: number;
  updatedAt: number;
}

export const HOME_BOOKMARKS_CACHE_KEY = "rre:homeBookmarkDirs";
export const HOME_BOOKMARKS_CACHE_TTL_MS = 30 * 60 * 1000;

export const LOAD_HOME_BOOKMARKS_MESSAGE_TYPE = "rre/load-home-bookmarks";

export interface LoadHomeBookmarksResponse {
  dirs: Record<string, string[]>;
}

const MANGA_DIR_PATTERN = /^\/manga\/([^/]+)/;

export function extractDirFromHref(href: string): string | null {
  try {
    const url = new URL(href, "https://remanga.org");
    const match = url.pathname.match(MANGA_DIR_PATTERN);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getFilteredDirs(
  dirs: Record<string, string[]>,
  categories: Record<string, boolean>,
): Set<string> {
  const activeKeys = new Set<string>();
  for (const [key, enabled] of Object.entries(categories)) {
    if (enabled) activeKeys.add(key);
  }
  if (activeKeys.size === 0) return new Set();

  const result = new Set<string>();
  for (const [dir, keys] of Object.entries(dirs)) {
    if (keys.some((k) => activeKeys.has(k))) {
      result.add(dir);
    }
  }
  return result;
}

export function isHomePage(): boolean {
  const path = window.location.pathname;
  return path === "/" || path === "";
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd /Users/a12343/Проекты/extensions/remanga && npm run check`

Expected: компиляция проходит без ошибок.

- [ ] **Step 3: Commit**

```bash
git add src/bookmark-filter.ts
git commit -m "feat: add bookmark filter types and constants"
```

---

### Task 2: Настройки — добавить поля `filterHomeBookmarks` и `filterBookmarkCategories`

**Files:**
- Modify: `src/settings.ts`

- [ ] **Step 1: Добавить типы и дефолты в `settings.ts`**

В `ReaderEnhancerSettings` добавить два поля после `hideHomePromoBanner`:

```typescript
filterHomeBookmarks: boolean;
filterBookmarkCategories: Record<string, boolean>;
```

В `PartialSettings` добавить:

```typescript
filterBookmarkCategories?: Partial<Record<string, boolean>>;
```

В `DEFAULT_SETTINGS` добавить:

```typescript
filterHomeBookmarks: false,
filterBookmarkCategories: {},
```

В `cloneSettings` добавить:

```typescript
filterHomeBookmarks: settings.filterHomeBookmarks,
filterBookmarkCategories: { ...settings.filterBookmarkCategories },
```

В `mergeSettings` добавить:

```typescript
filterHomeBookmarks:
  partialSettings?.filterHomeBookmarks ?? DEFAULT_SETTINGS.filterHomeBookmarks,
filterBookmarkCategories: {
  ...DEFAULT_SETTINGS.filterBookmarkCategories,
  ...partialSettings?.filterBookmarkCategories,
},
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd /Users/a12343/Проекты/extensions/remanga && npm run check`

Expected: OK (новые поля не используются пока — просто типы).

- [ ] **Step 3: Commit**

```bash
git add src/settings.ts
git commit -m "feat: add filterHomeBookmarks and filterBookmarkCategories to settings"
```

---

### Task 3: Popup categories — добавить тогглы в подсекцию «ГЛАВНАЯ СТРАНИЦА»

**Files:**
- Modify: `src/popup-categories.ts`

- [ ] **Step 1: Добавить `BookmarkCategoryKey` accessor kind и тогглы**

В `src/popup-categories.ts`:

1. Импортировать `BOOKMARK_CATEGORIES` и `BookmarkCategoryKey` из `./bookmark-filter.js`.
2. Расширить `ToggleAccessor` — добавить вариант `{ kind: "bookmark-category"; key: BookmarkCategoryKey }`.
3. Добавить в `siteToggles` мастер-тоггл и подкатегории в подсекции «ГЛАВНАЯ СТРАНИЦА»:

```typescript
import { BOOKMARK_CATEGORIES, type BookmarkCategoryKey } from "./bookmark-filter.js";

// В ToggleAccessor добавить:
| { kind: "bookmark-category"; key: BookmarkCategoryKey }
```

В конец `siteToggles` уже есть подсекция «ГЛАВНАЯ СТРАНИЦА». Добавить после промо-плашки:

```typescript
{
  label: "Фильтровать закладки на главной",
  accessor: { kind: "scalar", key: "filterHomeBookmarks" },
  subsection: "ГЛАВНАЯ СТРАНИЦА",
},
...BOOKMARK_CATEGORIES.map(
  ({ name, key }): ToggleDescriptor => ({
    label: name,
    accessor: { kind: "bookmark-category", key: key as BookmarkCategoryKey },
    subsection: "КАТЕГОРИИ ЗАКЛАДОК",
  }),
),
```

4. Обновить `readToggleValue` — добавить обработку `bookmark-category`:

```typescript
if (a.kind === "bookmark-category") return settings.filterBookmarkCategories[a.key] ?? false;
```

5. Обновить `applyToggleChange` — добавить обработку `bookmark-category`:

```typescript
if (a.kind === "bookmark-category") {
  return {
    ...settings,
    filterBookmarkCategories: { ...settings.filterBookmarkCategories, [a.key]: next },
  };
}
```

- [ ] **Step 2: Проверить компиляцию**

Run: `cd /Users/a12343/Проекты/extensions/remanga && npm run check`

Expected: OK.

- [ ] **Step 3: Commit**

```bash
git add src/popup-categories.ts
git commit -m "feat: add bookmark filter toggles to popup categories"
```

---

### Task 4: Background handler — загрузка и кэширование закладок

**Files:**
- Modify: `src/import-mangalib/messages.ts`
- Modify: `src/background.ts`

- [ ] **Step 1: Добавить типы сообщений в `messages.ts`**

В конец `src/import-mangalib/messages.ts` добавить:

```typescript
export const LOAD_HOME_BOOKMARKS_MESSAGE_TYPE = "rre/load-home-bookmarks";

export interface LoadHomeBookmarksResponse {
  dirs: Record<string, string[]>;
}
```

Константа `LOAD_HOME_BOOKMARKS_MESSAGE_TYPE` и тип `LoadHomeBookmarksResponse` уже определены в `bookmark-filter.ts` — импортируем их оттуда, не дублируем в messages.ts.


- [ ] **Step 2: Добавить handler в `background.ts`**

В `src/background.ts`:

1. Импортировать `BOOKMARK_CATEGORIES`, `HOME_BOOKMARKS_CACHE_KEY`, `HOME_BOOKMARKS_CACHE_TTL_MS`, `type HomeBookmarksCache` из `bookmark-filter.js`, а также `fetchRemangaBookmarkTypes`, `fetchExistingRemangaBookmarks` из `remanga-client.js`.
2. Добавить handler для `"rre/load-home-bookmarks"` в `onMessage` listener.

Логика handler'а:

```typescript
if (message.type === LOAD_HOME_BOOKMARKS_MESSAGE_TYPE) {
  void (async () => {
    const dirs = await loadHomeBookmarks();
    sendResponse({ dirs } satisfies LoadHomeBookmarksResponse);
  })();
  return true;
}
```

Функция `loadHomeBookmarks`:

```typescript
async function loadHomeBookmarks(): Promise<Record<string, string[]>> {
  // Попробовать кэш
  const cached = await readHomeBookmarksCache();
  if (cached && Date.now() - cached.updatedAt < HOME_BOOKMARKS_CACHE_TTL_MS) {
    return cached.dirs;
  }

  const token = await getRemangaToken();
  if (!token) return {};

  // Получить userId
  const authStatus = await fetchRemangaAuthStatus(async () => token);
  if (!authStatus.signedIn || typeof authStatus.userId !== "number") {
    // Вернуть просроченный кэш, если есть
    return cached?.dirs ?? {};
  }
  const userId = authStatus.userId;

  // Получить типы закладок для маппинга id → key
  const bookmarkTypes = await fetchRemangaBookmarkTypes(async () => token);
  const nameToKey = new Map<string, string>();
  for (const cat of BOOKMARK_CATEGORIES) {
    nameToKey.set(cat.name.toLowerCase(), cat.key);
  }
  const idToKey = new Map<number, string>();
  for (const bt of bookmarkTypes) {
    const key = nameToKey.get(bt.name.toLowerCase());
    if (key) idToKey.set(bt.id, key);
  }

  // Загрузить все закладки
  const dirs: Record<string, string[]> = {};
  let page = 1;
  for (;;) {
    const u = `${REMANGA_API}/api/v2/users/${userId}/bookmarks/?page=${page}`;
    const r = await fetch(u, { credentials: "omit", headers: { Authorization: "bearer " + token, Accept: "application/json" } });
    if (!r.ok) break;
    const body = await r.json() as { next?: number | null; results?: Array<{ title?: { id?: number; dir?: string }; type?: number }> };
    if (!body || !Array.isArray(body.results)) break;
    for (const row of body.results) {
      const dir = row.title?.dir;
      const typeId = row.type;
      if (typeof dir === "string" && typeof typeId === "number") {
        const key = idToKey.get(typeId);
        if (key) {
          if (!dirs[dir]) dirs[dir] = [];
          if (!dirs[dir].includes(key)) dirs[dir].push(key);
        }
      }
    }
    if (!body.next || body.next <= page) break;
    page = body.next;
  }

  // Кэшировать
  await writeHomeBookmarksCache({ dirs, userId, updatedAt: Date.now() });
  return dirs;
}
```

Функции кэша:

```typescript
async function readHomeBookmarksCache(): Promise<HomeBookmarksCache | null> {
  const area = chrome.storage?.local;
  if (!area) return null;
  return new Promise<HomeBookmarksCache | null>((resolve) => {
    area.get(HOME_BOOKMARKS_CACHE_KEY, (items) => {
      void chrome.runtime?.lastError;
      const raw = items?.[HOME_BOOKMARKS_CACHE_KEY] as HomeBookmarksCache | undefined;
      if (!raw || typeof raw.updatedAt !== "number" || typeof raw.userId !== "number") {
        resolve(null);
        return;
      }
      resolve(raw);
    });
  });
}

async function writeHomeBookmarksCache(cache: HomeBookmarksCache): Promise<void> {
  const area = chrome.storage?.local;
  if (!area) return;
  await new Promise<void>((resolve) => {
    area.set({ [HOME_BOOKMARKS_CACHE_KEY]: cache }, () => {
      void chrome.runtime?.lastError;
      resolve();
    });
  });
}
```

3. Обновить импорт `LOAD_HOME_BOOKMARKS_MESSAGE_TYPE` и `LoadHomeBookmarksResponse` — они живут в `bookmark-filter.ts`, импортируем оттуда. Не дублировать в messages.ts.

- [ ] **Step 3: Проверить компиляцию**

Run: `cd /Users/a12343/Проекты/extensions/remanga && npm run check`

Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/import-mangalib/messages.ts src/background.ts src/bookmark-filter.ts
git commit -m "feat: add home bookmarks loader and cache in background"
```

---

### Task 5: Content script — вызов фильтра и скрытие карточек

**Files:**
- Modify: `src/home-enhancer.ts`
- Modify: `src/content.ts`

- [ ] **Step 1: Добавить `applyBookmarkFilter` в `home-enhancer.ts`**

Добавить в `src/home-enhancer.ts`:

```typescript
import { extractDirFromHref, getFilteredDirs } from "./bookmark-filter.js";
```

Изменить сигнатуру `applyHomeEnhancements` — добавить параметр `filteredDirs`:

```typescript
export function applyHomeEnhancements(
  root: ParentNode,
  settings: ReaderEnhancerSettings,
  filteredDirs: Set<string> | null,
): void {
  const header =
    (root as Element).querySelector?.(
      'header[data-sentry-component="HeaderBase"]',
    ) ?? (root as Element).querySelector?.("header") ?? root;
  applyHeaderButtons(header as ParentNode, settings);
  applyGameBanner(root, settings);
  applyPromoBanner(root, settings);
  applyBookmarkFilter(root, settings, filteredDirs);
}
```

Новая функция `applyBookmarkFilter`:

```typescript
function applyBookmarkFilter(
  root: ParentNode,
  settings: ReaderEnhancerSettings,
  filteredDirs: Set<string> | null,
): void {
  if (!settings.filterHomeBookmarks || !filteredDirs || filteredDirs.size === 0) {
    clearBookmarkFilter(root);
    return;
  }

  const links = (root as Element).querySelectorAll?.('a[href^="/manga/"]') ?? [];
  for (const link of links) {
    if (!(link instanceof HTMLAnchorElement)) continue;
    const dir = extractDirFromHref(link.href);
    if (!dir) continue;

    if (filteredDirs.has(dir)) {
      setHidden(link, "bookmark-filter", true);
    } else {
      setHidden(link, "bookmark-filter", false);
    }
  }
}

function clearBookmarkFilter(root: ParentNode): void {
  const links = (root as Element).querySelectorAll?.('[data-rre-home-hidden="bookmark-filter"]') ?? [];
  for (const link of links) {
    if (link instanceof HTMLElement) {
      setHidden(link, "bookmark-filter", false);
    }
  }
}
```

Примечание: `setHidden` уже существует в `home-enhancer.ts` и работает с `display: none` + `data-rre-home-hidden` атрибутом с ключом. Ключ `"bookmark-filter"` уникален среди существующих ключей.

- [ ] **Step 2: Интегрировать загрузку закладок в `content.ts`**

В `src/content.ts`:

1. Импортировать `LOAD_HOME_BOOKMARKS_MESSAGE_TYPE`, `isHomePage`, `getFilteredDirs`, `type LoadHomeBookmarksResponse` из `./bookmark-filter.js`.
2. Добавить модульную переменную `let homeBookmarkDirs: Record<string, string[]> | null = null;` в `bootstrap()`.
3. Добавить функцию `requestBookmarkDirs`:

```typescript
const requestBookmarkDirs = () => {
  if (!currentSettings.filterHomeBookmarks) {
    homeBookmarkDirs = null;
    return;
  }

  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;

  chrome.runtime.sendMessage(
    { type: LOAD_HOME_BOOKMARKS_MESSAGE_TYPE },
    (response: unknown) => {
      void chrome.runtime?.lastError;
      if (response && typeof response === "object" && "dirs" in response) {
        homeBookmarkDirs = (response as LoadHomeBookmarksResponse).dirs;
        requestRefresh();
      }
    },
  );
};
```

4. Обновить `runRefresh` — передать `filteredDirs`:

```typescript
const runRefresh = () => {
  const filteredDirs = homeBookmarkDirs && currentSettings.filterHomeBookmarks
    ? getFilteredDirs(homeBookmarkDirs, currentSettings.filterBookmarkCategories)
    : null;

  applyHomeEnhancements(document, currentSettings, filteredDirs);

  if (!isReaderPage()) {
    clearEnhancerArtifacts();
    return;
  }

  triggerPrefetchForCurrentUrl();
  syncReaderEnhancer({
    settings: currentSettings,
    commitSettings,
  });
};
```

5. Вызвать `requestBookmarkDirs()` при инициализации и в `watchSettings` когда `filterHomeBookmarks` включается:

В конце `bootstrap()`, после `requestRefresh()`:
```typescript
requestBookmarkDirs();
```

В `watchSettings` callback, добавить:
```typescript
if (!previousFilterHomeBookmarks && currentSettings.filterHomeBookmarks) {
  requestBookmarkDirs();
}
```
где `previousFilterHomeBookmarks` — сохранённое предыдущее значение `filterHomeBookmarks`.

- [ ] **Step 3: Проверить компиляцию**

Run: `cd /Users/a12343/Проекты/extensions/remanga && npm run check`

Expected: OK.

- [ ] **Step 4: Commit**

```bash
git add src/home-enhancer.ts src/content.ts
git commit -m "feat: integrate bookmark filter into home enhancements and content script"
```

---

### Task 6: Build и ручное тестирование

- [ ] **Step 1: Собрать расширение**

Run: `cd /Users/a12343/Проекты/extensions/remanga && npm run build`

Expected: сборка завершается без ошибок.

- [ ] **Step 2: Проверить TypeScript**

Run: `cd /Users/a12343/Проекты/extensions/remanga && npm run check`

Expected: нет ошибок.

- [ ] **Step 3: Проверить что popup.html содержит новый раздел**

Открыть popup расширения в Chrome и убедиться что:
- В подсекции «ГЛАВНАЯ СТРАНИЦА» появился тоггл «Фильтровать закладки на главной»
- При включении появляются подкатегории «КАТЕГОРИИ ЗАКЛАДОК» с 6 тогглами

---

### Task 7: Обновить AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Добавить в Source Of Truth**

Добавить строку:

```
- `src/bookmark-filter.ts` is the shared source of truth for bookmark category definitions, cache keys, message types, and card-matching helpers for the home bookmark filter feature.
```

- [ ] **Step 2: Добавить в Behavior Patterns**

Добавить:

```
- Home bookmark filter only applies on the root page (`remanga.org/`). It must not hide cards in the catalog or on other pages.
- Home bookmark filter uses `data-rre-home-hidden="bookmark-filter"` to hide cards. When the filter is disabled or no categories match, all `bookmark-filter` hidden markers are cleared.
- Bookmark data is fetched once from the API and cached for 30 minutes in `chrome.storage.local`. Toggling a category does not re-fetch — only the client-side filter changes.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs: update AGENTS.md with bookmark filter source of truth"
```