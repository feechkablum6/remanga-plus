import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';

const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');
const searchHtml = fs.readFileSync(path.join(fixturesDir, 'mangabuff-search.html'), 'utf8');
const titleHtml = fs.readFileSync(path.join(fixturesDir, 'mangabuff-title.html'), 'utf8');
const chapterHtml = fs.readFileSync(path.join(fixturesDir, 'mangabuff-chapter.html'), 'utf8');

describe('POST /api/chapters/resolve', () => {
  let app: FastifyInstance;
  let tmpDir: string;
  let originalFetch: typeof globalThis.fetch | undefined;
  let imageFetches: string[];

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-route-test-'));
    imageFetches = [];
    originalFetch = globalThis.fetch;

    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);

      if (url.startsWith('https://mangabuff.ru/search?type=manga&q=')) {
        return new Response(searchHtml, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }

      if (url === 'https://mangabuff.ru/manga/vozvrashchenie-eretika') {
        return new Response(titleHtml, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }

      if (url === 'https://mangabuff.ru/manga/vozvrashchenie-eretika/3/148') {
        return new Response(chapterHtml, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }

      if (url.startsWith('https://c3.mangabuff.ru/chapters/')) {
        imageFetches.push(url);
        return new Response(Buffer.from(`image:${url}`), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        });
      }

      return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch;

    app = buildApp({
      cacheDir: tmpDir,
      host: '127.0.0.1',
      port: 0,
    } as never);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
  });

  it('resolves mangabuff chapter pages and proxies images', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/chapters/resolve',
      payload: {
        remanga: {
          titleDir: 'the-return-of-the-immortals_',
          titleName: 'Возвращение Еретика',
          aliases: [
            'The Return of the Immortals',
            "Chronicles Of The Martial God's Return",
          ],
          tome: 3,
          chapter: '148',
          chapterId: 1910899,
          chapterUrl:
            'https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1',
        },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.deepEqual(body, {
      status: 'success',
      provider: 'mangabuff',
      matchedTitle: {
        titleId: 'vozvrashchenie-eretika',
        slug: 'vozvrashchenie-eretika',
        titleName: 'Возвращение Еретика',
        titleUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika',
      },
      matchedChapter: {
        chapterId: '3-148',
        chapter: '148',
        volume: 3,
        chapterUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika/3/148',
      },
      manualUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika/3/148',
      nextChapter: {
        chapterId: '3-149',
        chapter: '149',
        volume: 3,
        chapterUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika/3/149',
      },
      totalPages: 3,
      pages: [
        {
          index: 0,
          proxyUrl: '/api/images/mangabuff:3-148:0',
        },
        {
          index: 1,
          proxyUrl: '/api/images/mangabuff:3-148:1',
        },
        {
          index: 2,
          proxyUrl: '/api/images/mangabuff:3-148:2',
        },
      ],
    });

    const imageResponse = await app.inject({
      method: 'GET',
      url: body.pages[0].proxyUrl,
    });
    assert.equal(imageResponse.statusCode, 200);
    assert.equal(
      imageResponse.body,
      'image:https://c3.mangabuff.ru/chapters/musingwihwanlog/3/148/1-aaa.jpeg?1770838589',
    );

    const cachedImageResponse = await app.inject({
      method: 'GET',
      url: body.pages[0].proxyUrl,
    });
    assert.equal(cachedImageResponse.statusCode, 200);
    assert.equal(imageFetches.length, 1);
  });

  it('returns no_match with a manual search URL when exact title match is impossible', async () => {
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith('https://mangabuff.ru/search?type=manga&q=')) {
        return new Response(
          '<html><body><div class="cards"><a href="https://mangabuff.ru/manga/vozvrashchenie-igroka" class="cards__item"><div class="cards__name">Возвращение игрока</div></a></div></body></html>',
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          },
        );
      }

      return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch;
    await app.close();
    app = buildApp({
      cacheDir: tmpDir,
      host: '127.0.0.1',
      port: 0,
      titleOverrides: {},
    } as never);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chapters/resolve',
      payload: {
        remanga: {
          titleDir: 'the-return-of-the-immortals_',
          titleName: 'Возвращение Еретика',
          aliases: ['The Return of the Immortals'],
          tome: 3,
          chapter: '148',
          chapterId: 1910899,
          chapterUrl:
            'https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1',
        },
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      status: 'failure',
      reason: 'no_match',
      provider: 'mangabuff',
      manualUrl:
        'https://mangabuff.ru/search?type=manga&q=%D0%92%D0%BE%D0%B7%D0%B2%D1%80%D0%B0%D1%89%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%95%D1%80%D0%B5%D1%82%D0%B8%D0%BA%D0%B0',
    });
  });

  it('returns chapter_not_found when title matches but requested chapter is missing', async () => {
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith('https://mangabuff.ru/search?type=manga&q=')) {
        return new Response(searchHtml, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }

      if (url === 'https://mangabuff.ru/manga/vozvrashchenie-eretika') {
        return new Response(
          titleHtml
            .replace('href="https://mangabuff.ru/manga/vozvrashchenie-eretika/3/148"', 'href="https://mangabuff.ru/manga/vozvrashchenie-eretika/3/147"')
            .replace('data-chapter="148"', 'data-chapter="147"')
            .replace('Глава <span>148</span>', 'Глава <span>147</span>'),
          {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          },
        );
      }

      return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch;
    await app.close();
    app = buildApp({
      cacheDir: tmpDir,
      host: '127.0.0.1',
      port: 0,
      titleOverrides: {},
    } as never);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chapters/resolve',
      payload: {
        remanga: {
          titleDir: 'the-return-of-the-immortals_',
          titleName: 'Возвращение Еретика',
          aliases: ['The Return of the Immortals'],
          tome: 3,
          chapter: '148',
          chapterId: 1910899,
          chapterUrl:
            'https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1',
        },
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      status: 'failure',
      reason: 'chapter_not_found',
      provider: 'mangabuff',
      manualUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika',
    });
  });

  it('returns provider_error when upstream provider fetch fails', async () => {
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith('https://mangabuff.ru/search?type=manga&q=')) {
        throw new Error('network down');
      }

      return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch;
    await app.close();
    app = buildApp({
      cacheDir: tmpDir,
      host: '127.0.0.1',
      port: 0,
      titleOverrides: {},
    } as never);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chapters/resolve',
      payload: {
        remanga: {
          titleDir: 'the-return-of-the-immortals_',
          titleName: 'Возвращение Еретика',
          aliases: ['The Return of the Immortals'],
          tome: 3,
          chapter: '148',
          chapterId: 1910899,
          chapterUrl:
            'https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1',
        },
      },
    });

    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.json(), {
      status: 'failure',
      reason: 'provider_error',
      provider: 'mangabuff',
      manualUrl:
        'https://mangabuff.ru/search?type=manga&q=%D0%92%D0%BE%D0%B7%D0%B2%D1%80%D0%B0%D1%89%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%95%D1%80%D0%B5%D1%82%D0%B8%D0%BA%D0%B0',
    });
  });
});

