# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

Chrome-расширение (Manifest V3) для remanga.org — убирает визуальный шум из читалки, добавляет настройки UI и Premium Free режим с parser-backed chapter stream.

## Команды

```bash
# Сборка и обновление установленного расширения
# ОБЯЗАТЕЛЬНО запускать после реализации любой фичи или исправления.
# Команда собирает все bundles в dist/, затем атомарно заменяет содержимое
# %LOCALAPPDATA%\Programs\Remanga Plus\extension, если эта папка установлена.
# После успешной сборки нажми «Перезагрузить» в chrome://extensions.
# Все ручные изменения внутри установленной extension-папки будут удалены.
# Команда НЕ обновляет parser-server, native host или Setup.exe: для них нужны
# соответствующие native/package-команды ниже.
npm run build

# Проверка типов (extension + tests)
npm run check

# Watch-режим (только content script)
npm run dev

# Сборка native host (только tsc, оставляет shebang `#!/usr/bin/env node`)
# Достаточно для type-check и для PKG-инсталлера. Для локального Chrome — мало:
# `env node` не находит nvm-node в Chrome'овском PATH → host не стартует.
# Для dev'а используй `native:install` (он же делает build + rewrite shebang
# на абсолютный путь + регистрирует Native Messaging manifest для всех Chrome'ов).
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

# One-click installer .exe для Windows x64 (через GitHub Actions, на arm64 macOS Tahoe makensis 3.12 сломан)
# Триггеры: push tag v* → автосборка + GitHub Release с .exe
#           workflow_dispatch вручную из вкладки Actions
# Локально: npm run pkg:windows работает на Linux/Intel Mac, на arm64 macOS падает std::bad_alloc
npm run pkg:windows         # → packaging/build-windows/Remanga-Plus-Setup.exe (если makensis рабочий)
npm run pkg:windows:test    # тесты Windows-пайплайна (skip'нутся если makensis сломан)

# Parser-server
cd parser-server && npm install
cd parser-server && npm run dev      # dev с hot reload
cd parser-server && npm run check    # проверка типов
cd parser-server && npm test         # тесты backend

