# API Discovery Notes — MangaLib & Remanga (для импорта закладок)

Зафиксировано в живом браузере пользователя (`feechkablum6`, Chrome on macOS, 2026-05-10).

## Remanga

### Базовый домен и схема авторизации

- API: `https://api.remanga.org`
- Префикс — `/api/v2/` для большинства current endpoints. **Исключение:** mark-viewed на `/api/activity/views/` (v1).
- **Авторизация: Bearer token из cookie `token`** (домен `remanga.org`).
  - Берётся через `chrome.cookies.get({ url: 'https://remanga.org', name: 'token' })`.
  - Шлётся как `Authorization: bearer <token>` (lowercase «bearer» — см. `src/premium-free.ts:657`).
  - Запросы делаются с `credentials: 'omit'` — только Bearer header.
- В projetc-коде уже есть готовое чтение токена и POST-запрос отметки главы — см. `src/premium-free.ts:615` (`readRemangaAuthToken`) и `src/premium-free.ts:671` (`markRemangaChapterAsViewed`). **Переиспользовать**, не писать с нуля.

### Endpoints (подтверждены живыми ответами)

| Назначение | Метод | URL | Фикстура |
|------------|-------|-----|----------|
| Текущий пользователь | GET | `/api/v2/users/current/` | `tests/fixtures/import-mangalib/auth-remanga.json` |
| Поиск по названию | GET | `/api/v2/search/?query=<text>&count=<n>` | `tests/fixtures/import-mangalib/remanga-search.json` |
| Закладки пользователя | GET | `/api/v2/users/<user_id>/bookmarks/?ordering=-chapter_date&page=<n>&type=<type_id>` | `tests/fixtures/import-mangalib/remanga-bookmarks.json` |
| Главы тайтла (по ветке) | GET | `/api/v2/titles/chapters/?branch_id=<id>&page=<n>&count=<n>` | `tests/fixtures/import-mangalib/remanga-chapters.json` |
| Детали тайтла (для `branches[]`) | GET | `/api/v2/titles/<dir>/` | (не сохраняли — но shape известен, см. ниже) |
| Bookmark-state тайтла у текущего user'а | GET | `/api/v2/users/<user_id>/user_bookmarks/` | (не понадобилось) |
| Отметить главу прочитанной | POST | `/api/activity/views/` | body: `{"chapter": <id>}` |
| Добавить закладку | POST | **TBD — endpoint не подтверждён живым запросом** | предположительно `/api/v2/bookmarks/` или `/api/bookmarks/` с body `{title: <id>, type: <bookmark_type_id>}`. Подтвердить через interceptor когда будет **тестовый** аккаунт (правила запрещают писать на боевой). |

### Ключевые ноты по structure

**Поиск.** Корень = `{ meta: {total_items, total_pages, page}, results: [...] }`. Title fields:
- `id` (number), `dir` (string slug), `main_name`, `secondary_name`, `another_name` — string c разделителями ` / `.
- **План должен использовать `main_name`/`secondary_name`/`another_name`, а НЕ `rus_name`/`en_name`** (как было предположено в plan v1).

**Закладки.** Корень = `{ next, previous, results: [...] }`. Каждый row:
- `id` — bookmark id (не title id).
- `bookmark_type_id` (number) — это **ID кастомной/встроенной категории**, не enum 0..5. У пользователя видны категории `Все / Читаю / Буду читать / Прочитано / Брошено / Отложено / Не интересно / Любимое / <user-defined>`. У `feechkablum6` категория «Читаю» имеет `bookmark_type_id = 63988967` — это **per-user ID**, у разных пользователей будет разный.
- `title{id, dir, main_name, secondary_name, another_name, count_chapters, ...}` — большая вложенная структура.
- `read_progress`, `read_progress_total` — текущий и максимальный прогресс по главам **уже** на Remanga.
- `view_state`, `is_notify_paid_chapters`, `is_push_notify`, `rated`.
- **Для дубликата** достаточно собирать `Set<title.id>` из `results[].title.id`.
- **Для маппинга MangaLib статуса в Remanga категорию** мы не можем хардкодить ID типов — нужно сначала запросить список категорий пользователя и сопоставить по имени («Читаю» / «Прочитано» / …). Источник списка: либо `/api/v2/users/current/bookmark-types/` (TBD — проверить), либо собирать имена из `bookmark_type_id` через несколько запросов закладок (медленно). **Для плана:** добавить отдельную задачу `fetchRemangaBookmarkTypes()` ДО `addBookmark`.

**Главы.** Корень = `{ next, previous, results: [...] }`. Each chapter:
- `id` (number) — chapter id (передавать в `mark viewed`).
- `chapter` — **string** ("112"), `index` — number (numeric position).
- `tome` — number.
- `is_paid`, `is_bought`, `is_published`.
- **Для `selectChaptersToMark`** парсить `Number(c.chapter)` или использовать `c.index` (надёжнее).

**Title detail (`/api/v2/titles/<dir>/`).** Топ-уровень содержит:
- `branches: [{ id, count_chapters, publishers, ... }]` — список веток перевода.
- `active_branch` (number) — ID активной ветки. **Использовать его для chapters fetch.**
- `bookmark_type` — null или объект с id если уже в закладках.
- `count_chapters`, `dir`, `id`, `main_name`, `secondary_name`, `another_name`.

### Что отличается от изначального плана v1

