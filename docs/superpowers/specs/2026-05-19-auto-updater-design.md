# Автообновление Remanga Plus

Статус: design (2026-05-19)
Платформа: Windows 10/11 (x64), macOS (arm64)
Цель для пользователя: друг устанавливает расширение один раз — и забывает. Обновления прилетают молча, при следующем визите на remanga.org.

## Контекст

Сейчас в Remanga Plus нет механизма обновления. Каждый релиз — переустановка .pkg или .exe. Для друга это боль: «скачай новый файл, запусти, перезагрузи расширение». Хотим: установил один раз, дальше всё обновляется само.

Уже есть: NSIS-установщик для Windows, .pkg для macOS, GitHub Actions для сборки .exe, `host.js` (native host), который стартует при каждом визите на remanga.org.

## Подход: встроенный updater в native host

Native host (`host.js`) проверяет и применяет обновления при каждом запуске. Отдельный компонент не нужен — host и так запускается Chrome при открытии remanga.org. Это даёт бесплатный триггер проверки.

### Почему не отдельный updater-сервис

Scheduled task или фоновый процесс — дополнительная сложность: ещё один процесс на машине друга, проблемы с политиками Windows, отладка. Host.js уже запускается регулярно — этого достаточно.

### Почему не через расширение

Content script / background не может писать в `%LOCALAPPDATA%` (sandbox). Пришлось бы передавать команду в native host — двойная логика без реального выигрыша.

## Release-формат

GitHub Releases — хостинг. CI-пайплайн (уже есть для Windows, нужен для macOS) дополнительно публикует **update payload** — `.zip` без Node.js:

```
remanga-plus-update-1.2.3.zip
├── parser-server.js
├── host.js
└── extension/
    ├── manifest.json
    ├── content.js
    ├── background.js
    └── ...
```

Node.js-бинарник — отдельный asset (`node-v20.20.1-win-x64.exe` для Windows, `node-v20.20.1-darwin-arm64` для macOS). Скачивается только при первоначальной установке или при мажорном изменении версии Node (экстремально редко).

**Манифест версии** — `version.json` в корне установки:
```json
{ "version": "1.2.3", "nodeVersion": "20.20.1" }
```

Updater сравнивает локальный `version.json` с `tag_name` из GitHub Releases API. Если удалённая версия новее — скачивает update-zip.

### Версионирование

Используем semver из `package.json` (синхронизирован с `manifest.json` через `npm version`). Тег `v1.2.3` на Git → GitHub Release с двумя asset'ами:
1. `Remanga-Plus-Setup.exe` — полный инсталлер (с Node.js, для первой установки)
2. `remanga-plus-update-1.2.3.zip` — обновление без Node.js

На macOS:
1. `Remanga-Plus.pkg` — полный инсталлер
2. `remanga-plus-update-1.2.3.zip` — обновление без Node.js

## Механика обновления

### Проверка версии

При каждом запуске native host делает GET-запрос к GitHub Releases API:
```
GET https://api.github.com/repos/<owner>/<repo>/releases/latest
```

Сравнивает `tag_name` (без `v`-префикса) с `version.json`. Если удалённая версия > локальной — запускается обновление.

**Rate limiting:** GitHub API = 60 запросов/час для неавторизованных. Native host стартует ~1 раз при визите на remanga.org — лимит не исчерпать. Дополнительно кешируем ответ на 1 час.

**Офлайн:** если нет интернета или API недоступен — молча пропускаем, работаем с текущей версией. Никаких ошибок.

**Прерванное скачивание:** если zip скачался не полностью (размер не совпадает с `Content-Length`, битый архив, нет `ready`-флага) — удаляем временную папку `updates\X.Y.Z\` целиком и молча откатываемся на текущую версию. При следующем запуске — повторная попытка.

### Двухфазная замена файлов (Windows)

На Windows занятые файлы (parser-server.js, host.js) нельзя перезаписать пока процесс живёт. Поэтому замена двухфазная:

**Фаза 1 — подготовка (host.js при запуске):**
1. Скачивает `remanga-plus-update-X.Y.Z.zip` во временную папку `%LOCALAPPDATA%\Remanga Plus\updates\X.Y.Z\download.zip`
2. Распаковывает в `%LOCALAPPDATA%\Remanga Plus\updates\X.Y.Z\` (parser-server.js, host.js, extension/)
3. Пишет флаг `%LOCALAPPDATA%\Remanga Plus\updates\X.Y.Z\ready` — «обновление готово к применению»

**Фаза 2 — применение (host.js при следующем запуске):**
1. Проверяет наличие `updates\X.Y.Z\ready`
2. **Бэкапит текущие файлы** в `updates\previous\` (на случай отката)
3. Копирует файлы из `updates\X.Y.Z\` поверх установки (старый parser-server уже не запущен — файлы свободны)
4. Обновляет `version.json`
5. Удаляет `updates\X.Y.Z\`

### Аналог на macOS

Та же логика, но пути другие:
- Временная папка: `~/Library/Caches/Remanga Plus/updates/X.Y.Z/`
- Бэкап: `~/Library/Caches/Remanga Plus/updates/previous/`

### Rollback

Если после замены parser-server не отвечает на healthcheck (пятисекундный timeout), host.js:
1. Восстанавливает файлы из `updates\previous\`
2. Откатывает `version.json` на предыдущую версию
3. Удаляет `updates\X.Y.Z\`
4. Логирует ошибку, продолжает работать на старой версии

### Уведомление

Расширение видит версию parser-server из ответа native host (`{ status: "ready", port, version: "1.2.3" }`). Если версия изменилась — popup может показать маленький бейдж «Обновлено до 1.2.3». Никаких модальных окон или прерываний.

## Новый модуль: `native-host/updater.ts`

Чистый модуль, вызывается из `host.ts` при старте:

```typescript
// Псевдокод
export async function checkAndApplyUpdate(installDir: string): Promise<void> {
  // 1. Проверить pending update (фаза 2)
  if (hasPendingUpdate(installDir)) {
    await applyPendingUpdate(installDir);
    return;
  }

  // 2. Проверить GitHub Releases (фаза 1)
  const latest = await fetchLatestRelease();
  if (!latest || !isNewer(latest.version, currentVersion(installDir))) return;

  // 3. Скачать и распаковать
  await downloadAndPrepare(latest, installDir);
  // Фаза 2 произойдёт при следующем запуске
}
```

Вызов из `host.ts`:
```typescript
import { checkAndApplyUpdate } from "./updater.js";

