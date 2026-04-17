import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMarkChapterViewedRequest,
  markRemangaChapterAsViewed,
  readRemangaAuthToken,
} from "../src/premium-free.js";

test("readRemangaAuthToken extracts url-decoded token cookie value", () => {
  const cookie =
    "promo-toast-tg=1; token=abc%2Bdef.jwt%2Fpayload; user=42; other=foo";

  assert.equal(readRemangaAuthToken(cookie), "abc+def.jwt/payload");
});

test("readRemangaAuthToken returns null when token cookie is absent", () => {
  assert.equal(readRemangaAuthToken("user=42; other=foo"), null);
});

test("readRemangaAuthToken returns null when cookie string is empty", () => {
  assert.equal(readRemangaAuthToken(""), null);
});

test("buildMarkChapterViewedRequest builds a POST /api/activity/views/ request", () => {
  const request = buildMarkChapterViewedRequest(1925343, "token-value");

  assert.deepEqual(request, {
    url: "https://api.remanga.org/api/activity/views/",
    method: "POST",
    headers: {
      Authorization: "bearer token-value",
      "Content-Type": "application/json",
    },
    body: '{"chapter":1925343}',
    credentials: "omit",
  });
});

test("buildMarkChapterViewedRequest rejects non-positive chapter ids", () => {
  assert.equal(buildMarkChapterViewedRequest(0, "token-value"), null);
  assert.equal(buildMarkChapterViewedRequest(-1, "token-value"), null);
  assert.equal(buildMarkChapterViewedRequest(1.5, "token-value"), null);
  assert.equal(buildMarkChapterViewedRequest(Number.NaN, "token-value"), null);
});

test("buildMarkChapterViewedRequest rejects empty tokens", () => {
  assert.equal(buildMarkChapterViewedRequest(1925343, ""), null);
});

test("markRemangaChapterAsViewed posts the request when the token is available", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchStub: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return new Response(null, { status: 204 });
  };

  const result = await markRemangaChapterAsViewed({
    chapterId: 1925343,
    cookie: "token=jwt-value",
    fetchImpl: fetchStub,
  });

  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.remanga.org/api/activity/views/");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, {
    Authorization: "bearer jwt-value",
    "Content-Type": "application/json",
  });
  assert.equal(calls[0].init.body, '{"chapter":1925343}');
  assert.equal(calls[0].init.credentials, "omit");
});

test("markRemangaChapterAsViewed returns false and skips fetch when token is missing", async () => {
  let called = false;
  const fetchStub: typeof fetch = async () => {
    called = true;
    return new Response(null, { status: 204 });
  };

  const result = await markRemangaChapterAsViewed({
    chapterId: 1925343,
    cookie: "user=42",
    fetchImpl: fetchStub,
  });

  assert.equal(result, false);
  assert.equal(called, false);
});

test("markRemangaChapterAsViewed swallows fetch errors and returns false", async () => {
  const fetchStub: typeof fetch = async () => {
    throw new Error("network down");
  };

  const result = await markRemangaChapterAsViewed({
    chapterId: 1925343,
    cookie: "token=jwt-value",
    fetchImpl: fetchStub,
  });

  assert.equal(result, false);
});

test("markRemangaChapterAsViewed returns false on non-2xx status codes", async () => {
  const fetchStub: typeof fetch = async () =>
    new Response(null, { status: 500 });

  const result = await markRemangaChapterAsViewed({
    chapterId: 1925343,
    cookie: "token=jwt-value",
    fetchImpl: fetchStub,
  });

  assert.equal(result, false);
});
