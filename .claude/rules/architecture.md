---
paths:
  - "src/**"
  - "parser-server/**"
  - "packaging/**"
  - "native-host/**"
  - "tests/**"
  - "vite*.config.ts"
---

# Архитектура

## Vite-бандлы (IIFE)

- `vite.config.ts` — собирает `src/content.ts` → `dist/content.js` (content script)
- `vite.background.config.ts` — собирает `src/background.ts` → `dist/background.js` (service worker)
- `vite.popup.config.ts` — собирает `src/popup.ts` → `dist/popup.js`
- `vite.import.config.ts` — собирает `src/import-page.ts` → `dist/import.js`
- `vite.bridge.config.ts` — собирает MangaLib bridge
- `vite.remanga-bridge.config.ts` — собирает Remanga bridge
- `vite.fullscreen-bridge.config.ts` — собирает fullscreen bridge

Все бандлы используют IIFE и sourcemaps. `npm run build` запускает их последовательно, затем `scripts/sync-installed-extension.mjs` зеркалирует `dist/` в установленную Windows-папку расширения.

## Три компонента системы

1. **Content script** (`src/content.ts`) — точка входа, наблюдает DOM и роуты, делегирует мутации в `reader-enhancer.ts`. Настройки через `chrome.storage.sync` (контракт в `settings.ts`).

2. **Background service worker** (`src/background.ts`) — координирует запуск parser-server через Native Messaging, healthcheck, bridge между content script и native host.

3. **Parser-server** (`parser-server/`) — Fastify backend, резолвит внешние главы и проксирует изображения. Расширение общается только с parser-server, никогда напрямую с внешними источниками.

4. **Native host** (`native-host/`) — macOS Native Messaging launcher, автоматически поднимает parser-server при открытии remanga.org. Поддерживает env-overrides `REMANGA_PARSER_BUNDLE`, `REMANGA_NODE_BIN`, `REMANGA_PARSER_CACHE_DIR` — без них работает как раньше (dev-режим, parser-server из `parser-server/dist/index.js`).

5. **Packaging** (`packaging/`) — One-click installer `.pkg` для macOS arm64. `bundle-parser.mjs` esbuild'ит весь parser-server в один JS, `bundle-host.mjs` — host.ts. `download-node.mjs` тянет Node arm64 binary. `build-pkg.mjs` оркестрирует всё + кладёт payload в `/Applications/Remanga Plus/` через `pkgbuild`/`productbuild`. Postinstall (`packaging/templates/postinstall`) вычисляет extension ID из `manifest.json` "key" и регистрирует Native Messaging manifest для всех Chromium-браузеров пользователя (Chrome/Brave/Edge/Vivaldi/Arc/...). Без подписи Apple Developer — друг открывает через правый клик → «Открыть».

   Windows-аналог: `build-installer-windows.mjs` — переиспользует `bundle-parser.mjs` / `bundle-host.mjs` (платформо-нейтральные esbuild-выходы), собирает Win32 launcher `host.exe` через `build-windows-launcher.mjs`, получает `node.exe` через `download-node-windows.mjs`, копирует setup-helper и README, собирает payload в `packaging/build-windows/` и зовёт `makensis -DEXTENSION_ID=... -DVERSION=... installer.nsi` → `Remanga-Plus-Setup.exe`. NSIS-скрипт сам генерирует `nm-manifest.json` с относительным `path: "host.exe"`, пишет ключи `HKCU\Software\<browser>\NativeMessagingHosts\org.remanga.parser_host` для 10 Chromium-браузеров (Chrome stable/beta/dev/canary, Edge, Brave, Vivaldi, Chromium, Yandex, Opera), создаёт Start Menu shortcuts; per-user install в `%LOCALAPPDATA%\Programs\Remanga Plus`, без UAC, zlib-компрессор. Сам `.exe` собирается на CI через `.github/workflows/build-windows-installer.yml` (`ubuntu-latest` + NSIS + MinGW-w64) — Homebrew `makensis 3.12` на arm64 macOS Tahoe сломан (`std::bad_alloc`). Без подписи Windows — друг через SmartScreen жмёт «More info → Run anyway».

## Ключевые модули

