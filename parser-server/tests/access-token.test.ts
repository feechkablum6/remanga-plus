import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/server.js';

describe('access token', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-token-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('when no token is configured', () => {
    let app: FastifyInstance;

    beforeEach(() => {
      app = buildApp({ cacheDir: tmpDir });
    });

    afterEach(async () => {
      await app.close();
    });

    it('serves /api routes without any header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chapters/result/unknown-session',
      });

      assert.notEqual(res.statusCode, 401);
    });
  });

  describe('when a token is configured', () => {
    let app: FastifyInstance;

    beforeEach(() => {
      app = buildApp({ cacheDir: tmpDir, accessToken: 'secret-token' });
    });

    afterEach(async () => {
      await app.close();
    });

    it('rejects /api requests without the header', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chapters/result/unknown-session',
      });

      assert.equal(res.statusCode, 401);
    });

    it('rejects /api requests with a wrong token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chapters/result/unknown-session',
        headers: { 'x-parser-token': 'wrong-token' },
      });

      assert.equal(res.statusCode, 401);
    });

    it('rejects a token of a different length without throwing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chapters/result/unknown-session',
        headers: { 'x-parser-token': 'short' },
      });

      assert.equal(res.statusCode, 401);
    });

    it('accepts /api requests with the correct token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/chapters/result/unknown-session',
        headers: { 'x-parser-token': 'secret-token' },
      });

      assert.notEqual(res.statusCode, 401);
    });

    it('keeps /health open so container healthchecks work', async () => {
      const res = await app.inject({ method: 'GET', url: '/health' });

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), { status: 'ok' });
    });

    it('answers CORS preflight without a token', async () => {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/chapters/resolve',
      });

      assert.equal(res.statusCode, 204);
      assert.match(
        String(res.headers['access-control-allow-headers']),
        /X-Parser-Token/i,
      );
    });
  });
});
