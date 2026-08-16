import assert from "node:assert/strict";
import test from "node:test";

import { checkParserServerHealth, ensureParserServer } from "../src/background.js";

test("checkParserServerHealth returns true for an ok health response", async () => {
  const result = await checkParserServerHealth(
    7845,
    (async () =>
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
  );

  assert.equal(result, true);
});

test("ensureParserServer returns install_required when native host is missing", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const runtimeState: {
    lastError?: { message: string };
    onMessage: {
      addListener: () => void;
    };
    sendNativeMessage: (
      hostName: string,
      message: unknown,
      callback: (response?: unknown) => void,
    ) => void;
  } = {
    onMessage: {
      addListener: () => {},
    },
    sendNativeMessage: (
      _hostName: string,
      _message: unknown,
      callback: (response?: unknown) => void,
    ) => {
      runtimeState.lastError = {
        message: "Specified native messaging host not found.",
      };
      callback(undefined);
      delete runtimeState.lastError;
    },
  };

  globalThis.fetch = (async () => {
    throw new TypeError("offline");
  }) as typeof fetch;

  const chromeStub = {
    runtime: runtimeState,
  };

  globalThis.chrome = chromeStub as unknown as typeof chrome;

  try {
    const result = await ensureParserServer();
    assert.deepEqual(result, {
      status: "install_required",
      detail: "Specified native messaging host not found.",
    });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
  }
});

test("ensureParserServer trusts the native host ready response after launch", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const runtimeState: {
    lastError?: { message: string };
    onMessage: {
      addListener: () => void;
    };
    sendNativeMessage: (
      hostName: string,
      message: unknown,
      callback: (response?: unknown) => void,
    ) => void;
  } = {
    onMessage: {
      addListener: () => {},
    },
    sendNativeMessage: (
      _hostName: string,
      _message: unknown,
      callback: (response?: unknown) => void,
    ) => {
      callback({ status: "ready", port: 3001 });
    },
  };

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requestedUrls.push(url);

    if (url === "http://127.0.0.1:7845/health") {
      return new Response(JSON.stringify({ status: "starting" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  const chromeStub = {
    runtime: runtimeState,
  };

  globalThis.chrome = chromeStub as unknown as typeof chrome;

  try {
    const result = await ensureParserServer();
    assert.deepEqual(result, {
      status: "ready",
      port: 3001,
      endpoint: { baseUrl: "http://127.0.0.1:3001", token: "" },
    });
    assert.equal(requestedUrls[0], "http://127.0.0.1:7845/health");
    assert.deepEqual(requestedUrls, ["http://127.0.0.1:7845/health"]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
  }
});

test("ensureParserServer returns failed when native host does not answer", async (t) => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const runtimeState = {
    onMessage: {
      addListener: () => {},
    },
    sendNativeMessage: () => {
      // Simulates a stuck native host process: Chrome accepted the request but
      // no response ever reaches the callback.
    },
  };

  globalThis.fetch = (async () => {
    throw new TypeError("offline");
  }) as typeof fetch;
  globalThis.chrome = { runtime: runtimeState } as unknown as typeof chrome;
  t.mock.method(globalThis, "setTimeout", ((callback: () => void, timeoutMs?: number) => {
    if (timeoutMs === 10_000) {
      queueMicrotask(callback);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }
    return originalSetTimeout(callback, timeoutMs);
  }) as typeof setTimeout);
  t.mock.method(globalThis, "clearTimeout", ((timer: ReturnType<typeof setTimeout>) => {
    if (timer === (0 as unknown as ReturnType<typeof setTimeout>)) {
      return;
    }
    originalClearTimeout(timer);
  }) as typeof clearTimeout);

  try {
    const result = await ensureParserServer();
    assert.deepEqual(result, {
      status: "failed",
      detail: "Native host did not answer in time.",
    });
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
  }
});

test("ensureParserServer falls back to default port when restored port is stale", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  const runtimeState = {
    onMessage: {
      addListener: () => {},
    },
    sendNativeMessage: () => {
      throw new Error("native host should not be called when default port is healthy");
    },
  };

  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    requestedUrls.push(url);
    if (url === "http://127.0.0.1:7846/health") {
      throw new TypeError("offline");
    }
    if (url === "http://127.0.0.1:7845/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;
  globalThis.chrome = { runtime: runtimeState } as unknown as typeof chrome;

  try {
    await ensureParserServer();
    const result = await ensureParserServer();
    assert.deepEqual(result, {
      status: "ready",
      port: 7845,
      endpoint: { baseUrl: "http://127.0.0.1:7845", token: "" },
    });
    assert.ok(requestedUrls.includes("http://127.0.0.1:7845/health"));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
  }
});

test("ensureParserServer uses the configured remote server and never calls the native host", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  let nativeCalls = 0;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrls.push(String(input));
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  globalThis.chrome = {
    runtime: {
      onMessage: { addListener: () => {} },
      sendNativeMessage: () => {
        nativeCalls += 1;
      },
    },
    storage: {
      sync: {
        get: (_defaults: unknown, callback: (items: unknown) => void) => {
          callback({
            parserServerUrl: "https://parser.example.com",
            parserServerToken: "secret",
          });
        },
      },
    },
  } as unknown as typeof chrome;

  try {
    const result = await ensureParserServer();

    assert.deepEqual(result, {
      status: "ready",
      endpoint: { baseUrl: "https://parser.example.com", token: "secret" },
    });
    assert.deepEqual(requestedUrls, ["https://parser.example.com/health"]);
    assert.equal(nativeCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
  }
});

test("ensureParserServer reports failure when the remote server is unreachable", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new TypeError("offline");
  }) as typeof fetch;

  globalThis.chrome = {
    runtime: { onMessage: { addListener: () => {} } },
    storage: {
      sync: {
        get: (_defaults: unknown, callback: (items: unknown) => void) => {
          callback({ parserServerUrl: "https://parser.example.com" });
        },
      },
    },
  } as unknown as typeof chrome;

  try {
    const result = await ensureParserServer();

    assert.equal(result.status, "failed");
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
  }
});
