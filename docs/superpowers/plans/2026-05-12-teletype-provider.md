# Teletype Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить Teletype.in как четвёртый провайдер в fallback-chain Premium Free с предупреждением в читалке о непроверенном источнике.

**Architecture:** Новый `TeletypeProvider` в parser-server скрейпит SSR HTML с teletype.in — поиск статей и извлечение картинок глав. Провайдер ставится последним в приоритете. Результат помечается `unverified: true`, что триггерит баннер в расширении.

**Tech Stack:** TypeScript, HttpClient (повторное использование из parser-server), HTML парсинг через regex (как Mangabuff)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `parser-server/src/providers/teletype.ts` | TeletypeProvider — поиск статей, парсинг картинок |
| Modify | `parser-server/src/providers/provider.interface.ts` | Добавить `unverified?: boolean` в `ExternalResolveSuccess`, `resolveChapterDirectly` в `SourceProvider` |
| Modify | `parser-server/src/resolve-chapter.ts` | Код-путь для direct-resolve провайдеров |
| Modify | `parser-server/src/config.ts` | Добавить `"teletype"` в `DEFAULT_PROVIDER_PRIORITY` |
| Modify | `parser-server/src/server.ts` | Зарегистрировать TeletypeProvider |
| Modify | `src/premium-free.ts` | Добавить `unverified?: boolean` в `PremiumFreeResolveSuccess`, `"teletype"` в `PROVIDER_DISPLAY_NAMES` |
| Modify | `src/reader-enhancer.ts` | Рендеринг баннера для unverified глав |
| Create | `parser-server/tests/teletype.test.ts` | Тесты парсинга |
| Create | `parser-server/fixtures/teletype-search.html` | Fixture HTML — страница поиска |
| Create | `parser-server/fixtures/teletype-article.html` | Fixture HTML — страница статьи |

---

### Task 1: Расширить provider.interface.ts

**Files:**
- Modify: `parser-server/src/providers/provider.interface.ts`

- [ ] **Step 1: Добавить `unverified` в ExternalResolveSuccess и `resolveChapterDirectly` в SourceProvider**

В `ExternalResolveSuccess` добавить после `selectedBranchId`:
```ts
unverified?: boolean;
```

В `SourceProvider` добавить после `fetchImage`:
```ts
resolveChapterDirectly?(remanga: RemangaChapterReference): Promise<ExternalResolveResult>;
```

- [ ] **Step 2: Проверить типы**

Run: `cd parser-server && npx tsc --noEmit`
Expected: PASS (новые поля опциональны)

- [ ] **Step 3: Commit**

```bash
git add parser-server/src/providers/provider.interface.ts
git commit -m "feat(teletype): add unverified field and resolveChapterDirectly to provider interface"
```

---

### Task 2: Создать TeletypeProvider

**Files:**
- Create: `parser-server/src/providers/teletype.ts`

- [ ] **Step 1: Написать тесты парсинга**

Создать `parser-server/tests/teletype.test.ts` с тестами для:
- `extractTeletypeSearchResults(initialStateJson)` — парсинг списка статей из `__INITIAL_STATE__`
- `extractChapterNumberFromTitle(title)` — извлечение номера главы из заголовка
- `extractTeletypeArticlePages(initialStateJson)` — парсинг картинок из текста статьи

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractTeletypeSearchResults,
  extractChapterNumberFromTitle,
  extractTeletypeArticlePages,
} from "../src/providers/teletype.js";

