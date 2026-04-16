import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures');
const searchHtml = fs.readFileSync(path.join(fixturesDir, 'mangabuff-search.html'), 'utf8');
const titleHtml = fs.readFileSync(path.join(fixturesDir, 'mangabuff-title.html'), 'utf8');
const chapterHtml = fs.readFileSync(path.join(fixturesDir, 'mangabuff-chapter.html'), 'utf8');

describe('Mangabuff parser helpers', () => {
  it('extracts search results from mangabuff search HTML', async () => {
    const module = await import('../src/providers/mangabuff.js').catch(() => null);
    assert.ok(module, 'expected mangabuff provider module to exist');

    const results = (module as Record<string, unknown>).extractMangabuffSearchResults as
      | ((html: string) => unknown)
      | undefined;
    assert.equal(typeof results, 'function');
    assert.deepEqual(results?.(searchHtml), [
      {
        titleId: '1917',
        slug: 'vozvrashchenie-eretika',
        titleName: 'Возвращение Еретика',
        titleUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika',
      },
      {
        titleId: '33905',
        slug: 'vozvrashchenie-igroka',
        titleName: 'Возвращение игрока',
        titleUrl: 'https://mangabuff.ru/manga/vozvrashchenie-igroka',
      },
    ]);
  });

  it('extracts aliases and chapter entries from mangabuff title HTML', async () => {
    const module = await import('../src/providers/mangabuff.js').catch(() => null);
    assert.ok(module, 'expected mangabuff provider module to exist');

    const details = (module as Record<string, unknown>).extractMangabuffTitleDetails as
      | ((html: string, titleUrl: string) => unknown)
      | undefined;
    assert.equal(typeof details, 'function');
    assert.deepEqual(
      details?.(titleHtml, 'https://mangabuff.ru/manga/vozvrashchenie-eretika'),
      {
        titleId: 'vozvrashchenie-eretika',
        slug: 'vozvrashchenie-eretika',
        titleName: 'Возвращение Еретика',
        titleUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika',
        aliases: [
          "Chronicles Of The Martial God's Return",
          '무신귀환록',
          '帰還者のクロニクル',
        ],
        chapters: [
          {
            chapterId: '3-149',
            titleId: 'vozvrashchenie-eretika',
            chapter: '149',
            volume: 3,
            chapterUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika/3/149',
          },
          {
            chapterId: '3-148',
            titleId: 'vozvrashchenie-eretika',
            chapter: '148',
            volume: 3,
            chapterUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika/3/148',
          },
          {
            chapterId: '2-57',
            titleId: 'vozvrashchenie-eretika',
            chapter: '57',
            volume: 2,
            chapterUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika/2/57',
          },
        ],
      },
    );
  });

  it('extracts ordered pages from mangabuff chapter HTML', async () => {
    const module = await import('../src/providers/mangabuff.js').catch(() => null);
    assert.ok(module, 'expected mangabuff provider module to exist');

    const pages = (module as Record<string, unknown>).extractMangabuffChapterPages as
      | ((html: string, chapterUrl: string) => unknown)
      | undefined;
    assert.equal(typeof pages, 'function');
    assert.deepEqual(
      pages?.(chapterHtml, 'https://mangabuff.ru/manga/vozvrashchenie-eretika/3/148'),
      {
        chapterId: '500061',
        titleId: 'vozvrashchenie-eretika',
        chapter: '148',
        volume: 3,
        chapterUrl: 'https://mangabuff.ru/manga/vozvrashchenie-eretika/3/148',
        pages: [
          {
            index: 0,
            imageRef:
              'https://c3.mangabuff.ru/chapters/musingwihwanlog/3/148/1-aaa.jpeg?1770838589',
          },
          {
            index: 1,
            imageRef:
              'https://c3.mangabuff.ru/chapters/musingwihwanlog/3/148/2-bbb.jpeg?1770838589',
          },
          {
            index: 2,
            imageRef:
              'https://c3.mangabuff.ru/chapters/musingwihwanlog/3/148/3-ccc.jpeg?1770838589',
          },
        ],
      },
    );
  });
});
