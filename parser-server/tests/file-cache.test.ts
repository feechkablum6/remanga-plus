import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { FileCache } from '../src/cache/file-cache.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('FileCache', () => {
  let cache: FileCache;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-cache-test-'));
    cache = new FileCache(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null for cache miss', async () => {
    const result = await cache.get('nonexistent');
    assert.equal(result, null);
  });

  it('stores and retrieves data', async () => {
    const data = Buffer.from('test-image-data');
    await cache.set('chapter1-0', data);
    const result = await cache.get('chapter1-0');
    assert.deepEqual(result, data);
  });

  it('handles keys with special characters', async () => {
    const data = Buffer.from('special-data');
    await cache.set('folder/id-with:special', data);
    const result = await cache.get('folder/id-with:special');
    assert.deepEqual(result, data);
  });
});
