# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

Chrome-расширение (Manifest V3) для remanga.org — убирает визуальный шум из читалки, добавляет настройки UI и Premium Free режим с parser-backed chapter stream.

## Команды

```bash
# Сборка расширения (content.js + background.js → dist/)
npm run build

# Проверка типов (extension + tests)
npm run check

# Watch-режим (только content script)
npm run dev

# Сборка native host
npm run native:build

# Установка native host (macOS) — ID берётся из "key" в public/manifest.json
npm run native:install

# Bump версии (синхронизирует package.json и public/manifest.json)
npm version patch    # 0.2.0 → 0.2.1
npm version minor    # 0.2.0 → 0.3.0
npm version major    # 0.2.0 → 1.0.0

# One-click installer .pkg для macOS arm64 (parser-server + Node + extension внутри)
npm run pkg:build    # → packaging/build/Remanga-Plus.pkg
npm run pkg:test     # тесты сборки .pkg + postinstall

# Parser-server
cd parser-server && npm install
cd parser-server && npm run dev      # dev с hot reload
cd parser-server && npm run check    # проверка типов
cd parser-server && npm test         # тесты backend
```

### Тесты расширения

Тестов-раннера в корневом package.json нет. Тесты используют `node:test` + `node:assert/strict` и запускаются вручную через tsc + node:

```bash
# Компиляция и запуск одного теста
npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 \
  --outDir .codex-tmp/test-build tests/<test-file>.test.ts src/<source-file>.ts
node --test .codex-tmp/test-build/tests/<test-file>.test.js

# Пример: тесты settings contract
npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 \
  --outDir .codex-tmp/test-build tests/settings-contract.test.ts src/settings.ts
node --test .codex-tmp/test-build/tests/settings-contract.test.js
```

Некоторые тесты — source-level (читают исходник через `fs` и проверяют паттерны в коде).

## Архитектура

### Два Vite-бандла (IIFE)

- `vite.config.ts` — собирает `src/content.ts` → `dist/content.js` (content script)
- `vite.background.config.ts` — собирает `src/background.ts` → `dist/background.js` (service worker)

Оба бандла — IIFE формат, sourcemaps включены. `npm run build` запускает обе сборки последовательно.

### Три компонента системы

1. **Content script** (`src/content.ts`) — точка входа, наблюдает DOM и роуты, делегирует мутации в `reader-enhancer.ts`. Настройки через `chrome.storage.sync` (контракт в `settings.ts`).

2. **Background service worker** (`src/background.ts`) — координирует запуск parser-server через Native Messaging, healthcheck, bridge между content script и native host.

3. **Parser-server** (`parser-server/`) — Fastify backend, резолвит внешние главы и проксирует изображения. Расширение общается только с parser-server, никогда напрямую с внешними источниками.

4. **Native host** (`native-host/`) — macOS Native Messaging launcher, автоматически поднимает parser-server при открытии remanga.org. Поддерживает env-overrides `REMANGA_PARSER_BUNDLE`, `REMANGA_NODE_BIN`, `REMANGA_PARSER_CACHE_DIR` — без них работает как раньше (dev-режим, parser-server из `parser-server/dist/index.js`).

5. **Packaging** (`packaging/`) — One-click installer `.pkg` для macOS arm64. `bundle-parser.mjs` esbuild'ит весь parser-server в один JS, `bundle-host.mjs` — host.ts. `download-node.mjs` тянет Node arm64 binary. `build-pkg.mjs` оркестрирует всё + кладёт payload в `/Applications/Remanga Plus/` через `pkgbuild`/`productbuild`. Postinstall (`packaging/templates/postinstall`) вычисляет extension ID из `manifest.json` "key" и регистрирует Native Messaging manifest для всех Chromium-браузеров пользователя (Chrome/Brave/Edge/Vivaldi/Arc/...). Без подписи Apple Developer — друг открывает через правый клик → «Открыть».

### Ключевые модули

| Файл | Роль |
|------|------|
| `settings.ts` | Контракт `chrome.storage.sync` — defaults, merge, clone |
| `reader-enhancer.ts` | Все UI-мутации читалки |
| `premium-free.ts` | Premium Free client: metadata extraction, response shapes, remanga read-state sync (`markRemangaChapterAsViewed` → `POST /api/activity/views/`) |
| `premium-free-prefetch.ts` | PF prewarm: `prewarmPremiumFreeChapter(ref, resolver, { prewarmImage })` resolves a PF chapter and prewarms each page's `proxyUrl` via the in-memory `imageBlobCache` (NOT `<link rel=preload>` — PF images bypass HTTP cache by going through `chrome.runtime.sendMessage(PROXY_IMAGE_MESSAGE_TYPE)` → background → base64 → blob URL). Triggered (a) when next remanga chapter is paid via `prefetchNextChapter` `onPaidNextChapter` callback, (b) at PF stream root render to prewarm X+1, (c) after each stream entry add to chain X+2. |
| `parser-server.ts` | Shared constants: URLs, message types, host names |
| `popup-dismissal.ts` | Селекторы и эвристики автозакрытия попапов |
| `parser-server/src/providers/` | `mangabuff.ts` (HTML scrape), `senkuro.ts` (GraphQL), `inkstory.ts` (REST `api.inkstory.net`) — все реализуют `ExternalSourceProvider` |
| `parser-server/src/http/client.ts` | `HttpClient` — UA, timeout, retry на 500/502/503/504/429 с Retry-After |
| `parser-server/src/resolve-chapter.ts` | Fallback-chain по `DEFAULT_PROVIDER_PRIORITY`: на provider_error/no_match продолжаем, на success — return; лучший failure по rank (`chapter_not_found > no_match > provider_error`) |
| `parser-server/fixtures/` | Живые JSON/HTML ответы провайдеров для тестов (НЕ путать с `tests/fixtures/` у Mangabuff) |
| `parser-server/scripts/` | Одноразовые разведочные скрипты (`senkuro-*`, `inkstory-*`) |

