import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  fetchMangalibAuthStatus,
  fetchMangalibBookmarks,
  type MangalibTokenProvider,
} from "../src/import-mangalib/mangalib-client.js";

const here = dirname(fileURLToPath(import.meta.url));
const bookmarksFixture = JSON.parse(
  readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/bookmarks.json"), "utf8"),
);
const authFixture = JSON.parse(
  readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/auth-mangalib.json"), "utf8"),
);

interface Recorded { url: string; headers: Record<string, string> }

function installFetchMock(routes: Record<string, unknown>): Recorded[] {
  const recorded: Recorded[] = [];
  (globalThis as { fetch: typeof fetch }).fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => {
    const url = typeof input === "string" ? input : input.toString();
    const headers: Record<string, string> = {};
    const h = init?.headers;
    if (h) {
      if (h instanceof Headers) h.forEach((v, k) => (headers[k.toLowerCase()] = v));
      else Object.entries(h as Record<string, string>).forEach(([k, v]) => (headers[k.toLowerCase()] = v));
    }
    recorded.push({ url, headers });
    for (const [pattern, body] of Object.entries(routes)) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(body), { status: 200 });
      }
    }
    return new Response("not mocked: " + url, { status: 404 });
  }) as typeof fetch;
  return recorded;
}

const tokenProvider: MangalibTokenProvider = async () => ({ token: "TKN", userId: 42 });

test("fetchMangalibAuthStatus → signedIn:true with username from /api/auth/me", async () => {
  installFetchMock({ "/api/auth/me": authFixture });
  const status = await fetchMangalibAuthStatus(tokenProvider);
  assert.equal(status.signedIn, true);
  assert.equal(typeof status.username, "string");
  assert.ok((status.username ?? "").length > 0);
});

test("fetchMangalibAuthStatus returns signedIn:false when token is null", async () => {
  const status = await fetchMangalibAuthStatus(async () => ({ token: null, userId: null }));
  assert.equal(status.signedIn, false);
});

test("fetchMangalibBookmarks sends Site-Id: 1 and Bearer token", async () => {
  const recorded = installFetchMock({ "/api/bookmarks": bookmarksFixture });
  await fetchMangalibBookmarks(tokenProvider, 1);
  const call = recorded.find((r) => r.url.includes("/api/bookmarks"));
  assert.ok(call, "expected a /api/bookmarks call");
  assert.equal(call!.headers["site-id"], "1");
  assert.equal(call!.headers["authorization"], "Bearer TKN");
});

test("fetchMangalibBookmarks aggregates across status 1..5", async () => {
  const recorded = installFetchMock({ "/api/bookmarks": bookmarksFixture });
  const out = await fetchMangalibBookmarks(tokenProvider, 1);
  // Five status calls all returning the 5-item fixture (test mock is static)
  assert.equal(out.length, 5 * bookmarksFixture.data.length);
  const statusCalls = recorded
    .filter((r) => r.url.includes("/api/bookmarks"))
    .map((r) => new URL(r.url).searchParams.get("status"));
  assert.deepEqual(statusCalls.sort(), ["1", "2", "3", "4", "5"]);
});

test("fetchMangalibBookmarks returns [] on 401", async () => {
  (globalThis as { fetch: typeof fetch }).fetch = (async () =>
    new Response("unauth", { status: 401 })) as typeof fetch;
  const out = await fetchMangalibBookmarks(tokenProvider, 1);
  assert.deepEqual(out, []);
});
