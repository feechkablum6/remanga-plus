import test from "node:test";
import assert from "node:assert/strict";
import {
  computeScrollAfterSwap,
  pollPremiumFreeUpgrade,
} from "../src/premium-free-upgrade.js";

test("keeps the reader in place when the swap happens mid-chapter", () => {
  // Halfway through a 1000px chapter that becomes 2000px tall.
  const next = computeScrollAfterSwap({
    scrollY: 1500,
    oldTop: 1000,
    oldHeight: 1000,
    newTop: 1000,
    newHeight: 2000,
  });

  assert.equal(next, 2000);
});

test("absorbs the height change when the chapter is already above the viewport", () => {
  const next = computeScrollAfterSwap({
    scrollY: 5000,
    oldTop: 1000,
    oldHeight: 1000,
    newTop: 1000,
    newHeight: 1600,
  });

  assert.equal(next, 5600);
});

test("leaves the scroll alone when the chapter is still below the viewport", () => {
  const next = computeScrollAfterSwap({
    scrollY: 200,
    oldTop: 1000,
    oldHeight: 1000,
    newTop: 1000,
    newHeight: 4000,
  });

  assert.equal(next, null);
});

test("does not move when heights match and the chapter is above", () => {
  const next = computeScrollAfterSwap({
    scrollY: 5000,
    oldTop: 1000,
    oldHeight: 1000,
    newTop: 1000,
    newHeight: 1000,
  });

  assert.equal(next, null);
});

test("never returns a negative offset", () => {
  const next = computeScrollAfterSwap({
    scrollY: 10,
    oldTop: 0,
    oldHeight: 1000,
    newTop: 0,
    newHeight: 10,
  });

  assert.ok(next !== null && next >= 0);
});

const stubFetch = (responses: unknown[]): typeof fetch => {
  let call = 0;
  return (async () => {
    const body = responses[Math.min(call, responses.length - 1)];
    call += 1;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
};

test("polling returns the upgraded result once the server has one", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubFetch([
    { status: "pending" },
    { status: "ready", result: { provider: "teletype" } },
  ]);

  try {
    const result = await pollPremiumFreeUpgrade({
      baseUrl: "https://parser.example.com",
      headers: {},
      sessionId: "abc",
      wait: async () => {},
    });

    assert.deepEqual(result, { provider: "teletype" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("polling gives up quietly when no better source exists", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubFetch([{ status: "none" }]);

  try {
    const result = await pollPremiumFreeUpgrade({
      baseUrl: "https://parser.example.com",
      headers: {},
      sessionId: "abc",
      wait: async () => {},
    });

    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("polling stops when aborted", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubFetch([{ status: "pending" }]);
  const controller = new AbortController();
  controller.abort();

  try {
    const result = await pollPremiumFreeUpgrade({
      baseUrl: "https://parser.example.com",
      headers: {},
      sessionId: "abc",
      signal: controller.signal,
      wait: async () => {},
    });

    assert.equal(result, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
