import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveRemangaBookmarkTypes,
  BOOKMARK_TYPES_CACHE_TTL_MS,
  type BookmarkType,
  type ResolverDeps,
} from "../src/bookmark-types-resolver.js";

interface FakeState {
  liveTypes: BookmarkType[];
  cached: { types: BookmarkType[]; updatedAt: number } | null;
  hiddenTypes: BookmarkType[];
  now: number;
  writes: { types: BookmarkType[] }[];
  liveCalls: number;
  hiddenCalls: number;
}

function makeDeps(overrides: Partial<FakeState> = {}): { deps: ResolverDeps; state: FakeState } {
  const state: FakeState = {
    liveTypes: [],
    cached: null,
    hiddenTypes: [],
    now: 1_700_000_000_000,
    writes: [],
    liveCalls: 0,
    hiddenCalls: 0,
    ...overrides,
  };
  const deps: ResolverDeps = {
    readFromExistingTabs: async () => {
      state.liveCalls += 1;
      return state.liveTypes;
    },
    readCached: async () => state.cached,
    writeCached: async (types) => {
      state.writes.push({ types });
      state.cached = { types, updatedAt: state.now };
    },
    openHiddenTabAndRead: async () => {
      state.hiddenCalls += 1;
      return state.hiddenTypes;
    },
    now: () => state.now,
  };
  return { deps, state };
}

test("resolver returns live tabs data and refreshes cache", async () => {
  const { deps, state } = makeDeps({
    liveTypes: [{ typeId: 1, name: "Читаю" }],
  });
  const out = await resolveRemangaBookmarkTypes(deps);
  assert.deepEqual(out, [{ typeId: 1, name: "Читаю" }]);
  assert.equal(state.hiddenCalls, 0);
  assert.equal(state.writes.length, 1);
});

test("resolver returns fresh cache without opening hidden tab", async () => {
  const cached = [{ typeId: 5, name: "Брошено" }];
  const { deps, state } = makeDeps({
    cached: { types: cached, updatedAt: 1_700_000_000_000 - 1000 },
  });
  const out = await resolveRemangaBookmarkTypes(deps);
  assert.deepEqual(out, cached);
  assert.equal(state.hiddenCalls, 0);
  assert.equal(state.writes.length, 0);
});

test("resolver opens hidden tab when cache is stale", async () => {
  const { deps, state } = makeDeps({
    cached: {
      types: [{ typeId: 9, name: "Старое" }],
      updatedAt: 1_700_000_000_000 - BOOKMARK_TYPES_CACHE_TTL_MS - 1,
    },
    hiddenTypes: [{ typeId: 2, name: "Прочитано" }],
  });
  const out = await resolveRemangaBookmarkTypes(deps);
  assert.deepEqual(out, [{ typeId: 2, name: "Прочитано" }]);
  assert.equal(state.hiddenCalls, 1);
  assert.equal(state.writes.length, 1);
});

test("resolver opens hidden tab when cache missing and no live tabs", async () => {
  const { deps, state } = makeDeps({
    hiddenTypes: [{ typeId: 7, name: "В планах" }],
  });
  const out = await resolveRemangaBookmarkTypes(deps);
  assert.deepEqual(out, [{ typeId: 7, name: "В планах" }]);
  assert.equal(state.hiddenCalls, 1);
  assert.equal(state.writes.length, 1);
});

test("resolver falls back to stale cache when hidden tab returns empty", async () => {
  const stale = [{ typeId: 3, name: "Заброшено" }];
  const { deps, state } = makeDeps({
    cached: { types: stale, updatedAt: 1_700_000_000_000 - BOOKMARK_TYPES_CACHE_TTL_MS - 1 },
    hiddenTypes: [],
  });
  const out = await resolveRemangaBookmarkTypes(deps);
  assert.deepEqual(out, stale);
  assert.equal(state.hiddenCalls, 1);
  assert.equal(state.writes.length, 0);
});

test("resolver returns empty list when no source has data", async () => {
  const { deps, state } = makeDeps({});
  const out = await resolveRemangaBookmarkTypes(deps);
  assert.deepEqual(out, []);
  assert.equal(state.liveCalls, 1);
  assert.equal(state.hiddenCalls, 1);
});

test("resolver does not open hidden tab when live tabs have data even if cache is stale", async () => {
  const { deps, state } = makeDeps({
    liveTypes: [{ typeId: 1, name: "Читаю" }],
    cached: { types: [], updatedAt: 0 },
  });
  await resolveRemangaBookmarkTypes(deps);
  assert.equal(state.hiddenCalls, 0);
});

test("resolver treats empty live list as miss and falls through to cache", async () => {
  const fresh = [{ typeId: 4, name: "Любимое" }];
  const { deps, state } = makeDeps({
    liveTypes: [],
    cached: { types: fresh, updatedAt: 1_700_000_000_000 - 1000 },
  });
  const out = await resolveRemangaBookmarkTypes(deps);
  assert.deepEqual(out, fresh);
  assert.equal(state.hiddenCalls, 0);
});
