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