async function main() {
  const updateResult = await checkAndApplyUpdate(installDir);
  // ... дальше обычная логика: ensure-parser-server
  // Ответ клиенту включает обновлённую версию:
  // { status: "ready", port: 3000, version: "1.2.3" }
}
```

Ответ native host дополняется полем `version` — текущая версия из `version.json`. Расширение использует это для отображения в popup и для обнаружения обновления.

**Важно:** updater не блокирует запуск parser-server. Проверка и скачивание происходят параллельно, не задерживая ответ клиенту. Pending-применение (фаза 2) — быстрое копирование файлов, занимает <1 секунды.

## Сборочный pipeline: обновления

Новый скрипт: `packaging/scripts/build-update-zip.mjs`

1. Запускается после `npm run build` (собирает `dist/`)
2. Запускает `bundle-parser.mjs` и `bundle-host.mjs`
3. Упаковывает `parser-server.js`, `host.js`, `extension/` (из `dist/`) в `.zip`
4. Генерирует `version.json` с текущей версией из `package.json`
5. Кладёт `version.json` в корень zip-архива

CI `.github/workflows/build-windows-installer.yml` дополняется:
- После сборки `.exe` — добавить шаг: собрать update-zip
- Опубликовать оба asset'а в GitHub Release

Для macOS: аналогичный шаг в существующем или новом workflow.

## Конфигурация

```
# environment variables (опционально, для dev/testing)
REMANGA_UPDATE_REPO=owner/repo      # GitHub repo для проверки обновлений
REMANGA_UPDATE_CHANNEL=stable        # stable | beta (пока только stable)
```

По умолчанию: repo = `anomalyco/remanga` (или актуальный), channel = `stable`.

## Ограничения

- **Первое обновление требует перезапуск.** Фаза 1 (скачивание) и фаза 2 (применение) происходят в разные запуски. Это необходимо для атомарности на Windows. Первый визит на remanga.org = скачивание. Второй визит = применение. Это нормально — друг всё равно переходит между страницами.
- **Обновление расширения требует reload.** Обновлённые файлы в `extension/` не подхватятся Chrome автоматически — нужен перезапуск расширения (в dev-режиме reload в `chrome://extensions`). В продакшене это ограничение sideload-расширений. Future: можно добавить `chrome.runtime.reload()` в background script, если новая версия background.js детектится.
- **Rate limiting GitHub API.** 60 запросов/час для неавторизованных — достаточно. Если превысим — молча пропускаем, без ошибок.
- **Нет delta-updates.** Каждый раз скачивается полный bundle (~2-3 MB). Для размера нашего пакета это пренебрежимо.
- **Нет отката Node.js.** Node.js обновляется только при полной переустановке. Это правильно — Node.js стабилен и меняется раз в год.

## Тестовый план

| Тест | Что проверяет |
|------|---------------|
| `updater.test.ts` (source-level) | `isNewer()` сравнение semver, `hasPendingUpdate()` проверяет флаг-файл, `fetchLatestRelease()` мокает GitHub API |
| `updater-apply.test.ts` (unit) | `applyPendingUpdate()` копирует файлы, бэкапит предыдущие, обновляет version.json, удаляет временную папку |
| `updater-rollback.test.ts` (unit) | rollback восстанавливает файлы и версию при падении healthcheck |
| `build-update-zip.test.mjs` (source-level) | скрипт содержит корректные пути, включает version.json, исключает node.exe |
| Интеграционный тест (ручной) | собрать update-zip → положить в `updates/1.2.4/` → запустить host.js → проверить что файлы обновились |

## Файлы проекта

Новые:
- `native-host/updater.ts` — логика проверки GitHub, скачивания, распаковки, применения
- `packaging/scripts/build-update-zip.mjs` — сборка update-zip для CI
- `version.json` — генерируется при build, включается в бандлы

Изменения:
- `native-host/host.ts` — вызов `checkAndApplyUpdate()` при старте
- `native-host/bundle-host.mjs` — включить `updater.ts` в бандл host.js
- `packaging/templates/installer.nsi` — добавить `version.json` в инсталлер
- `packaging/scripts/build-pkg.mjs` — добавить `version.json` в macOS-пакет
- `packaging/scripts/build-installer-windows.mjs` — добавить `version.json` в Windows-пакет
- `.github/workflows/build-windows-installer.yml` — шаг публикации update-zip
- `AGENTS.md` — обновить команды и архитектуру