| Файл | Роль |
|------|------|
| `settings.ts` | Контракт `chrome.storage.sync` — defaults, merge, clone |
| `reader-enhancer.ts` | Все UI-мутации читалки |
| `premium-free.ts` | Premium Free client: metadata extraction, response shapes, remanga read-state sync (`markRemangaChapterAsViewed` → `POST /api/activity/views/`) |
| `premium-free-upgrade.ts` | Тихое улучшение качества уже открытой главы: опрос `/api/chapters/upgrade/:sessionId` + чистый расчёт нового `scrollTop` (`computeScrollAfterSwap`). Сервер отдаёт первый ответивший источник, потом досматривает более приоритетные; когда приходит лучший — страницы подменяются на месте |
| `premium-free-prefetch.ts` | PF prewarm: `prewarmPremiumFreeChapter(ref, resolver, { prewarmImage })` resolves a PF chapter and prewarms each page's `proxyUrl` via the in-memory `imageBlobCache` (NOT `<link rel=preload>` — PF images bypass HTTP cache by going through `chrome.runtime.sendMessage(PROXY_IMAGE_MESSAGE_TYPE)` → background → base64 → blob URL). Triggered (a) when next remanga chapter is paid via `prefetchNextChapter` `onPaidNextChapter` callback, (b) at PF stream root render to prewarm X+1, (c) after each stream entry add to chain X+2. |
| `parser-server.ts` | Shared constants: URLs, message types, host names |
| `popup.ts` | Тонкий orchestrator попапа расширения: загружает настройки, создаёт router, рендерит карточки + drill-down тогглы + сервис-блок |
| `popup-router.ts` | Чистый state machine: текущий экран ("main" / "site" / "reader" / "premium-free") + listener pattern для DOM-подписки |
| `popup-categories.ts` | Data-модуль: 3 категории (Сайт / Читалка / Premium Free) с descriptor-массивами тогглов; `accessor` указывает, в какое поле `settings.ts` мапится тоггл (scalar или header-button) |
| `popup-service-status.ts` | Рендеринг строки parser-server: статус + conditional refresh-кнопка (скрыта при OK, видна при down/busy/checking) |
| `popup-auth-row.ts` | Рендеринг строки авторизации MangaLib/Remanga: 3 независимых состояния (ok/bad/checking) на каждый сайт, helper hint под строкой, `title` tooltip на disabled кнопке «Импорт →» |
| `popup-dismissal.ts` | Селекторы и эвристики автозакрытия попапов на сайте remanga.org (НЕ про `popup.html`) |
| `parser-server/src/providers/` | `mangabuff.ts` (HTML scrape), `senkuro.ts` (GraphQL), `inkstory.ts` (REST `api.inkstory.net`), `telemanga.ts` (REST `telemanga.me/api`, изображения с `storage.yandexcloud.net/telemangacnd`) — все реализуют `ExternalSourceProvider` |
| `parser-server/src/http/client.ts` | `HttpClient` — UA, timeout (no retries; maxRetries removed) |
| `parser-server/src/resolve-chapter.ts` | Параллельный резолв всех провайдеров через `Promise.all` + AbortController; progress callbacks; лучший failure по rank |
| `parser-server/src/resolve-session.ts` | `ResolveSessionStore` — in-memory сессии для async resolve (POST → 202 → polling → result) |
| `parser-server/fixtures/` | Живые JSON/HTML ответы провайдеров для тестов (НЕ путать с `tests/fixtures/` у Mangabuff) |
| `parser-server/scripts/` | Одноразовые разведочные скрипты (`senkuro-*`, `inkstory-*`) |
| `mangalib-bridge.ts` | Content script на mangalib.me — читает `localStorage.auth.token.access_token`, проксирует API-запросы (Cloudflare блокирует chrome-extension origin → 403, нужен mangalib.me origin) |
| `remanga-bridge.ts` | Content script на remanga.org — читает имена bookmark-категорий из DOM `[role="tab"][id*="trigger-"]` на странице `/user/bookmarks` (нет API-эндпоинта для имён) |
| `bookmark-types-resolver.ts` | Чистый резолвер имён категорий: source-order `existing tabs → fresh cache (TTL 7d) → hidden tab /user/bookmarks (polling до 15s, потом close) → stale cache fallback`. Кэш в `chrome.storage.local` ключ `remangaBookmarkTypesCache`. Background передаёт chrome-API impls, логика тестируется без chrome |
| `import-page.ts` + `import.html` | Страница импорта закладок MangaLib → Remanga; auth-check через background, реальный fetchExistingRemangaBookmarks + safety-guard в `orchestrator.execute` |
| `import-mangalib/` | Клиенты MangaLib/Remanga, orchestrator, status-mapping, title-matcher, chapter-progress, state |
