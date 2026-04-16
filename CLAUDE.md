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

# Установка native host (macOS)
npm run native:install -- --extension-id <chrome-extension-id>

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

4. **Native host** (`native-host/`) — macOS Native Messaging launcher, автоматически поднимает parser-server при открытии remanga.org.

### Ключевые модули

| Файл | Роль |
|------|------|
| `settings.ts` | Контракт `chrome.storage.sync` — defaults, merge, clone |
| `reader-enhancer.ts` | Все UI-мутации читалки |
| `premium-free.ts` | Premium Free client: metadata extraction, config, response shapes |
| `parser-server.ts` | Shared constants: URLs, message types, host names |
| `popup-dismissal.ts` | Селекторы и эвристики автозакрытия попапов |
| `rail-overlay-state.ts` | Состояние оверлея правой панели |

## Конвенции

- **TypeScript strict mode** — `noEmit: true`, проверка типов через `tsc --noEmit`.
- **Нет фреймворков** — ванильный DOM, никакого React/Vue.
- **Per-button visibility** — правая панель управляется отдельными переключателями для каждой кнопки, не одним blanket hide.
- **Preset + nested toggles** — паттерн для `hideRightRail` и `enhanceSettingsMenu`: preset включает группу, nested toggles управляют элементами внутри.
- **Настройки** — `settings.ts` — единственный source of truth для defaults и merge. Любой новый toggle добавляется и в контракт, и в defaults.
- **AGENTS.md** — содержит подробные behavior patterns и failure patterns. Читай его перед работой с reader-enhancer, premium-free, popup-dismissal.
- **dist/** — только build output. Не редактировать напрямую.
- **Provider logic** — title overrides и приоритеты провайдеров живут в `parser-server/src/config.ts`, не в расширении.
- **Settings peek button** — при `hideRightRail + minimizeSettingsButton` оригинальная кнопка настроек полностью скрыта (безусловно, в том числе при открытой панели). На её место ставится невидимая клонированная кнопка в зоне `settings-peek-zone` на правом краю, которая проявляется через `opacity` при `:hover`/`:focus-within`. Никаких `translateX`-трюков с торчащей полоской.

## Anti-Patterns

- [2026-04-17] Peek-кнопка настроек дублировала оригинал, когда была открыта панель — условие `hideSettingsButton` зависело от `!readerDom.settingsPanel`. → Скрывать оригинал всегда при активном peek (`applyRightRailPreset && settings.minimizeSettingsButton`), панель не важна.
- [2026-04-17] Peek-кнопка "подглядывала" из-за края через `transform: translateX(calc(100% - 20px))` — выглядело кривым обрубком. → Использовать только `opacity: 0 → 1` с `pointer-events` переключением, без каких-либо `translateX` в стилях peek-button.
- [2026-04-17] Даже после фикса условия `hideSettingsButton` settings-group всё равно появлялся рядом с peek-кнопкой. Причина — `syncRightRailGroups` вызывает `markHidden(wrapper, !emptyInside)` и снимает `data-rre-hidden` у wrapper'а, если внутри есть хоть одна не-скрытая кнопка. Наш `finalizeMotionVisibility` помечает wrapper, но не помечает саму кнопку → wrapper "оживал". → В `syncRightRailGroups` перед unhide-веткой проверять `MOTION_TARGET_HIDDEN_ATTRIBUTE === "true"` и не трогать wrapper, если он явно скрыт motion-кодом.