describe("extractChapterNumberFromTitle", () => {
  it("extracts number from 'Как демон император стал дворецким - 19 глава ✓'", () => {
    assert.equal(extractChapterNumberFromTitle(" Как демон император стал дворецким - 19 глава ✓"), "19");
  });

  it("extracts number from 'Как демон император стал дворецким - 382 Глава'", () => {
    assert.equal(extractChapterNumberFromTitle("Как демон император стал дворецким - 382 Глава  "), "382");
  });

  it("extracts number from 'Мой любимый хулиган. Глава 58'", () => {
    assert.equal(extractChapterNumberFromTitle("Мой любимый хулиган. Глава 58"), "58");
  });

  it("returns null when no chapter number found", () => {
    assert.equal(extractChapterNumberFromTitle("Обзор манги"), null);
  });

  it("extracts from 'Том 3 Глава 15'", () => {
    assert.equal(extractChapterNumberFromTitle("Название - Том 3 Глава 15"), "15");
  });
});

describe("extractTeletypeSearchResults", () => {
  it("parses articles from initial state", () => {
    const state = {
      search: {
        search: {
          articles: [
            {
              id: 4770609,
              uri: "aEXitqik_lS",
              title: " Как демон император стал дворецким - 19 глава ✓",
              author: { id: 1796817, uri: "hither.ss", name: "Higher" },
            },
          ],
        },
      },
    };
    const results = extractTeletypeSearchResults(state, "Как демон император стал дворецким", "19");
    assert.equal(results.length, 1);
    assert.equal(results[0].articleId, "4770609");
    assert.equal(results[0].chapter, "19");
    assert.equal(results[0].articleUrl, "https://teletype.in/@hither.ss/aEXitqik_lS");
  });

  it("skips articles with non-matching chapter number", () => {
    const state = {
      search: {
        search: {
          articles: [
            {
              id: 4731977,
              uri: "Ct_t5G8wCDL",
              title: "Как демон император стал дворецким - 382 Глава",
              author: { id: 1029732, uri: "konysama", name: "Nikita Konysama" },
            },
          ],
        },
      },
    };
    const results = extractTeletypeSearchResults(state, "Как демон император стал дворецким", "19");
    assert.equal(results.length, 0);
  });

  it("skips articles with non-matching title", () => {
    const state = {
      search: {
        search: {
          articles: [
            {
              id: 5543477,
              uri: "abc123",
              title: "Мой любимый хулиган. Глава 19",
              author: { id: 1, uri: "someone", name: "Someone" },
            },
          ],
        },
      },
    };
    const results = extractTeletypeSearchResults(state, "Как демон император стал дворецким", "19");
    assert.equal(results.length, 0);
  });
});

describe("extractTeletypeArticlePages", () => {
  it("extracts image URLs from article text", () => {
    const text = '<document><image src="https://img1.teletype.in/files/c1/9b/c19b58df.jpeg" anchor="F1zu" size="original" width=374 height=6031></image><image src="https://img3.teletype.in/files/a3/2c/a32c780d.jpeg" anchor="WQEB" size="original" width=374 height=3274></image></document>';
    const pages = extractTeletypeArticlePages(text);
    assert.equal(pages.length, 2);
    assert.equal(pages[0].index, 0);
    assert.equal(pages[0].imageRef, "https://img1.teletype.in/files/c1/9b/c19b58df.jpeg");
    assert.equal(pages[1].index, 1);
    assert.equal(pages[1].imageRef, "https://img3.teletype.in/files/a3/2c/a32c780d.jpeg");
  });

  it("returns empty array for empty text", () => {
    assert.deepEqual(extractTeletypeArticlePages(""), []);
  });
});
```

- [ ] **Step 2: Запустить тесты — должны упасть**

Run: `cd parser-server && npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --outDir .codex-tmp/test-build tests/teletype.test.ts src/providers/teletype.ts 2>&1; echo "exit: $?"`
Expected: FAIL — teletype.ts не существует

- [ ] **Step 3: Написать TeletypeProvider**

Создать `parser-server/src/providers/teletype.ts`:

```ts
import { HttpClient } from "../http/client.js";
import type {
  ExternalChapterParseResult,
  ExternalResolveFailure,
  ExternalResolveResult,
  ExternalResolveSuccess,
  RemangaChapterReference,
  SourceProvider,
} from "./provider.interface.js";

