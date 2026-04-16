import assert from "node:assert/strict";
import test from "node:test";

import { checkParserServerHealth, ensureParserServer } from "../src/background.js";

test("checkParserServerHealth returns true for an ok health response", async () => {
  const result = await checkParserServerHealth(
    3000,
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

test("ensureParserServer retries healthchecks on the discovered port after native launch", async () => {
  const originalChrome = globalThis.chrome;
  const originalFetch = globalThis.fetch;
  const requestedUrls: string[] = [];
  let port3001HealthAttempts = 0;
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

    if (url === "http://127.0.0.1:3000/health") {
      return new Response(JSON.stringify({ status: "starting" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url === "http://127.0.0.1:3001/health") {
      port3001HealthAttempts += 1;

      if (port3001HealthAttempts < 3) {
        return new Response(JSON.stringify({ status: "starting" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
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
    });
    assert.equal(requestedUrls[0], "http://127.0.0.1:3000/health");
    assert.ok(requestedUrls.slice(1).length >= 3);
    assert.ok(requestedUrls.slice(1).every((url) => url === "http://127.0.0.1:3001/health"));
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.chrome = originalChrome;
  }
});
