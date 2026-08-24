import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');
const liveFixturesDir = path.resolve(process.cwd(), 'fixtures/usagi');
const searchHtml = fs.readFileSync(path.join(fixturesDir, 'usagi-search.html'), 'utf8');
const titleHtml = fs.readFileSync(path.join(fixturesDir, 'usagi-title.html'), 'utf8');
const chapterHtml = fs.readFileSync(path.join(fixturesDir, 'usagi-chapter.html'), 'utf8');
const suggestionJson = fs.readFileSync(path.join(liveFixturesDir, 'search-suggestion.json'), 'utf8');
const chapterHtml6 = fs.readFileSync(path.join(liveFixturesDir, 'chapter-readerinit-6.html'), 'utf8');
const titleHeroHtml = fs.readFileSync(path.join(liveFixturesDir, 'title-hero-names.html'), 'utf8');

const PRIMARY = 'https://web.usagi.one';
const FALLBACK = 'https://a.zazaza.me';

type UsagiModule = {
  extractUsagiSearchResults: (html: string, baseUrl: string) => unknown;
  extractUsagiTitleDetails: (html: string, titleUrl: string, baseUrl: string) => {
    titleName: string;
    aliases: string[];
    chapters: Array<{ chapterId: string; chapter: string; volume: number; chapterUrl: string }>;
  };
  extractUsagiChapterPages: (html: string, chapterUrl: string) => {
    pages: Array<{ index: number; imageRef: string }>;
    chapterId: string;
  };
  extractUsagiSuggestionResults: (payload: unknown, baseUrl: string) => Array<{
    titleId: string;
    slug: string;
    titleName: string;
    titleUrl: string;
  }>;
  UsagiProvider: new (f?: typeof fetch, b?: readonly string[]) => {
    name: string;
    searchTitles: (q: string) => Promise<Array<{ titleUrl: string; slug: string }>>;
    manualSearchUrl: (q: string) => string;
  };
};

const loadModule = async (): Promise<UsagiModule> => {
  const module = await import('../src/providers/usagi.js');
  return module as unknown as UsagiModule;
};

