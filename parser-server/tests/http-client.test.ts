import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('HttpClient', () => {
  it('adds a default User-Agent header when none provided', async () => {
    const module = await import('../src/http/client.js');
    const { HttpClient } = module as { HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> } };

    let capturedHeaders: Headers | undefined;
    const fakeFetch = (async (_url: string | URL, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const client = new HttpClient({ fetchImpl: fakeFetch });
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

    const client = new HttpClient({ fetchImpl: fakeFetch });
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

    const client = new HttpClient({ fetchImpl: fakeFetch });
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
    });

    await assert.rejects(
      client.request('https://example.com/'),
      (err: Error) => /timed out after 30/i.test(err.message),
    );
    assert.equal(observedAborted, true);
  });

  it('does not retry on network error when maxRetries defaults to 0', async () => {
    const { HttpClient } = (await import('../src/http/client.js')) as {
      HttpClient: new (opts: unknown) => { request: (u: string, i?: unknown) => Promise<Response> };
    };

    let calls = 0;
    const fakeFetch = (async () => {
      calls += 1;
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    const client = new HttpClient({ fetchImpl: fakeFetch });

    await assert.rejects(
      client.request('https://example.com/'),
      (err: unknown) => err instanceof TypeError,
    );
    assert.equal(calls, 1);
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
    });

    setTimeout(() => externalController.abort(), 10);
    await assert.rejects(
      client.request('https://example.com/', { signal: externalController.signal }),
    );
    assert.equal(observedAborted, true);
  });
});
