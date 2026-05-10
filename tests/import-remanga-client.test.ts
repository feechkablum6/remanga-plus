import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  fetchRemangaAuthStatus,
  searchRemanga,
  fetchExistingRemangaBookmarks,
  fetchRemangaBookmarkTypes,
  addRemangaBookmark,
  fetchRemangaTitleDetail,
  fetchRemangaChapters,
  type RemangaTokenProvider,
} from "../src/import-mangalib/remanga-client.js";

const here = dirname(fileURLToPath(import.meta.url));
const auth = JSON.parse(readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/auth-remanga.json"), "utf8"));
const search = JSON.parse(readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/remanga-search.json"), "utf8"));
const bookmarks = JSON.parse(readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/remanga-bookmarks.json"), "utf8"));
const chapters = JSON.parse(readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/remanga-chapters.json"), "utf8"));

interface Call { url: string; init?: RequestInit }

function installMock(routes: Record<string, { status?: number; body: unknown }>): Call[] {
  const calls: Call[] = [];
  (globalThis as { fetch: typeof fetch }).fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    for (const [pattern, { status = 200, body }] of Object.entries(routes)) {
      if (url.includes(pattern)) return new Response(JSON.stringify(body), { status });
    }
    return new Response("not mocked", { status: 404 });
  }) as typeof fetch;
  return calls;
}

const provider: RemangaTokenProvider = async () => "TOK";

test("fetchRemangaAuthStatus parses username from /api/v2/users/current/", async () => {
  installMock({ "users/current": { body: auth } });
  const s = await fetchRemangaAuthStatus(provider);
  assert.equal(s.signedIn, true);
  assert.ok(typeof s.username === "string");
});

test("fetchRemangaAuthStatus signedIn:false when token absent", async () => {
  const s = await fetchRemangaAuthStatus(async () => null);
  assert.equal(s.signedIn, false);
});

test("searchRemanga returns up to 3 candidates with main_name/secondary_name/another_name", async () => {
  installMock({ "/api/v2/search": { body: search } });
  const out = await searchRemanga(provider, "Solo Leveling");
  assert.ok(out.length >= 1 && out.length <= 3);
  assert.equal(typeof out[0].id, "number");
  assert.equal(typeof out[0].dir, "string");
  assert.equal(typeof out[0].main_name, "string");
});

test("fetchRemangaBookmarkTypes returns array of {id, name}", async () => {
  installMock({ "bookmark-types": { body: { content: [{ id: 1, name: "Читаю" }, { id: 2, name: "Прочитано" }] } } });
  const out = await fetchRemangaBookmarkTypes(provider);
  assert.equal(out.length, 2);
  assert.equal(out[0].name, "Читаю");
});

test("fetchExistingRemangaBookmarks returns Set of title.id", async () => {
  installMock({ "users/0/bookmarks": { body: bookmarks } });
  const out = await fetchExistingRemangaBookmarks(provider, 0);
  assert.ok(out instanceof Set);
  assert.ok(out.size > 0);
});

test("addRemangaBookmark POSTs body {title, type}", async () => {
  const calls = installMock({ "/api/v2/bookmarks/": { body: { content: { id: 1 } } } });
  await addRemangaBookmark(provider, 42, 7);
  const post = calls.find((c) => c.init?.method === "POST");
  assert.ok(post);
  const body = JSON.parse(String(post!.init!.body));
  assert.equal(body.title, 42);
  assert.equal(body.type, 7);
});

test("fetchRemangaTitleDetail extracts active_branch", async () => {
  installMock({ "/api/v2/titles/": { body: { id: 1, dir: "x", active_branch: 555, branches: [{ id: 555 }] } } });
  const out = await fetchRemangaTitleDetail(provider, "x");
  assert.equal(out?.activeBranch, 555);
});

test("fetchRemangaChapters returns {id, index} array", async () => {
  installMock({ "titles/chapters": { body: chapters } });
  const out = await fetchRemangaChapters(provider, 59280);
  assert.ok(Array.isArray(out));
  for (const c of out) {
    assert.equal(typeof c.id, "number");
    assert.equal(typeof c.index, "number");
  }
});