1. Ответ search: `results`, не `content`. Имена: `main_name`/`secondary_name`/`another_name`, не `rus_name`/`en_name`.
2. Тип закладки — **per-user ID, не enum 0..5**. Нужно резолвить через список категорий.
3. Закладки лежат в `/api/v2/users/<id>/bookmarks/`, не в `/api/v2/users/current/bookmarks/`. **User ID сначала достать через `/api/v2/users/current/`**, потом подставить.
4. mark-viewed уже реализован в проекте (`src/premium-free.ts`), нужно переиспользовать.
5. Auth — Bearer из cookie `token`, не сессия `credentials: 'include'`.

## MangaLib

### Базовый домен и схема авторизации

- API: **`https://api.cdnlibs.org`** (НЕ `mangalib.me` и НЕ `api.lib.social`).
- Префикс — `/api/...` без версионирования.
- **Авторизация: Bearer JWT из `localStorage.auth.token.access_token`** на домене `mangalib.me`.
  - Токен живёт в localStorage, а **не** в cookie. `auth.token = { token_type: "Bearer", access_token: <988-char JWT>, refresh_token: <718-char>, expires_in, timestamp }`.
  - В JSON `auth.auth.metadata.auth_domains = {1: "mangalib.me", 2: "slashlib.me", 3: "ranobelib.me", 4: "hentailib.me", 5: "anilib.me"}` — единый Lib-аккаунт даёт доступ ко всем 5 сайтам.
- **`Authorization: Bearer <token>` обязателен.** Без него — 401 на /api/bookmarks.
- **`Site-Id: 1` обязателен в headers** для bookmarks (1 = manga). **Без него API возвращает 200 с `data: []`** даже при наличии закладок — это ловушка, на которой я завис при разведке.
- Запросы делаются с `credentials: 'omit'` (cookies игнорируются API).

### Архитектурное последствие для расширения

Service worker MV3 **не имеет прямого доступа к `localStorage` страниц mangalib.me**. Нужно один из двух путей:
1. **Content script** на `https://mangalib.me/*` читает `localStorage.auth.token.access_token` и шлёт в worker через `chrome.runtime.sendMessage`. Worker кэширует короткое время.
2. **`chrome.scripting.executeScript`** в фоновую вкладку mangalib.me — то же самое, но без content script.

Пункт 1 проще и согласуется с патернами проекта (уже есть content script на remanga). Добавим matches: `https://mangalib.me/*` для нового тонкого скрипта-«bridge».

Если на mangalib.me пользователь не залогинен — `auth.token` пуст или `localStorage.auth = {prevUrl, timestamp}` без `token`. Это критерий «✗ Не авторизован» в popup'е.

### Endpoints (подтверждены живыми ответами)

| Назначение | Метод | URL | Параметры | Фикстура |
|------------|-------|-----|-----------|----------|
| Текущий пользователь | GET | `https://api.cdnlibs.org/api/auth/me` | — | `tests/fixtures/import-mangalib/auth-mangalib.json` |
| Список закладок | GET | `https://api.cdnlibs.org/api/bookmarks` | `user_id`, `status`, `page`, `sort_by`, `sort_type` + header `Site-Id: 1` | `tests/fixtures/import-mangalib/bookmarks.json` (5 строк, по одной на каждый статус) |
| Пустой ответ закладок | GET | `https://api.cdnlibs.org/api/bookmarks?user_id=<id>&status=<n>&page=1` (без `Site-Id` или со 2..5) | — | `tests/fixtures/import-mangalib/bookmarks-empty.json` (для теста «нет закладок») |

### Status mapping (числовые значения MangaLib)

Из живых данных:

| status | категория MangaLib | → Remanga (по имени) |
|--------|--------------------|----------------------|
| 1 | Читаю | Читаю |
| 2 | В планах | Буду читать |
| 3 | Брошено | Брошено |
| 4 | Прочитано | Прочитано |
| 5 | Любимое | Любимое (если на Remanga есть такая категория у user'а), иначе → Читаю |

Это **числа**, не строки — маппинг в `status-mapping.ts` нужно перестроить с `Record<string, …>` на `Record<number, …>`.

### Структура bookmark item (важно для парсера)

Top-level: `{ data: [...], links: {...}, meta: {...} }`. Pagination через `meta.current_page`, `meta.next_page_url`.

Per item:
- `id` (number) — bookmark id.
- `type` (string, `"media-bookmark"`).
- `status` (number 1..5).
- `progress` (string, например `"0"`) — не число, нужно `Number()`.
- `meta { comment: bool, rewatches: null, item_number: null }`.
- `media { ... }` — данные тайтла:
  - `media.id`, `media.slug`, `media.slug_url`.
  - `media.name` — короткое название.
  - `media.rus_name`, `media.eng_name` — для matching.
  - `media.items_count { uploaded, total }` — сколько глав загружено / всего.
  - `media.metadata.last_item { number, branch_id, manga_id, ... }` — последняя доступная глава.
  - `media.cover { filename, thumbnail, default, md }`.
  - `media.site` (number, 1=manga).
  - `media.type { id, label }` — тип (Манхва/Манга/Маньхуа).
- `rating` (null или объект).

### Что отличается от изначального плана v1

1. Auth не cookie, а Bearer-токен из localStorage сайта mangalib.me — нужен content script.
2. Префикс не `mangalib.me/api/`, а `api.cdnlibs.org/api/` — отдельный CORS host.
3. Нужен header `Site-Id: 1` — без него API молчаливо возвращает пусто.
4. Структура items: `media.rus_name`/`media.eng_name`/`media.slug_url`, не `manga.slug`.
5. `progress` — string, не number.
6. Status — number (1..5), не string.
