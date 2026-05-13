import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');
const searchHtml = fs.readFileSync(path.join(fixturesDir, 'usagi-search.html'), 'utf8');
const titleHtml = fs.readFileSync(path.join(fixturesDir, 'usagi-title.html'), 'utf8');
const chapterHtml = fs.readFileSync(path.join(fixturesDir, 'usagi-chapter.html'), 'utf8');

const PRIMARY = 'https://web.usagi.one';
const FALLBACK = 'https://a.zazaza.me';

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

  it('UsagiProvider falls back to secondary domain when primary fails', async () => {
    const module = await import('../src/providers/usagi.js').catch(() => null);
    assert.ok(module, 'expected usagi provider module to exist');
    const { UsagiProvider } = module as Record<string, unknown>;
    assert.equal(typeof UsagiProvider, 'function');

    let callIndex = 0;
    const fakeFetch = async (url: string | URL, _init?: RequestInit): Promise<Response> => {
      callIndex++;
      if (url.toString().includes('web.usagi.one')) {
        return new Response('not found', { status: 503 });
      }
      const htmlPath = url.toString().includes('/search') ? searchHtml : titleHtml;
      return new Response(htmlPath, { status: 200 });
    };

    const provider = new (UsagiProvider as new (f: typeof fetch, b?: readonly string[]) => { searchTitles(q: string): Promise<unknown>; name: string })(fakeFetch as unknown as typeof fetch, [PRIMARY, FALLBACK]);
    assert.equal(provider.name, 'usagi');

    const results = await provider.searchTitles('test') as Array<{titleUrl: string}>;
    assert.ok(results.length > 0, 'expected results from fallback domain');
    assert.ok(results[0].titleUrl.includes('a.zazaza.me'), 'expected fallback domain in URL');
    assert.ok(callIndex >= 2, 'expected both domains to be tried');
  });
});