const TELETYPE_BASE_URL = "https://teletype.in";

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const extractChapterNumberFromTitle = (title: string): string | null => {
  const patterns = [
    /(\d+)\s*глав[аы]/i,
    /глав[аы]\s*(\d+)/i,
    /(\d+)\s*chapter/i,
    /chapter\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) return match[1];
  }

  return null;
};

interface TeletypeSearchArticle {
  id: number;
  uri: string;
  title: string;
  author: { id: number; uri: string; name: string };
}

interface TeletypeMatchResult {
  articleId: string;
  chapter: string;
  articleUrl: string;
  titleName: string;
}

const normalizeForMatch = (value: string): string =>
  normalize(value).replace(/\s+/g, " ").trim();

const titleContainsName = (articleTitle: string, remangaNames: string[]): boolean => {
  const normalizedArticleTitle = normalizeForMatch(articleTitle);
  return remangaNames.some((name) => {
    const normalizedName = normalizeForMatch(name);
    return normalizedName.length > 0 && normalizedArticleTitle.includes(normalizedName);
  });
};

export const extractTeletypeSearchResults = (
  initialState: unknown,
  remangaTitleName: string,
  remangaChapter: string,
): TeletypeMatchResult[] => {
  const state = initialState as {
    search?: { search?: { articles?: TeletypeSearchArticle[] } };
  };
  const articles = state?.search?.search?.articles;
  if (!Array.isArray(articles)) return [];

  const remangaNames = [remangaTitleName].filter(Boolean).map(normalizeForMatch);

  return articles.reduce<TeletypeMatchResult[]>((acc, article) => {
    if (!article?.uri || !article?.title) return acc;

    const chapterNum = extractChapterNumberFromTitle(article.title);
    if (chapterNum !== remangaChapter) return acc;

    if (!titleContainsName(article.title, [remangaTitleName])) return acc;

    const authorUri = article.author?.uri;
    if (!authorUri) return acc;

    acc.push({
      articleId: String(article.id),
      chapter: chapterNum,
      articleUrl: `${TELETYPE_BASE_URL}/@${authorUri}/${article.uri}`,
      titleName: article.title.replace(/\s*✓\s*/, "").replace(/\s*-\s*\d+\s*глав[аы]\s*/i, "").trim(),
    });

    return acc;
  }, []);
};

export const extractTeletypeArticlePages = (text: string): ExternalChapterParseResult["pages"] => {
  const imageRegex = /<image\s+src="([^"]+teletype\.in\/files\/[^"]+)"/g;
  const pages: ExternalChapterParseResult["pages"] = [];
  let index = 0;

  for (const match of text.matchAll(imageRegex)) {
    pages.push({ index, imageRef: match[1] });
    index += 1;
  }

  return pages;
};

