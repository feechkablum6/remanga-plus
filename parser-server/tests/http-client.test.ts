import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const noopBackoff = () => 0;

describe('HttpClient', () => {
  it('adds a default User-Agent header when none provided', async () => {
    const module = await import('../src/http/client.js');
    const { HttpClient } = module as { HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> } };

    let capturedHeaders: Headers | undefined;
    const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const client = new HttpClient({ fetchImpl: fakeFetch, backoffMs: noopBackoff });
    await client.request('https://example.com/');

    const ua = capturedHeaders?.get('user-agent');
    assert.ok(ua, 'user-agent header must be present');
    assert.match(ua ?? '', /Mozilla\/5\.0/);
    assert.match(ua ?? '', /Chrome/);
  });

  it('merges custom headers and keeps the default User-Agent', async () => {
    const { HttpClient } = (await import('../src/http/client.js')) as {
      HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> };
    };

    let capturedHeaders: Headers | undefined;
    const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const client = new HttpClient({ fetchImpl: fakeFetch, backoffMs: noopBackoff });
    await client.request('https://example.com/', {
      headers: { Accept: 'application/json' },
    });

    assert.ok(capturedHeaders?.get('user-agent'));
    assert.equal(capturedHeaders?.get('accept'), 'application/json');
  });

  it('lets the caller override User-Agent via custom headers', async () => {
    const { HttpClient } = (await import('../src/http/client.js')) as {
      HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> };
    };

    let captured: Headers | undefined;
    const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
      captured = new Headers(init?.headers);
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const client = new HttpClient({ fetchImpl: fakeFetch, backoffMs: noopBackoff });
    await client.request('https://example.com/', {
      headers: { 'User-Agent': 'CustomUA/1.0' },
    });

    assert.equal(captured?.get('user-agent'), 'CustomUA/1.0');
  });

  it('aborts the request after the configured timeout', async () => {
    const { HttpClient } = (await import('../src/http/client.js')) as {
      HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> };
    };

    let observedAborted = false;
    const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
      const signal = init?.signal;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 500);
        signal?.addEventListener('abort', () => {
          observedAborted = signal.aborted;
          clearTimeout(timer);
          resolve();
        });
      });
      if (signal?.aborted) {
        throw new DOMException('aborted', 'AbortError');
      }
      return new Response('late', { status: 200 });
    }) as typeof fetch;

    const client = new HttpClient({
      fetchImpl: fakeFetch,
      timeoutMs: 30,
      maxRetries: 0,
      backoffMs: noopBackoff,
    });

    await assert.rejects(
      client.request('https://example.com/'),
      (err: Error) => /timed out after 30/i.test(err.message),
    );
    assert.equal(observedAborted, true);
  });

  it('retries once on network error (TypeError) and then succeeds', async () => {
    const { HttpClient } = (await import('../src/http/client.js')) as {
      HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> };
    };

    let calls = 0;
    const fakeFetch = (async () => {
      calls += 1;
      if (calls === 1) {
        throw new TypeError('fetch failed');
      }
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const client = new HttpClient({ fetchImpl: fakeFetch, backoffMs: noopBackoff });
    const response = await client.request('https://example.com/');

    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  });

  it('retries on 503 but does not retry on 404', async () => {
    const { HttpClient } = (await import('../src/http/client.js')) as {
      HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> };
    };

    let calls503 = 0;
    const fetch503 = (async () => {
      calls503 += 1;
      if (calls503 < 2) return new Response('upstream down', { status: 503 });
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const client503 = new HttpClient({ fetchImpl: fetch503, backoffMs: noopBackoff });
    const r503 = await client503.request('https://example.com/');
    assert.equal(r503.status, 200);
    assert.equal(calls503, 2);

    let calls404 = 0;
    const fetch404 = (async () => {
      calls404 += 1;
      return new Response('nope', { status: 404 });
    }) as typeof fetch;

    const client404 = new HttpClient({ fetchImpl: fetch404, backoffMs: noopBackoff });
    const r404 = await client404.request('https://example.com/');
    assert.equal(r404.status, 404);
    assert.equal(calls404, 1);
  });

  it('gives up after maxRetries and throws, reporting the last status', async () => {
    const { HttpClient } = (await import('../src/http/client.js')) as {
      HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> };
    };

    let calls = 0;
    const fakeFetch = (async () => {
      calls += 1;
      return new Response('upstream down', { status: 503 });
    }) as typeof fetch;

    const client = new HttpClient({
      fetchImpl: fakeFetch,
      maxRetries: 2,
      backoffMs: noopBackoff,
    });

    await assert.rejects(
      client.request('https://example.com/'),
      (err: Error) => /503/.test(err.message),
    );
    assert.equal(calls, 3);
  });

  it('retries on 429 and honors Retry-After when numeric', async () => {
    const { HttpClient } = (await import('../src/http/client.js')) as {
      HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> };
    };

    let calls = 0;
    const fakeFetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': '0' },
        });
      }
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const client = new HttpClient({ fetchImpl: fakeFetch, backoffMs: noopBackoff });
    const response = await client.request('https://example.com/');

    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  });

  it('merges a caller-provided AbortSignal with the timeout signal', async () => {
    const { HttpClient } = (await import('../src/http/client.js')) as {
      HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> };
    };

    const externalController = new AbortController();
    let observedAborted = false;

    const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
      const signal = init?.signal;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 500);
        signal?.addEventListener('abort', () => {
          observedAborted = signal.aborted;
          clearTimeout(timer);
          resolve();
        });
      });
      throw new DOMException('aborted', 'AbortError');
    }) as typeof fetch;

    const client = new HttpClient({
      fetchImpl: fakeFetch,
      timeoutMs: 5_000,
      maxRetries: 0,
      backoffMs: noopBackoff,
    });

    setTimeout(() => externalController.abort(), 10);
    await assert.rejects(
      client.request('https://example.com/', { signal: externalController.signal }),
    );
    assert.equal(observedAborted, true);
  });
});