# Тесты parser-server зависают без --test-force-exit: buildApp вешает
# setInterval для prune сессий, и процесс не выходит после прогона.
cd parser-server && npx tsx --test --test-force-exit tests/*.test.ts

# Свой parser-server на VPS (деплой, обновление, диагностика) — docs/self-hosted-parser.md
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

### Vite-бандлы (IIFE)

- `vite.config.ts` — собирает `src/content.ts` → `dist/content.js` (content script)
- `vite.background.config.ts` — собирает `src/background.ts` → `dist/background.js` (service worker)
- `vite.popup.config.ts` — собирает `src/popup.ts` → `dist/popup.js`
- `vite.import.config.ts` — собирает `src/import-page.ts` → `dist/import.js`
- `vite.bridge.config.ts` — собирает MangaLib bridge
- `vite.remanga-bridge.config.ts` — собирает Remanga bridge
- `vite.fullscreen-bridge.config.ts` — собирает fullscreen bridge

Все бандлы используют IIFE и sourcemaps. `npm run build` запускает их последовательно, затем `scripts/sync-installed-extension.mjs` зеркалирует `dist/` в установленную Windows-папку расширения.

### Три компонента системы

1. **Content script** (`src/content.ts`) — точка входа, наблюдает DOM и роуты, делегирует мутации в `reader-enhancer.ts`. Настройки через `chrome.storage.sync` (контракт в `settings.ts`).

2. **Background service worker** (`src/background.ts`) — координирует запуск parser-server через Native Messaging, healthcheck, bridge между content script и native host.

3. **Parser-server** (`parser-server/`) — Fastify backend, резолвит внешние главы и проксирует изображения. Расширение общается только с parser-server, никогда напрямую с внешними источниками.

4. **Native host** (`native-host/`) — macOS Native Messaging launcher, автоматически поднимает parser-server при открытии remanga.org. Поддерживает env-overrides `REMANGA_PARSER_BUNDLE`, `REMANGA_NODE_BIN`, `REMANGA_PARSER_CACHE_DIR` — без них работает как раньше (dev-режим, parser-server из `parser-server/dist/index.js`).

5. **Packaging** (`packaging/`) — One-click installer `.pkg` для macOS arm64. `bundle-parser.mjs` esbuild'ит весь parser-server в один JS, `bundle-host.mjs` — host.ts. `download-node.mjs` тянет Node arm64 binary. `build-pkg.mjs` оркестрирует всё + кладёт payload в `/Applications/Remanga Plus/` через `pkgbuild`/`productbuild`. Postinstall (`packaging/templates/postinstall`) вычисляет extension ID из `manifest.json` "key" и регистрирует Native Messaging manifest для всех Chromium-браузеров пользователя (Chrome/Brave/Edge/Vivaldi/Arc/...). Без подписи Apple Developer — друг открывает через правый клик → «Открыть».

   Windows-аналог: `build-installer-windows.mjs` — переиспользует `bundle-parser.mjs` / `bundle-host.mjs` (платформо-нейтральные esbuild-выходы), собирает Win32 launcher `host.exe` через `build-windows-launcher.mjs`, получает `node.exe` через `download-node-windows.mjs`, копирует setup-helper и README, собирает payload в `packaging/build-windows/` и зовёт `makensis -DEXTENSION_ID=... -DVERSION=... installer.nsi` → `Remanga-Plus-Setup.exe`. NSIS-скрипт сам генерирует `nm-manifest.json` с относительным `path: "host.exe"`, пишет ключи `HKCU\Software\<browser>\NativeMessagingHosts\org.remanga.parser_host` для 10 Chromium-браузеров (Chrome stable/beta/dev/canary, Edge, Brave, Vivaldi, Chromium, Yandex, Opera), создаёт Start Menu shortcuts; per-user install в `%LOCALAPPDATA%\Programs\Remanga Plus`, без UAC, zlib-компрессор. Сам `.exe` собирается на CI через `.github/workflows/build-windows-installer.yml` (`ubuntu-latest` + NSIS + MinGW-w64) — Homebrew `makensis 3.12` на arm64 macOS Tahoe сломан (`std::bad_alloc`). Без подписи Windows — друг через SmartScreen жмёт «More info → Run anyway».

### Ключевые модули

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

## Конвенции

- **TypeScript strict mode** — `noEmit: true`, проверка типов через `tsc --noEmit`.
- **Нет фреймворков** — ванильный DOM, никакого React/Vue.
- **Per-button visibility** — правая панель управляется отдельными переключателями для каждой кнопки, не одним blanket hide.
- **Preset + nested toggles** — паттерн для `hideRightRail` и `enhanceSettingsMenu`: preset включает группу, nested toggles управляют элементами внутри.
- **Настройки** — `settings.ts` — единственный source of truth для defaults и merge. Любой новый toggle добавляется и в контракт, и в defaults.
- **AGENTS.md** — содержит подробные behavior patterns и failure patterns. Читай его перед работой с reader-enhancer, premium-free, popup-dismissal.
- **dist/** — только build output. Не редактировать напрямую.
- **Завершение фичи/фикса** — всегда запускай `npm run build`. Помни о побочном эффекте: при существующей Windows-установке команда полностью заменяет `%LOCALAPPDATA%\Programs\Remanga Plus\extension`; после неё требуется reload расширения в Chrome. Parser-server, native host и `.exe` этой командой не переустанавливаются.
- **Provider logic** — title overrides и приоритеты провайдеров живут в `parser-server/src/config.ts`, не в расширении.
- **Provider interface** — `SourceProvider`: `name`, `searchTitles`, `getTitleDetails(ref, options?)`, `parseChapter`, `fetchImage`, `manualSearchUrl`. Опциональные `branches[]` + `selectedBranchId` в `SourceTitleDetails` для multi-branch источников (InkStory). UI лейблы «Открыть X» — через `PROVIDER_DISPLAY_NAMES` в `premium-free.ts`.
- **Translation picker** — `chrome.storage.sync.premiumFreeBranchPreferences: { [titleDir]: {provider, branchId} }`. Клиент шлёт `forcedBranchId` в resolve-body. Stale prefs автоматически purge'атся при несовпадении `selectedBranchId`.
- **HttpClient обязателен** для новых провайдеров — без него попадёшь на DDoS-Guard / Cloudflare без UA.

## Anti-Patterns

- DO NOT возвращать `minimizeSettingsButton`, `settings-peek-zone` или `openHiddenSettingsButton`.
- DO NOT клонировать rail-кнопки в fixed-position hover-triggered overlay поверх читалки.
- DO NOT удалять поле `"key"` из `public/manifest.json` или `dist/manifest.json`.
- DO NOT устанавливать `emptyOutDir: true` в `vite.config.ts` / `vite.background.config.ts`.
- DO NOT `return` failure из `resolveWithProvider` при `signal.aborted` — это cancel, не провайдерная ошибка. Возвращай `createFailureResult("provider_error", ...)`.
- DO NOT слать URL в `parseChapter` у Senkuro/InkStory напрямую — провайдер ждёт slug/UUID, URL парсится через `extractChapterSlug`/`extractChapterUuid`.
- DO NOT `first: 10000` у Senkuro `mangaChapters` — сервер 400. Пагинация `first: 100` + `after: endCursor`.
- DO NOT использовать `/v2/branches?book=X` у InkStory как authoritative список — там top-20 с editorsChoice. Группировать chapters по `branchId` из `/v2/chapters?bookId=`.
- DO NOT отдавать InkStory `pages[].image` как готовую картинку без проверки protected filename-маркера и расшифровки.
- DO NOT запускать `node dist/index.js` parser-server руками параллельно с включённым Premium Free — native host сам поднимет, будет EADDRINUSE. `lsof -ti :7845 | xargs kill -9` перед ручным запуском.
- DO NOT забывать `manga { slug }` в `CHAPTER_QUERY` — иначе `chapterUrl` в response без slug манги.
- DO NOT использовать non-ASCII символы в `installer.nsi`.
- DO NOT использовать `SetCompressor /SOLID lzma` или `SetCompressor lzma` в `installer.nsi`.
- DO NOT коммитить `packaging/build-windows/` (build artefacts).
- DO NOT слать запросы к `api.cdnlibs.org` из background service worker — Cloudflare 403. Проксировать через `mangalib-bridge.ts` content script (origin = mangalib.me).
- DO NOT использовать `/api/v2/bookmark-types/` или `/api/v2/users/{id}/bookmark-types/` — endpoint не существует, имена категорий читать из DOM через `remanga-bridge.ts`.
- DO NOT использовать `/api/v2/bookmarks/` для add — endpoint 404. Правильный: `POST /api/users/bookmarks/` body `{title, type}` где `type` — это `bookmark_type_id` (per-user ID категории, не enum).
- DO NOT использовать `/api/v2/users/{id}/user_bookmarks/` для add закладки — это endpoint управления **категориями**, POST туда создаёт пользовательскую категорию.
- DO NOT полагаться на `chrome.tabs.query({url: "..."})` для match patterns — может не находить вкладки даже при наличии host_permission. `chrome.tabs.query({})` + JS filter по `t.url.startsWith(...)`.
- DO NOT забывать про `chrome.scripting.executeScript` fallback при `chrome.tabs.sendMessage` — content scripts не пере-инжектируются автоматически в существующие вкладки после reload extension.
- DO NOT забывать про переустановку расширения при изменении `permissions` / `host_permissions` / `content_scripts.matches` — Chrome не активирует новые declarations на reload.
- DO NOT использовать `<a href target="_blank">` в попапе для открытия вкладки. Popup закрывается при клике, native navigation может не успеть — нужен `event.preventDefault()` + явный `chrome.tabs.create({url})`.
- DO NOT сохранять ввод текстовых полей попапа по событию `change`/`blur` — Chrome уничтожает попап при потере фокуса, и значение теряется. Писать по `input` с дебаунсом, напрямую через `chrome.storage.sync.set`, без предварительного `await loadSettings()` (попап умрёт на первом await).
- DO NOT добавлять `setInterval` без cleanup в `popup.ts` — Chrome убивает popup-процесс при закрытии, но это не повод плодить таймеры. Если нужен polling — один `setInterval` на весь lifecycle попапа.
- DO NOT держать listener-подписки в render-функциях попапа. Pattern: `renderX(doc, state)` чистая (idempotent — `replaceChildren`), `wireX(doc, handler)` цепляет listener один раз в `main()`. Иначе при `watchSettings` re-render будут дублирующиеся listeners.
- DO NOT добавлять новый toggle в попап минуя `popup-categories.ts` — descriptor там же где label, без него `renderToggles` не знает что отрисовать.
- DO NOT забывать обновлять подзаголовок-счётчик карточки в `formatCount`-функции `popup.ts` если меняется число тогглов в категории. Сам счётчик пересчитывается из `countCategoryToggles`, но русский plural нужно проверить (1 «настройка», 2-4 «настройки», 5+ «настроек», 11-14 «настроек»).
- DO NOT ставить `display: flex/grid/block` на элемент с HTML-атрибутом `hidden` без сопутствующего `[hidden] { display: none }` — class-селектор перебивает UA-таблицу, `el.hidden = true` визуально ничего не сделает.
- DO NOT использовать синхронный POST /api/chapters/resolve — только асинхронная модель (202 → polling → result).
- DO NOT делать fetch к localhost из content script — CORS блокирует. Healthcheck/parser-server запросы только через background service worker (у него есть host_permissions, нет CORS).
- DO NOT игнорировать порт native host ready-ответа — если `{status:"ready", port:3001}`, используем порт 3001 без повторного healthcheck polling.
- DO NOT обрабатывать «Extension context invalidated» как обычную ошибку parser-server — это не сетевая проблема, это смерть content script. Показывать кнопку «Перезагрузить страницу» вместо «Повторить».
- DO NOT добавлять ретраи в HttpClient — ошибка = мгновенный failed провайдера.
- DO NOT заменять весь `premium-free-feed-reader` при подгрузке следующей Premium Free главы — добавлять недостающие главы вниз.
- DO NOT переключать Premium Free sync на новый нижний `BuyChapterActions`, если на странице уже есть `premium-free-root`.
- DO NOT брать номер главы первым совпадением `том N глава M` из текста баннера покупки — строка «В том входят N глав (том 1 глава 6 - том 1 глава 50)» описывает состав тома, а у нижнего `BuyChapterActions` заголовка главы нет вовсе. Отрезать хвост про состав тома, при неоднозначности возвращать `null`.
- DO NOT собирать `RemangaChapterReference` из разных источников (номер главы из баннера + `chapterId` из href нативной стрелки) без сверки — противоречивая запись ломает и стрелки, и отметку прочитанного.
- DO NOT класть провайдерские `chapterId`/`chapterUrl` из `nextChapter` в remanga-поля reference — у wamanga/Senkuro это UUID, а не remanga id и не URL.
- DO NOT искать цель нативной стрелки по `chapterId` из href — шагать по потоку относительно главы, видимой в вьюпорте, и гасить событие только если действительно перешли.
- DO NOT обрывать резолв `chapterId` следующей главы из-за отсутствия `chapterId` у предыдущей — поиск по label от него не зависит, а запись без id не отмечается прочитанной.
- DO NOT прогонять `titleDir` через `encodeURIComponent` без предварительного `decodeURIComponent` — из URL страницы он приходит уже закодированным (`%3C29.04.2026%3E...`), двойное кодирование даёт 404 на `api/v2/titles/`, и главы потока молча остаются без remanga id.
- DO NOT полагаться на `stream.status` как на защиту от параллельной подгрузки главы — он поднимается уже после резолва ссылки, а скролл, viewport-sync и стрелки зовут загрузку одновременно. Нужен синхронный замок, иначе в `entries` копятся дубликаты одной главы и переход «вперёд» попадает в текущую.
- DO NOT читать номер текущей главы из лейбла в шапке читалки — его переписывает сам поток, и на следующем цикле обнаружения PF ключ root меняется, поток пересоздаётся и теряет загруженные главы.
- DO NOT оставлять уже отрисованные секции в контейнере при пересоздании потока — новый поток стартует с одной главы, старые секции продублируются по мере роста.
- DO NOT считать одиночный `scrollIntoView` достаточным для перехода к только что загруженной главе — её изображения набирают высоту следующие кадры, и переход промахивается в конец предыдущей главы.
- DO NOT считать провайдера-победителя «лучшим»: `resolveExternalChapter` отдаёт первого ответившего, а качество сканов у источников различается в разы (для проверенной главы wamanga 494px против teletype 690px). Более приоритетные провайдеры продолжают работать и отдают результат через `onUpgrade`.
- DO NOT подменять страницы улучшенным источником, не дождавшись `decode()` всех картинок и не проставив `img.width/height` — нарезка у источников разная (14 страниц против 35), секция схлопнется и утащит скролл.
- DO NOT исключать `cache` по имени в `.dockerignore` или в `tar --exclude` при упаковке parser-server — паттерн без якоря вырезает и `src/cache/`, сборка падает на `Cannot find module './cache/file-cache.js'`. Только `/cache`.
- DO NOT перезапускать контейнер `caddy` на VPS ради своего сайта — он общий для всех проектов. Конфиг применять через `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`.
- DO NOT оставлять parser-server на публичном адресе без `ACCESS_TOKEN` — иначе это открытый прокси картинок для всего интернета.
- DO NOT забывать `npm run native:build` после правок `native-host/*.ts` — Chrome исполняет `dist/host.js`, не source.
- DO NOT использовать `native:build` для локального Chrome'а — он оставляет `#!/usr/bin/env node`, nvm-node не в Chrome'овском PATH. Используй `native:install`, он переписывает shebang на абсолютный путь.

## Visuals (gpt-image-prompt + frontend-design)

Design state lives in `.design/`:
- [`brand.md`](.design/brand.md) — ChatGPT memory project name, priming prompt, brand summary
- [`tokens.md`](.design/tokens.md) — design tokens (colors, typography, spacing, radii)
- [`log.md`](.design/log.md) — chronological log of generated visuals with their prompts

**For any image / icon / UI mock generation:** the skill `gpt-image-prompt` reads/writes here automatically.

**For frontend code generation:** when writing TSX/CSS/Tailwind for this project, read `.design/tokens.md` first and use those token values instead of inventing your own. The brand summary in `.design/brand.md` provides additional context.

ChatGPT memory project name: `Remanga Reader Enhancer` — referenced in every image prompt to trigger memory recall.
