# Свой parser-server на VPS

По умолчанию parser-server поднимается на компьютере пользователя через Native
Messaging. Альтернатива — держать его на сервере: тогда Premium Free работает
без запущенного компьютера и доступен любому браузеру, где стоит расширение.

## Что развёрнуто

| Что | Где |
|-----|-----|
| Адрес | `https://remanga.178.253.39.105.sslip.io` |
| Каталог на VPS | `/srv/apps/remanga-parser/` |
| Контейнер | `remanga-parser`, порт 7845 внутри сети `proxy` |
| Конфиг Caddy | `/srv/proxy/sites/remanga-parser.caddy` |
| Ключ доступа | `/srv/apps/remanga-parser/.env`, переменная `ACCESS_TOKEN` |
| Кэш картинок | docker volume `remanga-parser_parser-cache` |

Домен — `sslip.io`, он резолвится в IP сервера без регистрации DNS. Сертификат
Caddy выпускает сам.

## Защита

Публичный адрес без защиты означает открытый прокси картинок для всего
интернета, поэтому сервер требует ключ:

- задан `ACCESS_TOKEN` — каждый запрос к `/api/*` должен нести заголовок
  `X-Parser-Token` с этим значением, иначе 401;
- `ACCESS_TOKEN` не задан — проверки нет (так работает локальная установка, где
  сервер слушает только 127.0.0.1);
- `/health` открыт всегда — иначе healthcheck контейнера не проходит;
- preflight `OPTIONS` пропускается без ключа.

Сравнение ключа — `timingSafeEqual`. Исходники: `parser-server/src/server.ts`.

## Настройка расширения

Попап → блок «СЕРВИС» → два поля, у каждого кнопка вставки из буфера:

1. адрес сервера (`https://…`) — пустое поле означает локальный сервер;
2. ключ доступа.

Значение пишется в `chrome.storage.sync` по событию `input` с дебаунсом 250 мс,
а не по `change`: Chrome сносит попап при потере фокуса, и запись, отложенная до
blur, до хранилища не доезжает. По той же причине попап пишет ключи напрямую
через `chrome.storage.sync.set`, без предварительного `loadSettings`.

Кнопка вставки читает буфер через `navigator.clipboard.readText()` — для этого в
манифесте есть разрешение `clipboardRead`. Если чтение запрещено, кнопка
краснеет и фокус уходит в поле, чтобы вставить руками.

Пока адрес задан, расширение не трогает Native Messaging вообще: локальный
сервер не запускается, а строка статуса показывает `Свой сервер · <хост>`.

Домен зашит в `host_permissions` в `public/manifest.json` — без этого фоновый
worker не сможет ходить на него за картинками. Другой адрес потребует правки
манифеста и переустановки расширения.

## Обновление сервера

```bash
cd parser-server
COPYFILE_DISABLE=1 tar czf /tmp/parser-src.tgz \
  package.json package-lock.json tsconfig.json Dockerfile .dockerignore src
scp /tmp/parser-src.tgz firstbyte:/tmp/
ssh firstbyte 'cd /srv/apps/remanga-parser/source && tar xzf /tmp/parser-src.tgz && rm /tmp/parser-src.tgz'
ssh firstbyte 'cd /srv/apps/remanga-parser && docker compose build && docker compose up -d'
```

Исключения в `tar` по имени папки (`--exclude=cache`) использовать нельзя: они
вырезают и `src/cache/`. По той же причине пути в `.dockerignore` якорные
(`/cache`, а не `cache`).

## Диагностика

```bash
ssh firstbyte 'docker ps --filter name=remanga-parser'
ssh firstbyte 'docker logs --tail 50 remanga-parser'
curl https://remanga.178.253.39.105.sslip.io/health
```

Конфиг Caddy применяется через `docker exec caddy caddy reload --config
/etc/caddy/Caddyfile` — контейнер `caddy` общий для всех сайтов сервера,
перезапускать его нельзя.

### «Ни один источник не содержит эту главу» по всем провайдерам разом

Сначала проверяй DNS, а не провайдеров. Хостовой `/etc/resolv.conf` на VPS указывает на
Google DNS, который с этой машины не отвечает (проверено 24.08.2026), поэтому контейнеру
в `compose.yaml` задан собственный resolver:

```yaml
dns:
  - 1.1.1.1
  - 9.9.9.9
```

Проверка, что контейнер видит внешний мир:

```bash
ssh firstbyte 'docker exec remanga-parser node -e "fetch(\"https://mangabuff.ru/\",{headers:{\"User-Agent\":\"Mozilla/5.0\"}}).then(r=>console.log(r.status)).catch(e=>console.log(\"FAIL\",e.message))"'
```

Признак именно DNS-поломки: `ping` до IP проходит, TCP 443 открыт, `curl --resolve` отдаёт
200, а обычный `curl` возвращает `000` с «Resolving timed out».

24.08.2026 с разрешения владельца хостовой `/etc/resolv.conf` тоже переведён на
`1.1.1.1` / `9.9.9.9` (8.8.8.8 оставлен третьим): без этого демон Docker не резолвит
`registry-1.docker.io` и `docker compose build` падает на скачивании `node:22-alpine`.
Бэкап прежнего файла — `/root/resolv.conf.backup-2026-08-24`. Файл общий для всех проектов
сервера, поэтому менять его только осознанно и с ведома владельца; `dns:` в compose оставлен
как страховка на случай, если хостовой resolv.conf снова перепишут.