const extractInitialState = (html: string): unknown => {
  const marker = "window.__INITIAL_STATE__=";
  const startIdx = html.indexOf(marker);
  if (startIdx === -1) return null;

  const jsonStart = startIdx + marker.length;

  // Find the end of the JSON: it's terminated by `;</script>` or just `;`
  // Use a brace-counting approach to find the end of the top-level object
  const afterMarker = html.slice(jsonStart);
  let depth = 0;
  let inString = false;
  let escape = false;
  let endIdx = -1;

  for (let i = 0; i < afterMarker.length; i += 1) {
    const ch = afterMarker[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }
    if (ch === '"' && !escape) {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth += 1;
    if (ch === "}" || ch === "]") depth -= 1;
    if (depth === 0 && (ch === ";" || ch === "<")) {
      endIdx = i;
      break;
    }
  }

  if (endIdx === -1) return null;

  try {
    return JSON.parse(afterMarker.slice(0, endIdx));
  } catch {
    return null;
  }
};

const isHttpClient = (value: unknown): value is HttpClient =>
  value instanceof HttpClient;

const coerceHttpClient = (value: typeof fetch | HttpClient | undefined): HttpClient => {
  if (!value) return new HttpClient();
  if (isHttpClient(value)) return value;
  return new HttpClient({ fetchImpl: value });
};

export class TeletypeProvider implements SourceProvider {
  name = "teletype";
  private readonly http: HttpClient;

  constructor(httpOrFetch: typeof fetch | HttpClient = fetch) {
    this.http = coerceHttpClient(httpOrFetch);
  }

  manualSearchUrl(query: string): string {
    return `${TELETYPE_BASE_URL}/search?query=${encodeURIComponent(query)}`;
  }

  async resolveChapterDirectly(
    remanga: RemangaChapterReference,
  ): Promise<ExternalResolveResult> {
    const searchQuery = `${remanga.titleName} ${remanga.chapter}`;
    const searchUrl = this.manualSearchUrl(searchQuery);
    const manualUrl = searchUrl;

    try {
      const searchHtml = await this.fetchHtml(searchUrl);
      const initialState = extractInitialState(searchHtml);
      if (!initialState) {
        return createFailureResult("provider_error", this.name, manualUrl);
      }

      const matches = extractTeletypeSearchResults(
        initialState,
        remanga.titleName,
        remanga.chapter,
      );

      if (matches.length === 0) {
        return createFailureResult("no_match", this.name, manualUrl);
      }

      const match = matches[0];
      const articleHtml = await this.fetchHtml(match.articleUrl);
      const articleState = extractInitialState(articleHtml);
      if (!articleState) {
        return createFailureResult("provider_error", this.name, match.articleUrl);
      }

      const articles = (articleState as { articles?: { items?: Record<string, { text?: string }> } })
        ?.articles?.items;
      const articleData = articles?.[match.articleId];
      const text = articleData?.text;

      if (!text) {
        return createFailureResult("chapter_not_found", this.name, match.articleUrl);
      }

      const pages = extractTeletypeArticlePages(text);
      if (pages.length === 0) {
        return createFailureResult("chapter_not_found", this.name, match.articleUrl);
      }

      const success: ExternalResolveSuccess = {
        status: "success",
        provider: this.name,
        matchedTitle: {
          titleId: match.articleId,
          slug: match.articleId,
          titleName: match.titleName,
          titleUrl: match.articleUrl,
        },
        matchedChapter: {
          chapterId: `teletype-${match.articleId}`,
          chapter: match.chapter,
          volume: 0,
          chapterUrl: match.articleUrl,
        },
        manualUrl: match.articleUrl,
        nextChapter: null,
        totalPages: pages.length,
        pages,
        unverified: true,
      };

      return success;
    } catch {
      return createFailureResult("provider_error", this.name, manualUrl);
    }
  }

  async parseChapter(chapterRef: string): Promise<ExternalChapterParseResult> {
    const articleUrl = chapterRef.startsWith("http")
      ? chapterRef
      : `${TELETYPE_BASE_URL}${chapterRef.startsWith("/") ? "" : "/"}${chapterRef}`;

    const html = await this.fetchHtml(articleUrl);
    const initialState = extractInitialState(html);
    if (!initialState) {
      throw new Error("Teletype article initial state not found");
    }

    const uri = articleUrl.split("/").filter(Boolean).at(-1) ?? "";
    const articleData = (initialState as { articles?: { items?: Record<string, { text?: string }> } })
      ?.articles?.items?.[uri];
    const text = articleData?.text;

    if (!text) {
      throw new Error("Teletype article text not found");
    }

    const pages = extractTeletypeArticlePages(text);

    return {
      chapterId: `teletype-${uri}`,
      titleId: uri,
      chapter: "",
      volume: 0,
      chapterUrl: articleUrl,
      pages,
    };
  }

  async fetchImage(imageRef: string): Promise<Buffer> {
    const response = await this.http.request(imageRef);
    if (!response.ok) {
      throw new Error(`Teletype image fetch failed: ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await this.http.request(url);
    if (!response.ok) {
      throw new Error(`Teletype request failed: ${response.status}`);
    }
    return response.text();
  }
}

const createFailureResult = (
  reason: ExternalResolveFailure["reason"],
  provider: string,
  manualUrl: string,
): ExternalResolveFailure => ({
  status: "failure",
  reason,
  provider,
  manualUrl,
});
```

- [ ] **Step 4: Запустить тесты**

Run: `cd parser-server && npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --outDir .codex-tmp/test-build tests/teletype.test.ts src/providers/teletype.ts src/http/client.ts src/providers/provider.interface.ts 2>&1 && node --test .codex-tmp/test-build/tests/teletype.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add parser-server/src/providers/teletype.ts parser-server/tests/teletype.test.ts
git commit -m "feat(teletype): add TeletypeProvider with search and article parsing"
```

---

### Task 3: Интегрировать TeletypeProvider в resolve-chapter.ts

**Files:**
- Modify: `parser-server/src/resolve-chapter.ts`
- Modify: `parser-server/src/config.ts`
- Modify: `parser-server/src/server.ts`

- [ ] **Step 1: Обновить DEFAULT_PROVIDER_PRIORITY**

В `parser-server/src/config.ts` заменить строку:
```ts
export const DEFAULT_PROVIDER_PRIORITY = ["mangabuff", "senkuro", "inkstory"];
```
на:
```ts
export const DEFAULT_PROVIDER_PRIORITY = ["mangabuff", "senkuro", "inkstory", "teletype"];
```

- [ ] **Step 2: Добавить direct-resolve путь в resolve-chapter.ts**

В `resolveExternalChapter` после строк:
```ts
    if (!provider || !isExternalSourceProvider(provider)) {
      continue;
    }
```

Добавить:
```ts
    if (typeof provider.resolveChapterDirectly === "function" && !isExternalSourceProvider(provider)) {
      try {
        const directResult = await provider.resolveChapterDirectly(remanga);
        if (directResult.status === "success") {
          return directResult;
        }
        recordFailure(directResult);
      } catch {
        recordFailure(createFailureResult("provider_error", provider.name, resolveManualSearchUrl(provider, remanga.titleName)));
      }
      continue;
    }
```

Но TeletypeProvider реализует и `ExternalSourceProvider` (с пустым `searchTitles`), и `resolveChapterDirectly`. Поэтому логика должна быть: если у провайдера есть `resolveChapterDirectly`, используем его вместо стандартного поиска. Заменить блок:

```ts
    if (!provider || !isExternalSourceProvider(provider)) {
      continue;
    }
```

на:

```ts
    if (!provider) {
      continue;
    }

    if (typeof provider.resolveChapterDirectly === "function") {
      try {
        const directResult = await provider.resolveChapterDirectly(remanga);
        if (directResult.status === "success") {
          return directResult;
        }
        if (directResult.status === "failure") {
          recordFailure(directResult);
        }
      } catch {
        recordFailure(createFailureResult("provider_error", provider.name, resolveManualSearchUrl(provider, remanga.titleName)));
      }
      continue;
    }

    if (!isExternalSourceProvider(provider)) {
      continue;
    }
```

- [ ] **Step 3: Зарегистрировать TeletypeProvider в server.ts**

В `parser-server/src/server.ts` добавить импорт:
```ts
import { TeletypeProvider } from "./providers/teletype.js";
```

И после строки `registry.register(new InkstoryProvider(httpClient));` добавить:
```ts
registry.register(new TeletypeProvider(httpClient));
```

- [ ] **Step 4: Проверить типы**

Run: `cd parser-server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add parser-server/src/resolve-chapter.ts parser-server/src/config.ts parser-server/src/server.ts
git commit -m "feat(teletype): integrate TeletypeProvider into fallback chain"
```

---

### Task 4: Добавить unverified в расширение

**Files:**
- Modify: `src/premium-free.ts`

- [ ] **Step 1: Добавить unverified в PremiumFreeResolveSuccess**

В `src/premium-free.ts` в тип `PremiumFreeResolveSuccess` после `selectedBranchId?: string;` добавить:
```ts
  unverified?: boolean;
```

- [ ] **Step 2: Добавить Teletype в PROVIDER_DISPLAY_NAMES**

В `src/premium-free.ts` в `PROVIDER_DISPLAY_NAMES` добавить:
```ts
  teletype: "Teletype",
```

- [ ] **Step 3: Проверить типы**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: PASS (или ошибки только в reader-enhancer.ts — будут исправлены в Task 5)

- [ ] **Step 4: Commit**

```bash
git add src/premium-free.ts
git commit -m "feat(teletype): add unverified field and display name to premium-free types"
```

---

### Task 5: Баннер предупреждения в читалке

**Files:**
- Modify: `src/reader-enhancer.ts`

- [ ] **Step 1: Написать функцию создания баннера**

Найти место рядом с другими функциями создания UI-элементов (например, рядом с `createPremiumFreeStreamLoader`). Добавить:

```ts
const createPremiumFreeUnverifiedBanner = (manualUrl: string): HTMLElement => {
  const banner = document.createElement("div");
  banner.setAttribute(CONTROL_ATTRIBUTE, "premium-free-unverified-banner");
  banner.style.cssText = [
    "display: flex",
    "align-items: center",
    "justify-content: space-between",
    "gap: 12px",
    "padding: 10px 16px",
    "background: #fff3cd",
    "border-bottom: 1px solid #ffc107",
    "color: #664d03",
    "font-size: 14px",
    "line-height: 1.4",
    "width: 100%",
    "box-sizing: border-box",
  ].join(";");

  const text = document.createElement("span");
  text.textContent = "Эта глава найдена на Teletype — может не совпадать с оригиналом";

  const link = document.createElement("a");
  link.href = manualUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Открыть на Teletype";
  link.style.cssText = [
    "color: #664d03",
    "font-weight: 600",
    "white-space: nowrap",
    "text-decoration: underline",
  ].join(";");

  link.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: manualUrl });
  });

  banner.append(text, link);
  return banner;
};
```

- [ ] **Step 2: Добавить стили для баннера**

В блок CSS стилей (вставка через `readerCSS`) добавить:
```css
[${CONTROL_ATTRIBUTE}="premium-free-unverified-banner"] {
  position: sticky;
  top: 0;
  z-index: 10;
}
```

- [ ] **Step 3: Рендерить баннер для unverified глав**

В функции `renderPremiumFreeFeedStream` после создания `streamReader` и перед `stream.entries.forEach` добавить проверку:

Найти строку `const firstEntry = stream.entries[0];` и после блока с `selector` добавить:
```ts
  if (firstEntry?.result.status === "success" && (firstEntry.result as { unverified?: boolean }).unverified) {
    const unverifiedBanner = createPremiumFreeUnverifiedBanner(firstEntry.result.manualUrl);
    streamReader.prepend(unverifiedBanner);
  }
```

- [ ] **Step 4: Проверить типы**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/reader-enhancer.ts
git commit -m "feat(teletype): add unverified banner in reader for Teletype chapters"
```

---

### Task 6: Сборка и финальная проверка

**Files:**
- All modified files

- [ ] **Step 1: Собрать parser-server**

Run: `cd parser-server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Собрать расширение**

Run: `npm run build`
Expected: PASS

- [ ] **Step 3: Запустить тесты TeletypeProvider**

Run: `cd parser-server && npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 --outDir .codex-tmp/test-build tests/teletype.test.ts src/providers/teletype.ts src/http/client.ts src/providers/provider.interface.ts 2>&1 && node --test .codex-tmp/test-build/tests/teletype.test.js`
Expected: PASS

- [ ] **Step 4: Проверить общий typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Commit (если были правки)**

```bash
git add -A
git commit -m "fix(teletype): final integration fixes"
```