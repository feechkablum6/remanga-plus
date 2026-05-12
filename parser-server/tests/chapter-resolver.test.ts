import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ExternalResolveResult } from '../src/providers/provider.interface.js';

const makeSuccessProvider = (name: string, delayMs: number = 0) => ({
  name,
  async searchTitles() {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    return [
      {
        titleId: 't-ok',
        slug: 't-ok',
        titleName: 'Возвращение Еретика',
        titleUrl: `https://${name}.example/t-ok`,
      },
    ];
  },
  async getTitleDetails(titleRef: string) {
    return {
      titleId: titleRef,
      slug: titleRef,
      titleName: 'Возвращение Еретика',
      titleUrl: `https://${name}.example/${titleRef}`,
      aliases: [],
      chapters: [
        {
          chapterId: '3-148',
          titleId: titleRef,
          chapter: '148',
          volume: 3,
          chapterUrl: `https://${name}.example/${titleRef}/3/148`,
        },
      ],
    };
  },
  async parseChapter(chapterRef: string) {
    return {
      chapterId: '500061',
      titleId: 't-ok',
      chapter: '148',
      volume: 3,
      chapterUrl: chapterRef,
      pages: [{ index: 0, imageRef: `https://${name}.example/img/1.jpg` }],
    };
  },
});

const makeNoMatchProvider = (name: string) => ({
  name,
  async searchTitles() {
    return [];
  },
  async getTitleDetails() {
    throw new Error(`${name}.getTitleDetails should not be reached`);
  },
  async parseChapter() {
    throw new Error(`${name}.parseChapter should not be reached`);
  },
});

const makeThrowingProvider = (name: string) => ({
  name,
  async searchTitles() {
    throw new Error(`${name} is offline`);
  },
  async getTitleDetails() {
    throw new Error(`${name}.getTitleDetails should not be reached`);
  },
  async parseChapter() {
    throw new Error(`${name}.parseChapter should not be reached`);
  },
});

const remanga = {
  titleDir: 'the-return-of-the-immortals_',
  titleName: 'Возвращение Еретика',
  aliases: [],
  tome: 3,
  chapter: '148',
  chapterId: 1910899,
  chapterUrl: 'https://remanga.org/manga/the-return-of-the-immortals_/1910899?page=1',
};

describe('resolveExternalChapter parallel', () => {
  it('returns success from the fastest provider', async () => {
    const module = await import('../src/resolve-chapter.js');
    const resolveExternalChapter = (module as Record<string, unknown>).resolveExternalChapter as
      | ((args: unknown) => Promise<unknown>)
      | undefined;
    assert.equal(typeof resolveExternalChapter, 'function');

    const providerFast = makeSuccessProvider('fast', 0);
    const providerSlow = makeSuccessProvider('slow', 200);

    const result = (await resolveExternalChapter?.({
      remanga,
      providers: [providerFast, providerSlow],
      providerPriority: ['fast', 'slow'],
      titleOverrides: {},
    })) as ExternalResolveResult;

    assert.equal(result.status, 'success');
    if (result.status === 'success') {
      assert.equal(result.provider, 'fast');
    }
  });

  it('returns success when one provider fails but another succeeds', async () => {
    const module = await import('../src/resolve-chapter.js');
    const resolveExternalChapter = (module as Record<string, unknown>).resolveExternalChapter as
      | ((args: unknown) => Promise<unknown>)
      | undefined;

    const result = (await resolveExternalChapter?.({
      remanga,
      providers: [makeThrowingProvider('broken'), makeSuccessProvider('working')],
      providerPriority: ['broken', 'working'],
      titleOverrides: {},
    })) as ExternalResolveResult;

    assert.equal(result.status, 'success');
    if (result.status === 'success') {
      assert.equal(result.provider, 'working');
    }
  });

  it('returns best failure when all providers fail', async () => {
    const module = await import('../src/resolve-chapter.js');
    const resolveExternalChapter = (module as Record<string, unknown>).resolveExternalChapter as
      | ((args: unknown) => Promise<unknown>)
      | undefined;

    const result = (await resolveExternalChapter?.({
      remanga,
      providers: [makeThrowingProvider('a'), makeNoMatchProvider('b')],
      providerPriority: ['a', 'b'],
      titleOverrides: {},
    })) as ExternalResolveResult;

    assert.equal(result.status, 'failure');
    if (result.status === 'failure') {
      assert.equal(result.reason, 'no_match');
    }
  });

  it('uses title overrides for the matching provider', async () => {
    const module = await import('../src/resolve-chapter.js');
    const resolveExternalChapter = (module as Record<string, unknown>).resolveExternalChapter as
      | ((args: unknown) => Promise<unknown>)
      | undefined;

    const provider = makeSuccessProvider('mangabuff');

    const result = (await resolveExternalChapter?.({
      remanga,
      providers: [provider],
      providerPriority: ['mangabuff'],
      titleOverrides: {
        'the-return-of-the-immortals_': {
          provider: 'mangabuff',
          titleId: 'vozvrashchenie-eretika',
        },
      },
    })) as ExternalResolveResult;

    assert.equal(result.status, 'success');
  });

  it('calls onProgress callback with provider statuses', async () => {
    const module = await import('../src/resolve-chapter.js');
    const resolveExternalChapter = (module as Record<string, unknown>).resolveExternalChapter as
      | ((args: unknown) => Promise<unknown>)
      | undefined;

    const progressCalls: Array<{ providerName: string; status: string }> = [];

    await resolveExternalChapter?.({
      remanga,
      providers: [makeSuccessProvider('mangabuff')],
      providerPriority: ['mangabuff'],
      titleOverrides: {},
      onProgress: (providerName: string, status: string) => {
        progressCalls.push({ providerName, status });
      },
    });

    const statuses = progressCalls.map((p) => p.status);
    assert.ok(statuses.includes('searching'), `expected 'searching' in ${JSON.stringify(statuses)}`);
    assert.ok(statuses.includes('success'), `expected 'success' in ${JSON.stringify(statuses)}`);
  });
});