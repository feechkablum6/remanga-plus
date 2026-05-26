import assert from "node:assert/strict";
import test from "node:test";

import { getParserServerStatus } from "../src/background.js";

type SessionStore = Record<string, unknown>;

const installChromeStub = (sessionStore: SessionStore): (() => void) => {
  const original = globalThis.chrome;
  const stub = {
    runtime: {
      onMessage: { addListener: () => {} },
    },
    storage: {
      session: {
        get: (key: string, cb: (items: SessionStore) => void) => {
          cb({ [key]: sessionStore[key] });
        },
        set: (items: SessionStore, cb?: () => void) => {
          Object.assign(sessionStore, items);
          cb?.();
        },
      },
    },
  };
  globalThis.chrome = stub as unknown as typeof chrome;
  return () => {
    globalThis.chrome = original;
  };
};

test("getParserServerStatus falls back to default port when stale port is unreachable", async () => {
  const sessionStore: SessionStore = { "rre:discoveredPort": 3000 };
  const restoreChrome = installChromeStub(sessionStore);
  const requestedUrls: string[] = [];

  const fetchImpl = (async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    requestedUrls.push(url);
    if (url === "http://127.0.0.1:3000/health") {
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

  try {
    const result = await getParserServerStatus(fetchImpl);
    assert.deepEqual(result, { status: "ok", port: 7845 });
    assert.equal(sessionStore["rre:discoveredPort"], 7845);
    assert.ok(requestedUrls.includes("http://127.0.0.1:3000/health"));
    assert.ok(requestedUrls.includes("http://127.0.0.1:7845/health"));
  } finally {
    restoreChrome();
  }
});

test("getParserServerStatus returns down when neither port is healthy", async () => {
  const sessionStore: SessionStore = { "rre:discoveredPort": 3000 };
  const restoreChrome = installChromeStub(sessionStore);

  const fetchImpl = (async () => {
    throw new TypeError("offline");
  }) as typeof fetch;

  try {
    const result = await getParserServerStatus(fetchImpl);
    assert.deepEqual(result, { status: "down" });
  } finally {
    restoreChrome();
  }
});

test("getParserServerStatus returns ok on stored port when it is healthy", async () => {
  const sessionStore: SessionStore = { "rre:discoveredPort": 7846 };
  const restoreChrome = installChromeStub(sessionStore);

  const fetchImpl = (async (input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === "http://127.0.0.1:7846/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;

  try {
    const result = await getParserServerStatus(fetchImpl);
    assert.deepEqual(result, { status: "ok", port: 7846 });
  } finally {
    restoreChrome();
  }
});