describe('Usagi parser helpers', () => {
  it('extracts search results from Usagi search HTML', async () => {
    const module = await import('../src/providers/usagi.js').catch(() => null);
    assert.ok(module, 'expected usagi provider module to exist');

    const results = (module as Record<string, unknown>).extractUsagiSearchResults as
      | ((html: string, baseUrl: string) => unknown)
      | undefined;
    assert.equal(typeof results, 'function');
    assert.deepEqual(results?.(searchHtml, PRIMARY), [
      {
        titleId: 'pererojdenie_ubliudka_iz_klana_mecha',
        slug: 'pererojdenie_ubliudka_iz_klana_mecha',
        titleName: 'Перерождение ублюдка из клана Меча',
        titleUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha',
      },
      {
        titleId: 'ask_for_that_bastard',
        slug: 'ask_for_that_bastard',
        titleName: 'Спросите этого ублюдка!',
        titleUrl: 'https://web.usagi.one/ask_for_that_bastard',
      },
    ]);
    assert.deepEqual(results?.(searchHtml, FALLBACK), [
      {
        titleId: 'pererojdenie_ubliudka_iz_klana_mecha',
        slug: 'pererojdenie_ubliudka_iz_klana_mecha',
        titleName: 'Перерождение ублюдка из клана Меча',
        titleUrl: 'https://a.zazaza.me/pererojdenie_ubliudka_iz_klana_mecha',
      },
      {
        titleId: 'ask_for_that_bastard',
        slug: 'ask_for_that_bastard',
        titleName: 'Спросите этого ублюдка!',
        titleUrl: 'https://a.zazaza.me/ask_for_that_bastard',
      },
    ]);
  });

  it('extracts chapter list from Usagi title HTML', async () => {
    const module = await import('../src/providers/usagi.js').catch(() => null);
    assert.ok(module, 'expected usagi provider module to exist');

    const details = (module as Record<string, unknown>).extractUsagiTitleDetails as
      | ((html: string, titleUrl: string, baseUrl: string) => unknown)
      | undefined;
    assert.equal(typeof details, 'function');
    assert.deepEqual(
      details?.(titleHtml, 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha', PRIMARY),
      {
        titleId: 'pererojdenie_ubliudka_iz_klana_mecha',
        slug: 'pererojdenie_ubliudka_iz_klana_mecha',
        titleName: 'Перерождение ублюдка из клана Меча',
        titleUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha',
        aliases: ['The Bastard of Swordborne', 'Hoegwigeomgaui Seojaga Saneun Beop', '회귀검가의 서자가 사는 법'],
        chapters: [
          { chapterId: '2-93', titleId: 'pererojdenie_ubliudka_iz_klana_mecha', chapter: '93', volume: 2, chapterUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol2/93' },
          { chapterId: '2-92', titleId: 'pererojdenie_ubliudka_iz_klana_mecha', chapter: '92', volume: 2, chapterUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol2/92' },
          { chapterId: '2-91', titleId: 'pererojdenie_ubliudka_iz_klana_mecha', chapter: '91', volume: 2, chapterUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol2/91' },
          { chapterId: '1-4', titleId: 'pererojdenie_ubliudka_iz_klana_mecha', chapter: '4', volume: 1, chapterUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol1/4' },
          { chapterId: '1-3', titleId: 'pererojdenie_ubliudka_iz_klana_mecha', chapter: '3', volume: 1, chapterUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol1/3' },
          { chapterId: '1-2', titleId: 'pererojdenie_ubliudka_iz_klana_mecha', chapter: '2', volume: 1, chapterUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol1/2' },
          { chapterId: '1-1', titleId: 'pererojdenie_ubliudka_iz_klana_mecha', chapter: '1', volume: 1, chapterUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol1/1' },
        ],
      },
    );
  });

  it('extracts page images from Usagi chapter HTML via readerInit', async () => {
    const module = await import('../src/providers/usagi.js').catch(() => null);
    assert.ok(module, 'expected usagi provider module to exist');

    const pages = (module as Record<string, unknown>).extractUsagiChapterPages as
      | ((html: string, chapterUrl: string) => unknown)
      | undefined;
    assert.equal(typeof pages, 'function');
    assert.deepEqual(
      pages?.(chapterHtml, 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol1/1'),
      {
        chapterId: '30904',
        titleId: '1',
        chapter: '1',
        volume: 1,
        chapterUrl: 'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol1/1',
        pages: [
          { index: 0, imageRef: 'https://one-way.work/auto/98/51/79/1_res-py-01.png' },
          { index: 1, imageRef: 'https://one-way.work/auto/98/51/79/1_res-py-02.png' },
          { index: 2, imageRef: 'https://one-way.work/auto/98/51/79/1_res-py-03.png' },
        ],
      },
    );
  });

  it('extracts page images from readerInit with a 6th tuple element', async () => {
    const { extractUsagiChapterPages } = await loadModule();
    const parsed = extractUsagiChapterPages(
      chapterHtml6,
      'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha/vol1/1',
    );
    assert.equal(parsed.chapterId, '30904');
    assert.equal(parsed.pages.length, 3);
    assert.deepEqual(parsed.pages, [
      { index: 0, imageRef: 'https://one-way.work/auto/98/51/79/1_res-py-01.png' },
      { index: 1, imageRef: 'https://one-way.work/auto/98/51/79/1_res-py-02.png' },
      { index: 2, imageRef: 'https://one-way.work/auto/98/51/79/1_res-py-03.png' },
    ]);
  });

  it('extracts search results from /search/suggestion JSON, skipping person/collection/external', async () => {
    const { extractUsagiSuggestionResults } = await loadModule();
    assert.equal(typeof extractUsagiSuggestionResults, 'function');
    const results = extractUsagiSuggestionResults(JSON.parse(suggestionJson), PRIMARY);
    assert.deepEqual(
      results.map((r) => r.slug),
      [
        'pererojdenie_ubliudka_iz_klana_mecha',
        're_live',
        'solo_max_level_newbie',
      ],
    );
    assert.equal(
      results[0].titleName,
      'Перерождение ублюдка из клана Меча',
    );
    assert.equal(
      results[0].titleUrl,
      'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha',
    );
    assert.equal(results[2].slug, 'solo_max_level_newbie');
  });

  it('extracts aliases split by slash from cr-hero-names__alt', async () => {
    const { extractUsagiTitleDetails } = await loadModule();
    const details = extractUsagiTitleDetails(
      titleHeroHtml,
      'https://web.usagi.one/pererojdenie_ubliudka_iz_klana_mecha',
      PRIMARY,
    );
    assert.equal(details.titleName, 'Перерождение ублюдка из клана Меча');
    assert.deepEqual(details.aliases, [
      'Regressing as the Reincarnated Bastard of the Sword Clan',
      'Ублюдская жизнь вернувшегося мечника',
      '회귀검가의 서자가 사는 법',
    ]);
    assert.deepEqual(
      details.chapters.map((c) => c.chapterId),
      ['2-93', '1-1'],
    );
  });

  it('UsagiProvider.searchTitles GETs /search/suggestion?query= with Referer', async () => {
    const { UsagiProvider } = await loadModule();
    const urls: string[] = [];
    const referers: Array<string | null> = [];
    const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      urls.push(url);
      referers.push(new Headers(init?.headers).get('Referer'));
      return new Response(suggestionJson, {
        status: 200,
        headers: { 'content-type': 'application/json;charset=utf-8' },
      });
    }) as typeof fetch;

    const provider = new UsagiProvider(fakeFetch, [PRIMARY]);
    const results = await provider.searchTitles('Перерождение ублюдка');
    assert.equal(urls.length, 1);
    assert.equal(
      urls[0],
      `${PRIMARY}/search/suggestion?query=${encodeURIComponent('Перерождение ублюдка')}`,
    );
    assert.equal(referers[0], `${PRIMARY}/`);
    assert.equal(results.length, 3);
    assert.equal(results[0].slug, 'pererojdenie_ubliudka_iz_klana_mecha');
  });

  it('UsagiProvider falls back to secondary domain when primary fails', async () => {
    const { UsagiProvider } = await loadModule();

    let callIndex = 0;
    const fakeFetch = (async (url: string | URL, _init?: RequestInit): Promise<Response> => {
      callIndex++;
      if (url.toString().includes('web.usagi.one')) {
        return new Response('not found', { status: 503 });
      }
      return new Response(suggestionJson, {
        status: 200,
        headers: { 'content-type': 'application/json;charset=utf-8' },
      });
    }) as typeof fetch;

    const provider = new UsagiProvider(fakeFetch, [PRIMARY, FALLBACK]);
    assert.equal(provider.name, 'usagi');

    const results = await provider.searchTitles('test');
    assert.ok(results.length > 0, 'expected results from fallback domain');
    assert.ok(results[0].titleUrl.includes('a.zazaza.me'), 'expected fallback domain in URL');
    assert.ok(callIndex >= 2, 'expected both domains to be tried');
    assert.ok(
      String(results[0].titleUrl).includes('pererojdenie_ubliudka_iz_klana_mecha'),
    );
  });
});