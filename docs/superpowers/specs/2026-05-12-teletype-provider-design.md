# Teletype как провайдер Premium Free

## Проблема

На Remanga часть глав — платные. Существующие провайдеры (Mangabuff, Senkuro, InkStory) покрывают не все тайтлы. Teletype.in содержит много глав манги, выложенных переводчиками, но не интегрирован в расширение.

## Решение

Добавить Teletype.in как четвёртый провайдер в fallback-chain. Teletype не является каталогом манги — у него нет дерева глав и стандартизированных названий. Это блог-платформа, где каждый пост = одна глава. Поэтому провайдер работает иначе, чем Mangabuff/Senkuro: вместо поиска по каталогу он ищет конкретную главу напрямую.

## Архитектура

### Поиск главы

Запрос `https://teletype.in/search?query={название тайтла} {номер главы}` — SSR HTML. Из `window.__INITIAL_STATE__` парсим `search.search.articles[]` — список до 10 статей с `id`, `uri`, `title`, `author.uri`, `views`.

### Сопоставление статьи с главой

1. Из заголовка статьи regex'ом извлекается название манги и номер главы
2. Название сравнивается через fuzzy match (функция `normalize` из `resolve-chapter.ts`) с названием/алиасами тайтла на Remanga
3. Номер главы сравнивается точно

Если оба совпадают → статья считается подходящей.

### Извлечение картинок

По URI статьи (`/@{author.uri}/{article.uri}`) загружается страница. Из `__INITIAL_STATE__ → articles.items[id].text` парсятся `<image src="...">` — URL картинок на `img[1-4].teletype.in/files/...`. Количество картинок = количество страниц главы.

### Позиция в приоритете

`DEFAULT_PROVIDER_PRIORITY = ["mangabuff", "senkuro", "inkstory", "teletype"]` — Teletype последний. Срабатывает только если все три основных провайдера не дали успеха.

### Предупреждение в читалке

Результат Teletype помечается `unverified: true` в `ExternalResolveSuccess`. Расширение показывает баннер вверху читалки: «Эта глава найдена на Teletype — может не совпадать с оригиналом» с кнопкой «Открыть на Teletype» (ссылка на статью). Баннер информационный — картинки уже показаны.

### Ограничения

- Не кэшируем результаты поиска Teletype
- Не ищем next/prev главы через Teletype (`nextChapter: null`)
- Не используем пагинацию поиска — только первые 10 результатов
- Нет `searchTitles`/`getTitleDetails` — провайдер работает минуя стандартный flow

## Провайдер

Новый файл `parser-server/src/providers/teletype.ts`:

- `TeletypeProvider implements ExternalSourceProvider`
- Имя: `"teletype"`
- `searchTitles()` — возвращает пустой массив (не используется)
- `getTitleDetails()` — возвращает минимальный `SourceTitleDetails` с одной найденной главой
- `parseChapter(articleUrl)` — загружает страницу статьи, парсит `<image src>` из `__INITIAL_STATE__`
- `fetchImage(url)` — скачивает картинку с `img[1-4].teletype.in`
- `manualSearchUrl(query)` → `https://teletype.in/search?query=...`

### Модификация resolve-chapter.ts

Для Teletype стандартный flow `searchTitles → getTitleDetails → parseChapter` не работает, потому что поиск возвращает конкретные статьи, а не тайтлы. Вместо этого в цикле по `providerPriority` добавляется проверка: если провайдер не имеет `searchTitles` (или возвращает пустой массив), вызывается специальный метод `resolveChapterDirectly(remanga)`, который получает `RemangaChapterReference` и сам выполняет весь flow: поиск → сопоставление → парсинг. Результат помечается `unverified: true`.

Сопоставление использует те же `normalize` и `matchesExactTitle` из `resolve-chapter.ts` для сравнения названия. Номер главы — точное сравнение числа, извлечённого regex из заголовка статьи, с `remanga.chapter`.

### Модификация content script

В `reader-enhancer.ts` или `premium-free.ts` — отображение баннера для `unverified` глав.

### Модификация config.ts

`DEFAULT_PROVIDER_PRIORITY = ["mangabuff", "senkuro", "inkstory", "teletype"]`

### Модификация provider.interface.ts

Добавить `unverified?: boolean` в `ExternalResolveSuccess`.

## Тестирование

- Unit-тесты: парсинг `__INITIAL_STATE__` из HTML search page и article page
- Unit-тесты: извлечение номера главы из разных форматов заголовков
- Unit-тесты: fuzzy match названий
- Integration-тест: полный flow с fixture HTML