## Конвенции

- **TypeScript strict mode** — `noEmit: true`, проверка типов через `tsc --noEmit`.
- **Нет фреймворков** — ванильный DOM, никакого React/Vue.
- **Per-button visibility** — правая панель управляется отдельными переключателями для каждой кнопки, не одним blanket hide.
- **Preset + nested toggles** — паттерн для `hideRightRail` и `enhanceSettingsMenu`: preset включает группу, nested toggles управляют элементами внутри.
- **Настройки** — `settings.ts` — единственный source of truth для defaults и merge. Любой новый toggle добавляется и в контракт, и в defaults.
- **AGENTS.md** — содержит подробные behavior patterns и failure patterns. Читай его перед работой с reader-enhancer, premium-free, popup-dismissal.
- **dist/** — только build output. Не редактировать напрямую.
- **Provider logic** — title overrides и приоритеты провайдеров живут в `parser-server/src/config.ts`, не в расширении.
- **Provider interface** — `SourceProvider`: `name`, `searchTitles`, `getTitleDetails(ref, options?)`, `parseChapter`, `fetchImage`, `manualSearchUrl`. Опциональные `branches[]` + `selectedBranchId` в `SourceTitleDetails` для multi-branch источников (InkStory). UI лейблы «Открыть X» — через `PROVIDER_DISPLAY_NAMES` в `premium-free.ts`.
- **Translation picker** — `chrome.storage.sync.premiumFreeBranchPreferences: { [titleDir]: {provider, branchId} }`. Клиент шлёт `forcedBranchId` в resolve-body. Stale prefs автоматически purge'атся при несовпадении `selectedBranchId`.
- **HttpClient обязателен** для новых провайдеров — без него попадёшь на DDoS-Guard / Cloudflare без UA.

## Anti-Patterns

- DO NOT возвращать `minimizeSettingsButton`, `settings-peek-zone` или `openHiddenSettingsButton`.
- DO NOT клонировать rail-кнопки в fixed-position hover-triggered overlay поверх читалки.
- DO NOT удалять поле `"key"` из `public/manifest.json` или `dist/manifest.json`.
- DO NOT устанавливать `emptyOutDir: true` в `vite.config.ts` / `vite.background.config.ts`.
- DO NOT `return` failure внутри цикла по `providerPriority` — сломаешь fallback. `continue` + `recordFailure`.
- DO NOT слать URL в `parseChapter` у Senkuro/InkStory напрямую — провайдер ждёт slug/UUID, URL парсится через `extractChapterSlug`/`extractChapterUuid`.
- DO NOT `first: 10000` у Senkuro `mangaChapters` — сервер 400. Пагинация `first: 100` + `after: endCursor`.
- DO NOT использовать `/v2/branches?book=X` у InkStory как authoritative список — там top-20 с editorsChoice. Группировать chapters по `branchId` из `/v2/chapters?bookId=`.
- DO NOT запускать `node dist/index.js` parser-server руками параллельно с включённым Premium Free — native host сам поднимет, будет EADDRINUSE. `lsof -ti :3000 | xargs kill -9` перед ручным запуском.
- DO NOT забывать `manga { slug }` в `CHAPTER_QUERY` — иначе `chapterUrl` в response без slug манги.

## Visuals (gpt-image-prompt + frontend-design)

Design state lives in `.design/`:
- [`brand.md`](.design/brand.md) — ChatGPT memory project name, priming prompt, brand summary
- [`tokens.md`](.design/tokens.md) — design tokens (colors, typography, spacing, radii)
- [`log.md`](.design/log.md) — chronological log of generated visuals with their prompts

**For any image / icon / UI mock generation:** the skill `gpt-image-prompt` reads/writes here automatically.

**For frontend code generation:** when writing TSX/CSS/Tailwind for this project, read `.design/tokens.md` first and use those token values instead of inventing your own. The brand summary in `.design/brand.md` provides additional context.

ChatGPT memory project name: `Remanga Reader Enhancer` — referenced in every image prompt to trigger memory recall.