describe('POST /api/chapters/resolve — Senkuro fallback', () => {
  const senkuroFixturesDir = path.resolve(process.cwd(), 'fixtures');
  const senkuroSearch = JSON.parse(
    fs.readFileSync(path.join(senkuroFixturesDir, 'senkuro-search.json'), 'utf8'),
  );
  const senkuroManga = JSON.parse(
    fs.readFileSync(path.join(senkuroFixturesDir, 'senkuro-manga.json'), 'utf8'),
  );
  const senkuroChapters = JSON.parse(
    fs.readFileSync(path.join(senkuroFixturesDir, 'senkuro-chapters.json'), 'utf8'),
  );
  const senkuroChapter = JSON.parse(
    fs.readFileSync(path.join(senkuroFixturesDir, 'senkuro-chapter.json'), 'utf8'),
  );

  let app: FastifyInstance;
  let tmpDir: string;
  let originalFetch: typeof globalThis.fetch | undefined;
  let senkuroCalls: number;
  let mangabuffCalls: number;

  const emptyMangabuffSearchHtml =
    '<html><body><div class="cards"></div></body></html>';

  const serveGraphql = (body: { query: string }): Response => {
    const { query } = body;
    if (/mangaChapters/.test(query)) {
      return new Response(JSON.stringify(senkuroChapters), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (/\bmangaChapter\s*\(/.test(query)) {
      return new Response(JSON.stringify(senkuroChapter), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (/\bmanga\s*\(/.test(query) && !/mangaChapter/.test(query)) {
      return new Response(JSON.stringify(senkuroManga), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (/\bmangas\s*\(/.test(query)) {
      return new Response(JSON.stringify(senkuroSearch), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ errors: [{ message: 'no match' }] }), {
      status: 200,
    });
  };

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-fallback-'));
    originalFetch = globalThis.fetch;
    senkuroCalls = 0;
    mangabuffCalls = 0;
  });

  afterEach(async () => {
    if (app) await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
  });

  it('falls back from mangabuff (no_match) to senkuro and returns a senkuro success', async () => {
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('mangabuff.ru')) {
        mangabuffCalls += 1;
        return new Response(emptyMangabuffSearchHtml, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (url === 'https://api.senkuro.com/graphql') {
        senkuroCalls += 1;
        const body = JSON.parse(String(init?.body ?? '{}')) as { query: string };
        return serveGraphql(body);
      }
      return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch;

    app = buildApp({
      cacheDir: tmpDir,
      host: '127.0.0.1',
      port: 0,
      titleOverrides: {},
    } as never);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chapters/resolve',
      payload: {
        remanga: {
          titleDir: 'tower-of-god',
          titleName: 'Башня Бога',
          aliases: ['Tower of God'],
          tome: 3,
          chapter: '650',
          chapterId: 99999,
          chapterUrl: 'https://remanga.org/manga/tower-of-god/99999?page=1',
        },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      status: string;
      provider: string;
      matchedTitle: { slug: string };
      matchedChapter: { chapter: string; volume: number };
      manualUrl: string;
      totalPages: number;
    };
    assert.equal(body.status, 'success');
    assert.equal(body.provider, 'senkuro');
    assert.equal(body.matchedTitle.slug, 'tower-of-god');
    assert.equal(body.matchedChapter.chapter, '650');
    assert.equal(body.matchedChapter.volume, 3);
    assert.equal(body.totalPages, 8);
    assert.ok(body.manualUrl.startsWith('https://senkuro.com/manga/tower-of-god/'));
    assert.ok(senkuroCalls >= 3, `senkuro was called ${senkuroCalls} times`);
    assert.ok(mangabuffCalls >= 1, 'mangabuff should have been tried first');
  });

  it('does not call senkuro when mangabuff already returned a success', async () => {
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('api.senkuro.com')) {
        senkuroCalls += 1;
        const body = JSON.parse(String(init?.body ?? '{}')) as { query: string };
        return serveGraphql(body);
      }
      if (url.startsWith('https://mangabuff.ru/search?type=manga&q=')) {
        return new Response(searchHtml, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (url === 'https://mangabuff.ru/manga/vozvrashchenie-eretika') {
        return new Response(titleHtml, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      if (url === 'https://mangabuff.ru/manga/vozvrashchenie-eretika/3/148') {
        return new Response(chapterHtml, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
      return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch;

    app = buildApp({
      cacheDir: tmpDir,
      host: '127.0.0.1',
      port: 0,
      titleOverrides: {},
    } as never);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chapters/resolve',
      payload: {
        remanga: {
          titleDir: 'the-return-of-the-immortals_',
          titleName: 'Возвращение Еретика',
          aliases: [
            'The Return of the Immortals',
            "Chronicles Of The Martial God's Return",
          ],
          tome: 3,
          chapter: '148',
          chapterId: 1910899,
          chapterUrl:
            'https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1',
        },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as { provider: string };
    assert.equal(body.provider, 'mangabuff');
    assert.equal(senkuroCalls, 0, 'senkuro must not be called on mangabuff success');
  });
});

describe('POST /api/chapters/resolve — InkStory fallback', () => {
  const inkstoryFixturesDir = path.resolve(process.cwd(), 'fixtures/inkstory');
  const inkSearch = JSON.parse(
    fs.readFileSync(path.join(inkstoryFixturesDir, 'api-search.json'), 'utf8'),
  );
  const inkBook = JSON.parse(
    fs.readFileSync(path.join(inkstoryFixturesDir, 'api-book.json'), 'utf8'),
  );
  const inkBranches = JSON.parse(
    fs.readFileSync(path.join(inkstoryFixturesDir, 'api-branches.json'), 'utf8'),
  );
  const inkChapters = JSON.parse(
    fs.readFileSync(path.join(inkstoryFixturesDir, 'api-chapters.json'), 'utf8'),
  );
  const inkChapter = JSON.parse(
    fs.readFileSync(path.join(inkstoryFixturesDir, 'api-chapter.json'), 'utf8'),
  );

  let app: FastifyInstance;
  let tmpDir: string;
  let originalFetch: typeof globalThis.fetch | undefined;
  let inkstoryCalls: number;

  const emptyHtml = '<html><body><div class="cards"></div></body></html>';

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-inkstory-'));
    originalFetch = globalThis.fetch;
    inkstoryCalls = 0;
  });

  afterEach(async () => {
    if (app) await app.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
  });

  it('falls through mangabuff and senkuro, then reads a chapter via InkStory API', async () => {
    // Solo Leveling: mangabuff empty, senkuro empty, inkstory success.
    // We use chapter #200 from api-chapter.json fixture.
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.includes('mangabuff.ru')) {
        return new Response(emptyHtml, {
          status: 200,
          headers: { 'content-type': 'text/html' },
        });
      }
      if (url === 'https://api.senkuro.com/graphql') {
        // return empty search, nothing else matters
        return new Response(
          JSON.stringify({ data: { mangas: { edges: [] } } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.startsWith('https://api.inkstory.net/')) {
        inkstoryCalls += 1;
        if (url.includes('/v2/books?search=')) {
          return new Response(JSON.stringify(inkSearch), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (/\/v2\/books\/[^?]+$/.test(url)) {
          return new Response(JSON.stringify(inkBook), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/v2/branches?book=')) {
          return new Response(JSON.stringify(inkBranches), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (url.includes('/v2/chapters?bookId=')) {
          return new Response(JSON.stringify(inkChapters), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (/\/v2\/chapters\/[a-f0-9-]+/.test(url)) {
          return new Response(JSON.stringify(inkChapter), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
      }
      return new Response('not found', { status: 404 });
    }) as typeof globalThis.fetch;

    app = buildApp({
      cacheDir: tmpDir,
      host: '127.0.0.1',
      port: 0,
      titleOverrides: {},
    } as never);
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/api/chapters/resolve',
      payload: {
        remanga: {
          titleDir: 'solo-leveling',
          titleName: 'Поднятие уровня в одиночку',
          aliases: ['Solo Leveling'],
          // volume intentionally omitted: InkStory and remanga can number volumes
          // differently across branches; the resolver falls back to first chapter
          // match by number when tome is not set.
          chapter: '200',
          chapterId: 777777,
          chapterUrl: 'https://remanga.org/manga/solo-leveling/777777',
        },
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      status: string;
      provider: string;
      matchedTitle: { slug: string };
      matchedChapter: { chapter: string; volume: number };
      manualUrl: string;
    };
    assert.equal(body.status, 'success');
    assert.equal(body.provider, 'inkstory');
    assert.equal(body.matchedTitle.slug, 'solo-leveling');
    assert.equal(body.matchedChapter.chapter, '200');
    assert.ok(body.manualUrl.startsWith('https://inkstory.net/content/solo-leveling/'));
    assert.ok(inkstoryCalls >= 4, `inkstory should have been called ≥4 times (search/book/branches/chapters/chapter)`);
  });
});

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildApp({
      cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), 'parser-health-test-')),
      host: '127.0.0.1',
      port: 0,
    } as never);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns ok status', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: 'ok' });
  });
});
