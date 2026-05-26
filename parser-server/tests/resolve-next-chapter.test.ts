import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNextChapterMatch } from '../src/resolve-chapter.js';
import type { SourceTitleDetails } from '../src/providers/provider.interface.js';

const makeDetails = (
  chapters: SourceTitleDetails['chapters'],
): SourceTitleDetails => ({
  titleId: 't',
  slug: 't',
  titleName: 'T',
  titleUrl: 'https://x/t',
  aliases: [],
  chapters,
});

const ch = (id: string, chapter: string, volume = 1) => ({
  chapterId: id,
  titleId: 't',
  chapter,
  volume,
  chapterUrl: `https://x/t/${id}`,
});

describe('resolveNextChapterMatch', () => {
  it('returns the chapter with the next higher number when list is ASC', () => {
    const details = makeDetails([ch('c7', '7'), ch('c8', '8'), ch('c9', '9'), ch('c10', '10')]);
    const next = resolveNextChapterMatch(details, 'c9');
    assert.equal(next?.chapter, '10');
    assert.equal(next?.chapterId, 'c10');
  });

  it('returns the chapter with the next higher number when list is DESC', () => {
    const details = makeDetails([ch('c10', '10'), ch('c9', '9'), ch('c8', '8'), ch('c7', '7')]);
    const next = resolveNextChapterMatch(details, 'c9');
    assert.equal(next?.chapter, '10');
    assert.equal(next?.chapterId, 'c10');
  });

  it('returns null when matched chapter is the latest', () => {
    const details = makeDetails([ch('c7', '7'), ch('c8', '8'), ch('c9', '9')]);
    assert.equal(resolveNextChapterMatch(details, 'c9'), null);
  });

  it('returns null when matched chapter is not in the list', () => {
    const details = makeDetails([ch('c7', '7'), ch('c8', '8')]);
    assert.equal(resolveNextChapterMatch(details, 'nope'), null);
  });

  it('handles fractional chapters numerically (8.5 sits between 8 and 9)', () => {
    const details = makeDetails([
      ch('c8', '8'),
      ch('c9', '9'),
      ch('c8_5', '8.5'),
    ]);
    const next = resolveNextChapterMatch(details, 'c8');
    assert.equal(next?.chapter, '8.5');
  });

  it('crosses volume boundary (last chapter of vol 1 -> first of vol 2)', () => {
    const details = makeDetails([
      ch('v1c10', '10', 1),
      ch('v2c1', '1', 2),
      ch('v1c9', '9', 1),
    ]);
    const next = resolveNextChapterMatch(details, 'v1c10');
    assert.equal(next?.chapter, '1');
    assert.equal(next?.volume, 2);
  });
});
