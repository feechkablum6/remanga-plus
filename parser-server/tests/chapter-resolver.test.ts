import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('resolveExternalChapter', () => {
  let calls: string[];

  beforeEach(() => {
    calls = [];
  });

  it('uses title overrides before provider search', async () => {
    const module = await import('../src/resolve-chapter.js').catch(() => null);
    assert.ok(module, 'expected resolve-chapter module to exist');

    const resolveExternalChapter = (module as Record<string, unknown>).resolveExternalChapter as
      | ((args: unknown) => Promise<unknown>)
      | undefined;
    assert.equal(typeof resolveExternalChapter, 'function');

    const provider = {
      name: 'mangabuff',
      async searchTitles() {
        calls.push('searchTitles');
        return [];
      },
      async getTitleDetails(titleRef: string) {
        calls.push(`getTitleDetails:${titleRef}`);
        return {
          titleId: titleRef,
          slug: titleRef,
          titleName: 'Возвращение Еретика',
          titleUrl: `https://mangabuff.ru/manga/${titleRef}`,
          aliases: ["Chronicles Of The Martial God's Return"],
          chapters: [
            {
              chapterId: '3-149',
              titleId: titleRef,
              chapter: '149',
              volume: 3,
              chapterUrl: `https://mangabuff.ru/manga/${titleRef}/3/149`,
            },
            {
              chapterId: '3-148',
              titleId: titleRef,
              chapter: '148',
              volume: 3,
              chapterUrl: `https://mangabuff.ru/manga/${titleRef}/3/148`,
            },
          ],
        };
      },
      async parseChapter(chapterRef: string) {
        calls.push(`parseChapter:${chapterRef}`);
        return {
          chapterId: '500061',
          titleId: 'vozvrashchenie-eretika',
          chapter: '148',
          volume: 3,
          chapterUrl: chapterRef,
          pages: [{ index: 0, imageRef: 'https://img.example/1.jpg' }],
        };
      },
    };

    const result = await resolveExternalChapter?.({
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
        chapterUrl: 'https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1',
      },
      providers: [provider],
      providerPriority: ['mangabuff'],
      titleOverrides: {
        'the-return-of-the-immortals_': {
          provider: 'mangabuff',
          titleId: 'vozvrashchenie-eretika',
        },
      },
    });

    assert.deepEqual(calls, [
      'getTitleDetails:vozvrashchenie-eretika',
      'parseChapter:https://mangabuff.ru/manga/vozvrashchenie-eretika/3/148',
    ]);
    assert.deepEqual(result, {
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
      totalPages: 1,
      pages: [
        {
          index: 0,
          imageRef: 'https://img.example/1.jpg',
        },
      ],
    });
  });

  it('returns no_match when no exact candidate can be confirmed', async () => {
    const module = await import('../src/resolve-chapter.js').catch(() => null);
    assert.ok(module, 'expected resolve-chapter module to exist');

    const resolveExternalChapter = (module as Record<string, unknown>).resolveExternalChapter as
      | ((args: unknown) => Promise<unknown>)
      | undefined;
    assert.equal(typeof resolveExternalChapter, 'function');

    const provider = {
      name: 'mangabuff',
      async searchTitles() {
        return [
          {
            titleId: 'vozvrashchenie-igroka',
            slug: 'vozvrashchenie-igroka',
            titleName: 'Возвращение игрока',
            titleUrl: 'https://mangabuff.ru/manga/vozvrashchenie-igroka',
          },
        ];
      },
      async getTitleDetails() {
        return {
          titleId: 'vozvrashchenie-igroka',
          slug: 'vozvrashchenie-igroka',
          titleName: 'Возвращение игрока',
          titleUrl: 'https://mangabuff.ru/manga/vozvrashchenie-igroka',
          aliases: [],
          chapters: [],
        };
      },
    };

    const result = await resolveExternalChapter?.({
      remanga: {
        titleDir: 'the-return-of-the-immortals_',
        titleName: 'Возвращение Еретика',
        aliases: ['The Return of the Immortals'],
        tome: 3,
        chapter: '148',
        chapterId: 1910899,
        chapterUrl: 'https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1',
      },
      providers: [provider],
      providerPriority: ['mangabuff'],
      titleOverrides: {},
    });

    assert.deepEqual(result, {
      status: 'failure',
      reason: 'no_match',
      provider: 'mangabuff',
      manualUrl:
        'https://mangabuff.ru/search?type=manga&q=%D0%92%D0%BE%D0%B7%D0%B2%D1%80%D0%B0%D1%89%D0%B5%D0%BD%D0%B8%D0%B5%20%D0%95%D1%80%D0%B5%D1%82%D0%B8%D0%BA%D0%B0',
    });
  });
});
