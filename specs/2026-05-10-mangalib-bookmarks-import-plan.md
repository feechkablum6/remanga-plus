# MangaLib → Remanga Bookmarks Import — Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development или superpowers:agent-team-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a feature to the Remanga Reader Enhancer Chrome extension that imports a user's bookmarks (titles + status + chapter progress) from MangaLib (`api.cdnlibs.org`) into Remanga (`api.remanga.org`).

**Architecture:**
- Popup hosts entry point + live auth-status of both sites.
- New extension page `import.html` (own tab) runs the flow: fetch MangaLib bookmarks → search Remanga by title → preview table with select-all-by-default → execute writes with progress.
- State persisted in `chrome.storage.local` to survive popup close.
- Pure logic in `src/import-mangalib/*` is unit-tested with `node:test` against captured HTTP fixtures in `tests/fixtures/import-mangalib/`.
- New thin content script on `mangalib.me` exposes the page's `localStorage.auth.token.access_token` to the service worker via `runtime.sendMessage` (token cannot be read from worker context).

**Tech Stack:**
- TypeScript strict (existing `tsc --noEmit`).
- Vite IIFE bundles — fourth bundle for `import-page.ts` (existing: content, background, popup).
- `chrome.storage.local` for resume state.
- `fetch` for both APIs:
  - **Remanga**: `Authorization: bearer <token>` from cookie `token` (existing helper `src/premium-free.ts:615` `readRemangaAuthToken`), `credentials: 'omit'`.
  - **MangaLib**: `Authorization: Bearer <token>` from page localStorage via content-script bridge, **plus required `Site-Id: 1` header**, `credentials: 'omit'`.
- Tests: `node:test` + `node:assert/strict` + jsdom (already wired in `tests/setup-dom.ts`).

**References:**
- Spec: [`specs/2026-05-10-mangalib-bookmarks-import-design.md`](2026-05-10-mangalib-bookmarks-import-design.md)
- Discovery notes: [`specs/2026-05-10-import-discovery-notes.md`](2026-05-10-import-discovery-notes.md) — **read first**, contains all real endpoint details, headers, and data shapes captured from live sessions.
- Fixtures: [`tests/fixtures/import-mangalib/`](../tests/fixtures/import-mangalib/) — 7 JSON files captured from live API. **Tests use these fixtures, not synthetic data.**
- Project conventions: `CLAUDE.md`, `AGENTS.md`.

**Operational rule (from user feedback memory):**
> Не выполнять реальных POST-запросов (`addBookmark`, `markChapterViewed`) на боевой аккаунт пользователя без его явного per-action подтверждения. На стадии smoke-теста — либо dry-run preview, либо тестовый аккаунт.

This means **POST endpoints in `remanga-client.ts` (`addRemangaBookmark`) are TBD by URL/body** — confirmed only at smoke-test time on a test account. The plan codes a best-guess endpoint (`POST /api/v2/bookmarks/`) and a clear isolation point so it can be adjusted in one place.

---

## File Structure

### New files

| Path | Responsibility |
|------|----------------|
| `src/import-mangalib/status-mapping.ts` | Pure: MangaLib `status` (number 1..5) → Remanga category name. |
| `src/import-mangalib/title-matcher.ts` | Pure: normalise titles + score Remanga search candidates. |
| `src/import-mangalib/bookmarks-parser.ts` | Pure: raw MangaLib `/api/bookmarks` JSON → normalised `MangalibBookmark[]`. |
| `src/import-mangalib/chapter-progress.ts` | Pure: Remanga chapter list + last read on mangalib → array of `chapter_id` to mark viewed. |
| `src/import-mangalib/state.ts` | I/O: serialise/deserialise resume state to `chrome.storage.local`. |
| `src/import-mangalib/mangalib-client.ts` | I/O: `fetchMangalibAuthStatus`, `fetchMangalibBookmarks` against `api.cdnlibs.org`. |
| `src/import-mangalib/remanga-client.ts` | I/O: `fetchRemangaAuthStatus`, `searchRemanga`, `fetchExistingRemangaBookmarks`, `fetchRemangaBookmarkTypes`, `addRemangaBookmark`, `fetchRemangaTitleDetail`, `fetchRemangaChapters`, `markRemangaChapterViewed`. |
| `src/import-mangalib/orchestrator.ts` | Drives full flow: fetch → match → preview rows → execute. |
| `src/import-mangalib/types.ts` | Shared type contracts. |
| `src/import-mangalib/messages.ts` | Message-type constants. |
| `src/mangalib-bridge.ts` | New thin content-script: reads `localStorage.auth.token.access_token` on mangalib.me and responds to a runtime message. |
| `src/import-page.ts` | UI for `import.html`. |
| `public/import.html` | Static page shell loaded in own tab. |
| `vite.import.config.ts` | Fourth Vite IIFE bundle for `import-page.ts` → `dist/import.js`. |
| `vite.bridge.config.ts` | Fifth Vite bundle for `mangalib-bridge.ts` → `dist/mangalib-bridge.js`. |
| `tests/import-status-mapping.test.ts` | TDD for status-mapping. |
| `tests/import-title-matcher.test.ts` | TDD for title-matcher. |
| `tests/import-bookmarks-parser.test.ts` | TDD against `bookmarks.json`. |
| `tests/import-chapter-progress.test.ts` | TDD for chapter-progress. |
| `tests/import-state.test.ts` | TDD for state. |
| `tests/import-mangalib-client.test.ts` | TDD with mocked `fetch`. |
| `tests/import-remanga-client.test.ts` | TDD with mocked `fetch`. |
| `tests/import-orchestrator.test.ts` | E2E wiring on stubs. |
| `tests/import-page-source.test.ts` | Source-level: `import.html` references `import.js` and required `data-*` hooks. |
| `tests/import-page-wiring.test.ts` | Source-level: `import-page.ts` imports orchestrator and renders rows. |
| `tests/popup-import-section.test.ts` | Source-level: popup section + auth wiring. |
| `tests/manifest-import.test.ts` | Source-level: manifest declares all needed permissions. |
| `tests/mangalib-bridge-source.test.ts` | Source-level: bridge reads `localStorage.auth.token.access_token` and responds to message. |

### Modified files

| Path | Change |
|------|--------|
| `src/popup.ts` | Add auth-status block, "Импорт" button, resume banner. |
| `public/popup.html` | Add markup for the new section. |
| `public/manifest.json` | Add `host_permissions` (cdnlibs.org, remanga API), add `content_scripts` entry for mangalib.me, register `import.html` is implicit (own page accessed via `chrome.runtime.getURL`). |
| `package.json` | Extend `build` script with two new Vite invocations. |
| `src/background.ts` | Add `runtime.onMessage` handlers for auth checks and mangalib token relay. |

---

## Conventions

- Import paths use `.js` extensions (`from "./settings.js"`) per existing code style.
- TypeScript strict; check via `npm run check`.
- Tests run via:
  ```bash
  npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 \
    --outDir .codex-tmp/test-build tests/<test>.test.ts src/<deps>.ts
  node --test .codex-tmp/test-build/tests/<test>.test.js
  ```
  All `src/import-mangalib/` deps used by a test must be passed on the `tsc` line.
- Russian for user-facing strings; conventional commits in English.

---

## Task 1: `status-mapping.ts` (TDD)

**Files:**
- Create: `src/import-mangalib/status-mapping.ts`
- Test: `tests/import-status-mapping.test.ts`

MangaLib uses **numeric** status (1..5). Remanga uses per-user category IDs (resolved at runtime). This module just maps MangaLib number → Remanga category name to look up by name.

- [ ] **Step 1: Write the failing test**

```ts
// tests/import-status-mapping.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MANGALIB_STATUS_READING,
  MANGALIB_STATUS_PLANNED,
  MANGALIB_STATUS_DROPPED,
  MANGALIB_STATUS_READ,
  MANGALIB_STATUS_FAVOURITE,
  REMANGA_CATEGORY_READING,
  REMANGA_CATEGORY_PLANNED,
  REMANGA_CATEGORY_DROPPED,
  REMANGA_CATEGORY_READ,
  REMANGA_CATEGORY_FAVOURITE,
  mapMangalibStatusToRemangaCategoryName,
  MANGALIB_STATUS_TO_REMANGA_NAME,
} from "../src/import-mangalib/status-mapping.js";

test("known MangaLib statuses map to Remanga category names", () => {
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_READING), REMANGA_CATEGORY_READING);
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_PLANNED), REMANGA_CATEGORY_PLANNED);
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_DROPPED), REMANGA_CATEGORY_DROPPED);
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_READ), REMANGA_CATEGORY_READ);
  assert.equal(mapMangalibStatusToRemangaCategoryName(MANGALIB_STATUS_FAVOURITE), REMANGA_CATEGORY_FAVOURITE);
});

test("unknown status falls back to Reading", () => {
  assert.equal(mapMangalibStatusToRemangaCategoryName(99), REMANGA_CATEGORY_READING);
  assert.equal(mapMangalibStatusToRemangaCategoryName(0), REMANGA_CATEGORY_READING);
});

test("MANGALIB_STATUS_TO_REMANGA_NAME is exhaustive 1..5", () => {
  for (const k of [1, 2, 3, 4, 5]) {
    assert.ok(k in MANGALIB_STATUS_TO_REMANGA_NAME);
  }
});
```

- [ ] **Step 2: Run, expect FAIL** (`cannot find module`).

```bash
npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 \
  --outDir .codex-tmp/test-build \
  tests/import-status-mapping.test.ts src/import-mangalib/status-mapping.ts
```

- [ ] **Step 3: Implement**

```ts
// src/import-mangalib/status-mapping.ts
export const MANGALIB_STATUS_READING = 1;
export const MANGALIB_STATUS_PLANNED = 2;
export const MANGALIB_STATUS_DROPPED = 3;
export const MANGALIB_STATUS_READ = 4;
export const MANGALIB_STATUS_FAVOURITE = 5;

export const REMANGA_CATEGORY_READING = "Читаю";
export const REMANGA_CATEGORY_PLANNED = "Буду читать";
export const REMANGA_CATEGORY_DROPPED = "Брошено";
export const REMANGA_CATEGORY_READ = "Прочитано";
export const REMANGA_CATEGORY_FAVOURITE = "Любимое";

export const MANGALIB_STATUS_TO_REMANGA_NAME: Record<number, string> = {
  [MANGALIB_STATUS_READING]: REMANGA_CATEGORY_READING,
  [MANGALIB_STATUS_PLANNED]: REMANGA_CATEGORY_PLANNED,
  [MANGALIB_STATUS_DROPPED]: REMANGA_CATEGORY_DROPPED,
  [MANGALIB_STATUS_READ]: REMANGA_CATEGORY_READ,
  [MANGALIB_STATUS_FAVOURITE]: REMANGA_CATEGORY_FAVOURITE,
};

export function mapMangalibStatusToRemangaCategoryName(status: number): string {
  return MANGALIB_STATUS_TO_REMANGA_NAME[status] ?? REMANGA_CATEGORY_READING;
}
```

- [ ] **Step 4: Run, expect PASS** (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/import-mangalib/status-mapping.ts tests/import-status-mapping.test.ts
git commit -m "feat(import): map mangalib numeric status to remanga category name"
```

---

## Task 2: `title-matcher.ts` (TDD)

**Files:**
- Create: `src/import-mangalib/title-matcher.ts`
- Test: `tests/import-title-matcher.test.ts`

Remanga search response (per fixture `remanga-search.json`) yields candidates with `id, dir, main_name, secondary_name, another_name` (where `another_name` is a single string with `/`-separated synonyms).

- [ ] **Step 1: Write the failing test**

```ts
// tests/import-title-matcher.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normaliseTitle,
  matchTitle,
  type RemangaCandidate,
} from "../src/import-mangalib/title-matcher.js";

test("normaliseTitle lowercases and trims", () => {
  assert.equal(normaliseTitle("  Solo  Leveling  "), "solo leveling");
});

test("normaliseTitle replaces ё with е", () => {
  assert.equal(normaliseTitle("Тёмный"), "темныи");
});

test("normaliseTitle drops punctuation", () => {
  assert.equal(normaliseTitle("Solo: Leveling!"), "solo leveling");
});

test("certain match by main_name exact", () => {
  const candidates: RemangaCandidate[] = [
    { id: 1, dir: "x", main_name: "Solo Leveling", secondary_name: "", another_name: "" },
    { id: 2, dir: "y", main_name: "Other", secondary_name: "", another_name: "" },
  ];
  const result = matchTitle("Solo Leveling", candidates);
  assert.equal(result.kind, "certain");
  assert.equal(result.kind === "certain" ? result.chosen.id : null, 1);
});

test("certain match by secondary_name", () => {
  const candidates: RemangaCandidate[] = [
    { id: 5, dir: "sl", main_name: "Поднятие уровня в одиночку", secondary_name: "Solo Leveling", another_name: "" },
  ];
  const result = matchTitle("Solo Leveling", candidates);
  assert.equal(result.kind, "certain");
});

test("certain match against any synonym in another_name", () => {
  const candidates: RemangaCandidate[] = [
    { id: 7, dir: "tg", main_name: "X", secondary_name: "Y", another_name: "Foo / Dark Genius / Bar" },
  ];
  const result = matchTitle("Dark Genius", candidates);
  assert.equal(result.kind, "certain");
});

test("ambiguous when only fuzzy matches", () => {
  const candidates: RemangaCandidate[] = [
    { id: 1, dir: "x", main_name: "Solo Leveling: Ragnarok", secondary_name: "", another_name: "" },
    { id: 2, dir: "y", main_name: "Solo Leveling Side Story", secondary_name: "", another_name: "" },
  ];
  const result = matchTitle("Solo Leveling", candidates);
  assert.equal(result.kind, "ambiguous");
  assert.equal(result.kind === "ambiguous" ? result.candidates.length : 0, 2);
});

test("not_found when candidate list empty", () => {
  assert.equal(matchTitle("X", []).kind, "not_found");
});

test("not_found when no candidate even fuzzy-matches", () => {
  const candidates: RemangaCandidate[] = [
    { id: 1, dir: "x", main_name: "Completely Different", secondary_name: "", another_name: "" },
  ];
  assert.equal(matchTitle("Solo Leveling", candidates).kind, "not_found");
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/import-mangalib/title-matcher.ts
export interface RemangaCandidate {
  id: number;
  dir: string;
  main_name: string;
  secondary_name: string;
  another_name: string;
}

export type MatchResult =
  | { kind: "certain"; chosen: RemangaCandidate }
  | { kind: "ambiguous"; candidates: RemangaCandidate[] }
  | { kind: "not_found" };

const PUNCTUATION_RE = /[.,/#!$%^&*;:{}=\-_`~()'"?!«»…]+/g;
const WHITESPACE_RE = /\s+/g;

export function normaliseTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(PUNCTUATION_RE, " ")
    .replace(WHITESPACE_RE, " ")
    .trim();
}

function namesOf(c: RemangaCandidate): string[] {
  const main = normaliseTitle(c.main_name || "");
  const secondary = normaliseTitle(c.secondary_name || "");
  const synonyms = (c.another_name || "")
    .split("/")
    .map((s) => normaliseTitle(s))
    .filter(Boolean);
  return [main, secondary, ...synonyms].filter(Boolean);
}

function fuzzyContains(query: string, candidate: string): boolean {
  if (!query || !candidate) return false;
  return candidate.includes(query) || query.includes(candidate);
}

export function matchTitle(query: string, candidates: RemangaCandidate[]): MatchResult {
  if (candidates.length === 0) return { kind: "not_found" };
  const normalisedQuery = normaliseTitle(query);

  const exact = candidates.find((c) => namesOf(c).some((n) => n === normalisedQuery));
  if (exact) return { kind: "certain", chosen: exact };

  const fuzzy = candidates.filter((c) => namesOf(c).some((n) => fuzzyContains(normalisedQuery, n)));
  if (fuzzy.length === 0) return { kind: "not_found" };
  return { kind: "ambiguous", candidates: fuzzy.slice(0, 3) };
}
```

- [ ] **Step 4: Run, expect PASS** (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/import-mangalib/title-matcher.ts tests/import-title-matcher.test.ts
git commit -m "feat(import): match mangalib titles against remanga search candidates"
```

---

## Task 3: `bookmarks-parser.ts` (TDD on real fixture)

**Files:**
- Create: `src/import-mangalib/bookmarks-parser.ts`
- Create: `src/import-mangalib/types.ts`
- Test: `tests/import-bookmarks-parser.test.ts`

Real shape (from `tests/fixtures/import-mangalib/bookmarks.json`, 5 entries):
```json
{
  "data": [
    {
      "id": <bookmark id>,
      "type": "media-bookmark",
      "status": <1..5>,
      "progress": "0",                      // string!
      "media": {
        "id": <number>,
        "name": "<short>",
        "rus_name": "<russian>",
        "eng_name": "<english>",
        "slug": "<slug>",
        "slug_url": "<full slug>",
        "items_count": { "uploaded": <n>, "total": <n> },
        "metadata": {
          "last_item": { "number": "<chapter num as string>", "branch_id": <id>, "manga_id": <id> }
        }
      },
      "rating": null,
      "meta": { "comment": false, "rewatches": null, "item_number": null }
    }
  ],
  "links": {...},
  "meta": {...}
}
```

- [ ] **Step 1: Define shared types**

```ts
// src/import-mangalib/types.ts
export interface MangalibBookmark {
  bookmarkId: number;
  mangaId: number;
  slug: string;
  slugUrl: string;
  rusName: string;
  engName: string;
  shortName: string;
  status: number;        // 1..5 raw from MangaLib
  lastReadChapter: number | null;
  itemsTotal: number | null;
}

export interface RemangaBookmarkExisting {
  titleId: number;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/import-bookmarks-parser.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseMangalibBookmarks } from "../src/import-mangalib/bookmarks-parser.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/bookmarks.json"), "utf8"),
);
const emptyFixture = JSON.parse(
  readFileSync(resolve(here, "../../../tests/fixtures/import-mangalib/bookmarks-empty.json"), "utf8"),
);

test("parses 5 bookmarks from real fixture", () => {
  const out = parseMangalibBookmarks(fixture);
  assert.equal(out.length, 5);
  for (const b of out) {
    assert.equal(typeof b.bookmarkId, "number");
    assert.equal(typeof b.slug, "string");
    assert.ok(b.slug.length > 0);
    assert.ok(b.rusName.length > 0 || b.engName.length > 0 || b.shortName.length > 0);
    assert.ok([1, 2, 3, 4, 5].includes(b.status));
  }
});

test("progress is parsed from string to number or null when zero/missing", () => {
  const out = parseMangalibBookmarks(fixture);
  // In our fixture all five have progress: "0" → mapped to null (no chapters read)
  for (const b of out) {
    assert.equal(b.lastReadChapter, null);
  }
});

test("non-zero numeric progress string is parsed to number", () => {
  const synthetic = {
    data: [
      {
        id: 1,
        type: "media-bookmark",
        status: 1,
        progress: "12",
        media: { id: 1, name: "n", rus_name: "r", eng_name: "e", slug: "s", slug_url: "s", items_count: { uploaded: 12, total: 100 } },
      },
    ],
  };
  const out = parseMangalibBookmarks(synthetic);
  assert.equal(out[0].lastReadChapter, 12);
});

test("returns empty array for empty fixture", () => {
  assert.deepEqual(parseMangalibBookmarks(emptyFixture), []);
});

test("returns empty array on null/undefined", () => {
  assert.deepEqual(parseMangalibBookmarks(null as unknown as object), []);
  assert.deepEqual(parseMangalibBookmarks(undefined as unknown as object), []);
});
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement**

```ts
// src/import-mangalib/bookmarks-parser.ts
import type { MangalibBookmark } from "./types.js";

interface RawBookmark {
  id?: number;
  status?: number;
  progress?: string | number | null;
  media?: {
    id?: number;
    name?: string;
    rus_name?: string;
    eng_name?: string;
    slug?: string;
    slug_url?: string;
    items_count?: { total?: number };
  };
}

export function parseMangalibBookmarks(payload: unknown): MangalibBookmark[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: RawBookmark[] }).data;
  if (!Array.isArray(data)) return [];

  const out: MangalibBookmark[] = [];
  for (const row of data) {
    const media = row.media;
    if (!media) continue;
    const slug = String(media.slug ?? "").trim();
    if (!slug) continue;
    const progressRaw = row.progress;
    const progress =
      progressRaw === null || progressRaw === undefined
        ? null
        : Number(progressRaw);
    const lastReadChapter =
      Number.isFinite(progress) && (progress as number) > 0 ? (progress as number) : null;

    out.push({
      bookmarkId: Number(row.id ?? 0),
      mangaId: Number(media.id ?? 0),
      slug,
      slugUrl: String(media.slug_url ?? slug),
      rusName: String(media.rus_name ?? "").trim(),
      engName: String(media.eng_name ?? "").trim(),
      shortName: String(media.name ?? "").trim(),
      status: Number(row.status ?? 0),
      lastReadChapter,
      itemsTotal: Number.isFinite(Number(media.items_count?.total))
        ? Number(media.items_count?.total)
        : null,
    });
  }
  return out;
}
```

- [ ] **Step 5: Run, expect PASS** (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/import-mangalib/bookmarks-parser.ts src/import-mangalib/types.ts tests/import-bookmarks-parser.test.ts
git commit -m "feat(import): parse mangalib bookmarks payload into normalised records"
```

---

## Task 4: `chapter-progress.ts` (TDD)

**Files:**
- Create: `src/import-mangalib/chapter-progress.ts`
- Test: `tests/import-chapter-progress.test.ts`

Remanga chapters fixture has `index` (number) and `chapter` (string). We use **`index`** as the canonical numeric position, but accept either.

- [ ] **Step 1: Write the failing test**

```ts
// tests/import-chapter-progress.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectChaptersToMark,
  type RemangaChapter,
} from "../src/import-mangalib/chapter-progress.js";

const chapters: RemangaChapter[] = [
  { id: 101, index: 1 },
  { id: 102, index: 2 },
  { id: 103, index: 3 },
  { id: 104, index: 4 },
  { id: 105, index: 5 },
];

test("returns ids for chapters with index ≤ lastRead", () => {
  assert.deepEqual(selectChaptersToMark(chapters, 3), [101, 102, 103]);
});

test("empty when lastRead is null", () => {
  assert.deepEqual(selectChaptersToMark(chapters, null), []);
});

test("empty when lastRead is 0", () => {
  assert.deepEqual(selectChaptersToMark(chapters, 0), []);
});

test("handles fractional indices", () => {
  const c: RemangaChapter[] = [
    { id: 1, index: 1 },
    { id: 2, index: 1.5 },
    { id: 3, index: 2 },
  ];
  assert.deepEqual(selectChaptersToMark(c, 1.5), [1, 2]);
});

test("when lastRead exceeds available, returns all", () => {
  assert.deepEqual(selectChaptersToMark(chapters, 999), [101, 102, 103, 104, 105]);
});

test("ignores chapters with non-finite index", () => {
  const c: RemangaChapter[] = [
    { id: 1, index: 1 },
    { id: 2, index: NaN },
    { id: 3, index: 2 },
  ];
  assert.deepEqual(selectChaptersToMark(c, 3), [1, 3]);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/import-mangalib/chapter-progress.ts
export interface RemangaChapter {
  id: number;
  index: number;
}

export function selectChaptersToMark(
  chapters: RemangaChapter[],
  lastRead: number | null,
): number[] {
  if (lastRead === null || lastRead <= 0) return [];
  const out: number[] = [];
  for (const ch of chapters) {
    if (!Number.isFinite(ch.index)) continue;
    if (ch.index <= lastRead) out.push(ch.id);
  }
  return out;
}
```

- [ ] **Step 4: Run, expect PASS** (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/import-mangalib/chapter-progress.ts tests/import-chapter-progress.test.ts
git commit -m "feat(import): select remanga chapter ids to mark viewed by mangalib progress"
```

---

## Task 5: `state.ts` — resume state in `chrome.storage.local` (TDD)

**Files:**
- Create: `src/import-mangalib/state.ts`
- Test: `tests/import-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/import-state.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadImportState,
  saveImportState,
  clearImportState,
  type ImportState,
} from "../src/import-mangalib/state.js";

interface FakeStore { data: Record<string, unknown> }

function installFakeChrome(): FakeStore {
  const store: FakeStore = { data: {} };
  const local = {
    async get(key: string) {
      return key in store.data ? { [key]: store.data[key] } : {};
    },
    async set(values: Record<string, unknown>) {
      Object.assign(store.data, values);
    },
    async remove(key: string) {
      delete store.data[key];
    },
  };
  (globalThis as unknown as { chrome: { storage: { local: typeof local } } }).chrome = {
    storage: { local },
  };
  return store;
}

const sample: ImportState = {
  startedAt: 1,
  phase: "executing",
  totalSelected: 5,
  doneIds: ["a"],
  failedIds: [],
};

test("save then load roundtrips", async () => {
  installFakeChrome();
  await saveImportState(sample);
  assert.deepEqual(await loadImportState(), sample);
});

test("loadImportState returns null when nothing stored", async () => {
  installFakeChrome();
  assert.equal(await loadImportState(), null);
});

test("clearImportState removes the entry", async () => {
  const s = installFakeChrome();
  await saveImportState(sample);
  await clearImportState();
  assert.equal(s.data["mangalibImportState"], undefined);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/import-mangalib/state.ts
const STORAGE_KEY = "mangalibImportState";

export type ImportPhase = "fetching" | "matching" | "preview" | "executing" | "done";

export interface ImportState {
  startedAt: number;
  phase: ImportPhase;
  totalSelected: number;
  doneIds: string[];
  failedIds: string[];
}

export async function saveImportState(state: ImportState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

export async function loadImportState(): Promise<ImportState | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const value = result[STORAGE_KEY];
  if (!value || typeof value !== "object") return null;
  return value as ImportState;
}

export async function clearImportState(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
```

- [ ] **Step 4: Run, expect PASS** (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/import-mangalib/state.ts tests/import-state.test.ts
git commit -m "feat(import): persist import progress to chrome.storage.local for resume"
```

---

## Task 6: `messages.ts` — protocol constants

**Files:**
- Create: `src/import-mangalib/messages.ts`

```ts
// src/import-mangalib/messages.ts
export const CHECK_AUTH_MESSAGE_TYPE = "import-mangalib/check-auth";
export const READ_MANGALIB_TOKEN_MESSAGE_TYPE = "import-mangalib/read-mangalib-token";

export interface CheckAuthRequest {
  type: typeof CHECK_AUTH_MESSAGE_TYPE;
  site: "mangalib" | "remanga";
}

export interface CheckAuthResponse {
  signedIn: boolean;
  username?: string;
}

export interface ReadMangalibTokenRequest {
  type: typeof READ_MANGALIB_TOKEN_MESSAGE_TYPE;
}

export interface ReadMangalibTokenResponse {
  token: string | null;
  userId: number | null;
}
```

- [ ] **Commit**

```bash
git add src/import-mangalib/messages.ts
git commit -m "chore(import): protocol message types"
```

---

## Task 7: `mangalib-bridge.ts` content script (TDD source-level)

**Files:**
- Create: `src/mangalib-bridge.ts`
- Test: `tests/mangalib-bridge-source.test.ts`

This is a **content script** injected into `mangalib.me/*`. It listens for `READ_MANGALIB_TOKEN_MESSAGE_TYPE` from the service worker and replies with the access token + user id read from the page's `localStorage`.

Page's localStorage shape (per discovery notes):
```js
localStorage.auth = JSON.stringify({
  token: { token_type, access_token, refresh_token, expires_in, timestamp },
  auth: { id, username, ... },
})
```

- [ ] **Step 1: Write the failing source-level test**

```ts
// tests/mangalib-bridge-source.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/mangalib-bridge.ts"), "utf8");

test("bridge listens for the read-token message", () => {
  assert.match(source, /import-mangalib\/read-mangalib-token/);
  assert.match(source, /chrome\.runtime\.onMessage\.addListener/);
});

test("bridge reads localStorage.auth.token.access_token", () => {
  assert.match(source, /localStorage\.getItem\("auth"\)/);
  assert.match(source, /access_token/);
});

test("bridge replies with token and userId or nulls", () => {
  assert.match(source, /sendResponse/);
  assert.match(source, /token: null/);
  assert.match(source, /userId: null/);
});
```

- [ ] **Step 2: Run, expect FAIL.**

```bash
npx tsc --module NodeNext --moduleResolution NodeNext --target ES2022 \
  --outDir .codex-tmp/test-build tests/mangalib-bridge-source.test.ts
node --test .codex-tmp/test-build/tests/mangalib-bridge-source.test.js
```

- [ ] **Step 3: Implement**

```ts
// src/mangalib-bridge.ts
import {
  READ_MANGALIB_TOKEN_MESSAGE_TYPE,
  type ReadMangalibTokenResponse,
} from "./import-mangalib/messages.js";

function readToken(): ReadMangalibTokenResponse {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return { token: null, userId: null };
    const parsed = JSON.parse(raw) as {
      token?: { access_token?: string };
      auth?: { id?: number };
    };
    const token = parsed?.token?.access_token ?? null;
    const userId =
      typeof parsed?.auth?.id === "number" && parsed.auth.id > 0
        ? parsed.auth.id
        : null;
    if (!token) return { token: null, userId: null };
    return { token, userId };
  } catch {
    return { token: null, userId: null };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === READ_MANGALIB_TOKEN_MESSAGE_TYPE
  ) {
    sendResponse(readToken());
    return true;
  }
  return false;
});
```

- [ ] **Step 4: Run, expect PASS** (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/mangalib-bridge.ts tests/mangalib-bridge-source.test.ts
git commit -m "feat(import): mangalib content-script bridge to expose auth token to worker"
```

---

## Task 8: `mangalib-client.ts` (TDD with fetch mock)

**Files:**
- Create: `src/import-mangalib/mangalib-client.ts`
- Test: `tests/import-mangalib-client.test.ts`

The client fetches token via the bridge through service-worker messaging. For testability, the client takes a `tokenProvider` function as DI parameter.

- [ ] **Step 1: Write the failing test**

```ts
// tests/import-mangalib-client.test.ts
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
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/import-mangalib/mangalib-client.ts
import { parseMangalibBookmarks } from "./bookmarks-parser.js";
import type { MangalibBookmark } from "./types.js";

const MANGALIB_API_BASE = "https://api.cdnlibs.org";

export interface MangalibToken {
  token: string | null;
  userId: number | null;
}
export type MangalibTokenProvider = () => Promise<MangalibToken>;

export interface AuthStatus {
  signedIn: boolean;
  username?: string;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: "Bearer " + token,
    Accept: "application/json",
    "Site-Id": "1",
  };
}

export async function fetchMangalibAuthStatus(
  tokenProvider: MangalibTokenProvider,
): Promise<AuthStatus> {
  const { token } = await tokenProvider();
  if (!token) return { signedIn: false };
  const r = await fetch(`${MANGALIB_API_BASE}/api/auth/me`, {
    credentials: "omit",
    headers: authHeaders(token),
  });
  if (r.status === 401 || r.status === 403) return { signedIn: false };
  if (!r.ok) return { signedIn: false };
  const body = (await r.json()) as { data?: { username?: string } };
  const username = body?.data?.username;
  if (!username) return { signedIn: false };
  return { signedIn: true, username };
}

export async function fetchMangalibBookmarks(
  tokenProvider: MangalibTokenProvider,
  siteId: number,
): Promise<MangalibBookmark[]> {
  const { token, userId } = await tokenProvider();
  if (!token || !userId) return [];
  const all: MangalibBookmark[] = [];
  for (const status of [1, 2, 3, 4, 5]) {
    const u = new URL(`${MANGALIB_API_BASE}/api/bookmarks`);
    u.searchParams.set("page", "1");
    u.searchParams.set("sort_by", "name");
    u.searchParams.set("sort_type", "desc");
    u.searchParams.set("status", String(status));
    u.searchParams.set("user_id", String(userId));
    void siteId;
    const r = await fetch(u, { credentials: "omit", headers: authHeaders(token) });
    if (!r.ok) continue;
    const body = (await r.json()) as unknown;
    all.push(...parseMangalibBookmarks(body));
  }
  return all;
}
```

- [ ] **Step 4: Run, expect PASS** (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/import-mangalib/mangalib-client.ts tests/import-mangalib-client.test.ts
git commit -m "feat(import): mangalib API client with bearer-from-bridge and Site-Id header"
```

---

## Task 9: `remanga-client.ts` (TDD with fetch mock)

**Files:**
- Create: `src/import-mangalib/remanga-client.ts`
- Test: `tests/import-remanga-client.test.ts`

Auth: Bearer token from cookie `token`. **Reuse** `readRemangaAuthToken` from `src/premium-free.ts` and the existing `markRemangaChapterAsViewed`. The new client wraps the rest.

- [ ] **Step 1: Write the failing test**

```ts
// tests/import-remanga-client.test.ts
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
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/import-mangalib/remanga-client.ts
import type { RemangaCandidate } from "./title-matcher.js";
import type { RemangaChapter } from "./chapter-progress.js";

const REMANGA_API = "https://api.remanga.org";

export type RemangaTokenProvider = () => Promise<string | null>;

export interface AuthStatus {
  signedIn: boolean;
  username?: string;
}

export interface RemangaTitleDetail {
  id: number;
  dir: string;
  activeBranch: number | null;
}

export interface RemangaBookmarkType {
  id: number;
  name: string;
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: "bearer " + token,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function getJson<T>(url: string, token: string): Promise<T | null> {
  const r = await fetch(url, { credentials: "omit", headers: headers(token) });
  if (!r.ok) return null;
  return (await r.json()) as T;
}

export async function fetchRemangaAuthStatus(provider: RemangaTokenProvider): Promise<AuthStatus> {
  const token = await provider();
  if (!token) return { signedIn: false };
  const r = await fetch(`${REMANGA_API}/api/v2/users/current/`, {
    credentials: "omit",
    headers: headers(token),
  });
  if (!r.ok) return { signedIn: false };
  const body = (await r.json()) as { username?: string };
  if (!body?.username) return { signedIn: false };
  return { signedIn: true, username: body.username };
}

export async function searchRemanga(
  provider: RemangaTokenProvider,
  query: string,
): Promise<RemangaCandidate[]> {
  const token = await provider();
  if (!token) return [];
  const u = new URL(`${REMANGA_API}/api/v2/search/`);
  u.searchParams.set("query", query);
  u.searchParams.set("count", "5");
  const body = await getJson<{ results?: Array<{ id: number; dir: string; main_name?: string; secondary_name?: string; another_name?: string }> }>(u.toString(), token);
  const list = body?.results ?? [];
  return list.slice(0, 3).map((r) => ({
    id: r.id,
    dir: r.dir,
    main_name: r.main_name ?? "",
    secondary_name: r.secondary_name ?? "",
    another_name: r.another_name ?? "",
  }));
}

export async function fetchRemangaBookmarkTypes(
  provider: RemangaTokenProvider,
): Promise<RemangaBookmarkType[]> {
  const token = await provider();
  if (!token) return [];
  const body = await getJson<{ content?: Array<{ id: number; name: string }> }>(
    `${REMANGA_API}/api/v2/bookmark-types/`,
    token,
  );
  return body?.content ?? [];
}

export async function fetchExistingRemangaBookmarks(
  provider: RemangaTokenProvider,
  userId: number,
): Promise<Set<number>> {
  const token = await provider();
  if (!token) return new Set();
  const out = new Set<number>();
  let page = 1;
  for (;;) {
    const u = new URL(`${REMANGA_API}/api/v2/users/${userId}/bookmarks/`);
    u.searchParams.set("page", String(page));
    const body = await getJson<{ next?: number | null; results?: Array<{ title?: { id?: number } }> }>(u.toString(), token);
    if (!body || !Array.isArray(body.results)) break;
    for (const row of body.results) {
      const id = row.title?.id;
      if (typeof id === "number") out.add(id);
    }
    if (!body.next) break;
    page = body.next;
  }
  return out;
}

export async function addRemangaBookmark(
  provider: RemangaTokenProvider,
  titleId: number,
  bookmarkTypeId: number,
): Promise<void> {
  const token = await provider();
  if (!token) throw new Error("no remanga token");
  const r = await fetch(`${REMANGA_API}/api/v2/bookmarks/`, {
    method: "POST",
    credentials: "omit",
    headers: headers(token),
    body: JSON.stringify({ title: titleId, type: bookmarkTypeId }),
  });
  if (!r.ok) throw new Error("Remanga add bookmark: HTTP " + r.status);
}

export async function fetchRemangaTitleDetail(
  provider: RemangaTokenProvider,
  dir: string,
): Promise<RemangaTitleDetail | null> {
  const token = await provider();
  if (!token) return null;
  const body = await getJson<{ id?: number; dir?: string; active_branch?: number; branches?: Array<{ id: number }> }>(`${REMANGA_API}/api/v2/titles/${dir}/`, token);
  if (!body || !body.id) return null;
  const activeBranch = typeof body.active_branch === "number" ? body.active_branch : body.branches?.[0]?.id ?? null;
  return { id: body.id, dir: body.dir ?? dir, activeBranch };
}

export async function fetchRemangaChapters(
  provider: RemangaTokenProvider,
  branchId: number,
): Promise<RemangaChapter[]> {
  const token = await provider();
  if (!token) return [];
  const out: RemangaChapter[] = [];
  let page = 1;
  for (;;) {
    const u = new URL(`${REMANGA_API}/api/v2/titles/chapters/`);
    u.searchParams.set("branch_id", String(branchId));
    u.searchParams.set("page", String(page));
    u.searchParams.set("count", "100");
    const body = await getJson<{ next?: number | null; results?: Array<{ id: number; index: number | string; chapter?: string }> }>(u.toString(), token);
    if (!body || !Array.isArray(body.results)) break;
    for (const ch of body.results) {
      const idx = typeof ch.index === "number" ? ch.index : Number(ch.index ?? ch.chapter ?? NaN);
      out.push({ id: ch.id, index: idx });
    }
    if (!body.next) break;
    page = body.next;
  }
  return out;
}
```

- [ ] **Step 4: Run, expect PASS** (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/import-mangalib/remanga-client.ts tests/import-remanga-client.test.ts
git commit -m "feat(import): remanga API client (auth, search, types, bookmarks, chapters, add)"
```

---

## Task 10: `orchestrator.ts` — drive the flow (TDD)

**Files:**
- Create: `src/import-mangalib/orchestrator.ts`
- Test: `tests/import-orchestrator.test.ts`

The orchestrator is fully DI'd: it takes a single `ImportDependencies` object with stubs for all I/O.

- [ ] **Step 1: Write the failing test**

```ts
// tests/import-orchestrator.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  runImport,
  type ImportDependencies,
  type PreviewRow,
} from "../src/import-mangalib/orchestrator.js";
import {
  MANGALIB_STATUS_READING,
  MANGALIB_STATUS_READ,
  REMANGA_CATEGORY_READING,
  REMANGA_CATEGORY_READ,
} from "../src/import-mangalib/status-mapping.js";

function makeDeps(over: Partial<ImportDependencies> = {}): ImportDependencies {
  return {
    fetchBookmarks: async () => [
      {
        bookmarkId: 1,
        mangaId: 100,
        slug: "solo-leveling",
        slugUrl: "100--solo-leveling",
        rusName: "Solo Leveling",
        engName: "",
        shortName: "",
        status: MANGALIB_STATUS_READING,
        lastReadChapter: 5,
        itemsTotal: 100,
      },
      {
        bookmarkId: 2,
        mangaId: 200,
        slug: "no-such",
        slugUrl: "200--no-such",
        rusName: "Совершенно неизвестный",
        engName: "",
        shortName: "",
        status: MANGALIB_STATUS_READ,
        lastReadChapter: null,
        itemsTotal: null,
      },
    ],
    fetchBookmarkTypes: async () => [
      { id: 100, name: REMANGA_CATEGORY_READING },
      { id: 200, name: REMANGA_CATEGORY_READ },
    ],
    fetchExistingBookmarks: async () => new Set<number>(),
    searchRemanga: async (q) =>
      q.includes("Solo")
        ? [{ id: 100, dir: "solo-leveling", main_name: "Solo Leveling", secondary_name: "", another_name: "" }]
        : [],
    fetchTitleDetail: async (dir) => ({ id: 100, dir, activeBranch: 555 }),
    fetchChapters: async () => [
      { id: 901, index: 1 }, { id: 902, index: 2 }, { id: 903, index: 5 }, { id: 904, index: 6 },
    ],
    addBookmark: async () => {},
    markChapterViewed: async () => {},
    sleepMs: async () => {},
    ...over,
  };
}

test("buildPreview matches certain row and resolves bookmark type id", async () => {
  const preview = await runImport.buildPreview(makeDeps());
  const certain = preview.find((r) => r.match.kind === "certain");
  assert.ok(certain);
  assert.equal(certain!.targetBookmarkTypeId, 100);
  const notFound = preview.find((r) => r.match.kind === "not_found");
  assert.ok(notFound);
});

test("execute writes only selected and reports", async () => {
  const calls: number[] = [];
  const deps = makeDeps({ addBookmark: async (id) => { calls.push(id); } });
  const preview = await runImport.buildPreview(deps);
  const certain = preview.find((r) => r.match.kind === "certain")!;
  certain.selected = true;
  const report = await runImport.execute(deps, preview);
  assert.deepEqual(calls, [100]);
  assert.equal(report.added.length, 1);
});

test("execute marks chapters with index ≤ lastRead", async () => {
  const viewed: number[] = [];
  const deps = makeDeps({ markChapterViewed: async (id) => { viewed.push(id); } });
  const preview = await runImport.buildPreview(deps);
  const c = preview.find((r) => r.match.kind === "certain")!;
  c.selected = true;
  await runImport.execute(deps, preview);
  // lastReadChapter = 5 → ids with index 1,2,5 → [901, 902, 903]
  assert.deepEqual(viewed.sort(), [901, 902, 903]);
});

test("duplicate is unselected by default", async () => {
  const deps = makeDeps({ fetchExistingBookmarks: async () => new Set([100]) });
  const preview = await runImport.buildPreview(deps);
  const c = preview.find((r) => r.match.kind === "certain")!;
  assert.equal(c.alreadyExists, true);
  assert.equal(c.selected, false);
});

test("execute records failures and continues", async () => {
  const deps = makeDeps({
    addBookmark: async () => { throw new Error("HTTP 500"); },
  });
  const preview = await runImport.buildPreview(deps);
  const c = preview.find((r) => r.match.kind === "certain")!;
  c.selected = true;
  const report = await runImport.execute(deps, preview);
  assert.equal(report.failed.length, 1);
  assert.equal(report.added.length, 0);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```ts
// src/import-mangalib/orchestrator.ts
import type { MangalibBookmark } from "./types.js";
import { matchTitle, type MatchResult, type RemangaCandidate } from "./title-matcher.js";
import { selectChaptersToMark, type RemangaChapter } from "./chapter-progress.js";
import { mapMangalibStatusToRemangaCategoryName } from "./status-mapping.js";
import type { RemangaBookmarkType, RemangaTitleDetail } from "./remanga-client.js";

export interface ImportDependencies {
  fetchBookmarks: () => Promise<MangalibBookmark[]>;
  fetchBookmarkTypes: () => Promise<RemangaBookmarkType[]>;
  fetchExistingBookmarks: () => Promise<Set<number>>;
  searchRemanga: (query: string) => Promise<RemangaCandidate[]>;
  fetchTitleDetail: (dir: string) => Promise<RemangaTitleDetail | null>;
  fetchChapters: (branchId: number) => Promise<RemangaChapter[]>;
  addBookmark: (titleId: number, typeId: number) => Promise<void>;
  markChapterViewed: (chapterId: number) => Promise<void>;
  sleepMs: (ms: number) => Promise<void>;
}

export interface PreviewRow {
  bookmark: MangalibBookmark;
  match: MatchResult;
  alreadyExists: boolean;
  selected: boolean;
  targetBookmarkTypeId: number | null;
  targetCategoryName: string;
}

export type ImportProgress =
  | { phase: "fetching"; current: number; total: number }
  | { phase: "matching"; current: number; total: number }
  | { phase: "executing"; current: number; total: number; slug: string }
  | { phase: "done" };

export interface ExecutionReport {
  added: string[];
  skipped: string[];
  failed: Array<{ slug: string; reason: string }>;
}

const RPS_DELAY_MS = 220;

async function buildPreview(
  deps: ImportDependencies,
  onProgress: (p: ImportProgress) => void = () => {},
): Promise<PreviewRow[]> {
  const bookmarks = await deps.fetchBookmarks();
  onProgress({ phase: "fetching", current: bookmarks.length, total: bookmarks.length });

  const [types, existing] = await Promise.all([
    deps.fetchBookmarkTypes(),
    deps.fetchExistingBookmarks(),
  ]);
  const typeIdByName = new Map(types.map((t) => [t.name, t.id]));

  const rows: PreviewRow[] = [];
  for (let i = 0; i < bookmarks.length; i += 1) {
    const b = bookmarks[i];
    onProgress({ phase: "matching", current: i, total: bookmarks.length });
    const query = b.rusName || b.engName || b.shortName || b.slug;
    const candidates = await deps.searchRemanga(query);
    const match = matchTitle(query, candidates);
    const titleId = match.kind === "certain" ? match.chosen.id : null;
    const alreadyExists = titleId !== null && existing.has(titleId);
    const categoryName = mapMangalibStatusToRemangaCategoryName(b.status);
    const targetBookmarkTypeId = typeIdByName.get(categoryName) ?? null;
    rows.push({
      bookmark: b,
      match,
      alreadyExists,
      selected: match.kind === "certain" && !alreadyExists && targetBookmarkTypeId !== null,
      targetBookmarkTypeId,
      targetCategoryName: categoryName,
    });
  }
  onProgress({ phase: "matching", current: bookmarks.length, total: bookmarks.length });
  return rows;
}

async function execute(
  deps: ImportDependencies,
  preview: PreviewRow[],
  onProgress: (p: ImportProgress) => void = () => {},
): Promise<ExecutionReport> {
  const report: ExecutionReport = { added: [], skipped: [], failed: [] };
  const targets = preview.filter((r) => r.selected && r.match.kind === "certain" && r.targetBookmarkTypeId !== null);
  for (let i = 0; i < targets.length; i += 1) {
    const row = targets[i];
    if (row.match.kind !== "certain") continue;
    const candidate = row.match.chosen;
    onProgress({ phase: "executing", current: i, total: targets.length, slug: row.bookmark.slug });
    try {
      await deps.addBookmark(candidate.id, row.targetBookmarkTypeId!);
      if (row.bookmark.lastReadChapter !== null) {
        const detail = await deps.fetchTitleDetail(candidate.dir);
        if (detail?.activeBranch) {
          const chapters = await deps.fetchChapters(detail.activeBranch);
          const ids = selectChaptersToMark(chapters, row.bookmark.lastReadChapter);
          for (const id of ids) {
            await deps.markChapterViewed(id);
            await deps.sleepMs(RPS_DELAY_MS);
          }
        }
      }
      report.added.push(row.bookmark.slug);
    } catch (e) {
      report.failed.push({ slug: row.bookmark.slug, reason: e instanceof Error ? e.message : String(e) });
    }
    await deps.sleepMs(RPS_DELAY_MS);
  }
  for (const r of preview) if (!r.selected) report.skipped.push(r.bookmark.slug);
  onProgress({ phase: "done" });
  return report;
}

export const runImport = { buildPreview, execute };
```

- [ ] **Step 4: Run, expect PASS** (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/import-mangalib/orchestrator.ts tests/import-orchestrator.test.ts
git commit -m "feat(import): orchestrator wires preview + execute with progress callbacks"
```

---

## Task 11: Background — auth check + token relay

**Files:**
- Modify: `src/background.ts`

The service worker:
- Implements two `runtime.onMessage` handlers:
  - `CHECK_AUTH_MESSAGE_TYPE` — calls one of the two clients' `fetchAuthStatus` with an appropriate token provider.
  - For mangalib token: locates a tab on `mangalib.me` (or opens one in the background?) and forwards `READ_MANGALIB_TOKEN_MESSAGE_TYPE` via `chrome.tabs.sendMessage` to the bridge content script.
- Helper `getMangalibTokenViaBridge()` that finds the first mangalib.me tab and asks for a token. If no such tab exists, return `{token: null, userId: null}`.

- [ ] **Step 1: Write the failing source-level test**

```ts
// tests/import-background-auth.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/background.ts"), "utf8");

test("background.ts handles check-auth message", () => {
  assert.match(source, /import-mangalib\/check-auth/);
});

test("background.ts dispatches to mangalib- and remanga-client auth functions", () => {
  assert.match(source, /fetchMangalibAuthStatus/);
  assert.match(source, /fetchRemangaAuthStatus/);
});

test("background.ts forwards read-mangalib-token to a tab", () => {
  assert.match(source, /chrome\.tabs\.query/);
  assert.match(source, /mangalib\.me/);
  assert.match(source, /chrome\.tabs\.sendMessage/);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Edit `src/background.ts`**

Add at top:

```ts
import {
  fetchMangalibAuthStatus,
  type MangalibTokenProvider,
} from "./import-mangalib/mangalib-client.js";
import { fetchRemangaAuthStatus } from "./import-mangalib/remanga-client.js";
import {
  CHECK_AUTH_MESSAGE_TYPE,
  READ_MANGALIB_TOKEN_MESSAGE_TYPE,
  type CheckAuthRequest,
  type CheckAuthResponse,
  type ReadMangalibTokenResponse,
} from "./import-mangalib/messages.js";
import { readRemangaAuthToken } from "./premium-free.js";
```

Add helpers:

```ts
async function getMangalibTokenViaBridge(): Promise<ReadMangalibTokenResponse> {
  const tabs = await chrome.tabs.query({ url: "https://mangalib.me/*" });
  for (const tab of tabs) {
    if (typeof tab.id !== "number") continue;
    try {
      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: READ_MANGALIB_TOKEN_MESSAGE_TYPE,
      })) as ReadMangalibTokenResponse;
      if (response && (response.token || response.token === null)) return response;
    } catch {
      continue;
    }
  }
  return { token: null, userId: null };
}

const mangalibTokenProvider: MangalibTokenProvider = async () => getMangalibTokenViaBridge();

async function getRemangaToken(): Promise<string | null> {
  const cookies = await chrome.cookies.getAll({ url: "https://remanga.org/" });
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return readRemangaAuthToken(cookieHeader);
}
```

Add inside the existing `chrome.runtime.onMessage.addListener`:

```ts
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === CHECK_AUTH_MESSAGE_TYPE
  ) {
    const site = (message as CheckAuthRequest).site;
    const action = site === "mangalib"
      ? fetchMangalibAuthStatus(mangalibTokenProvider)
      : fetchRemangaAuthStatus(getRemangaToken);
    action
      .then((status) => sendResponse(status as CheckAuthResponse))
      .catch(() => sendResponse({ signedIn: false }));
    return true;
  }
```

- [ ] **Step 4: Run tests, expect PASS** (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/background.ts tests/import-background-auth.test.ts
git commit -m "feat(import): background relays mangalib token via content-script bridge"
```

> **Note for reviewer:** `chrome.cookies.getAll` requires the `cookies` permission in manifest; that's added in Task 12.

---

## Task 12: `manifest.json` — permissions, content_scripts, web_accessible_resources

**Files:**
- Modify: `public/manifest.json`
- Test: `tests/manifest-import.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/manifest-import.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifest = JSON.parse(readFileSync(resolve("public/manifest.json"), "utf8"));

test("host_permissions cover api.cdnlibs.org, mangalib.me, api.remanga.org", () => {
  const hp = manifest.host_permissions as string[];
  assert.ok(hp.some((p) => p.includes("api.cdnlibs.org")));
  assert.ok(hp.some((p) => p.includes("mangalib.me")));
  assert.ok(hp.some((p) => p.includes("api.remanga.org")));
});

test("permissions include cookies", () => {
  const p = manifest.permissions as string[];
  assert.ok(p.includes("cookies"));
  assert.ok(p.includes("storage"));
  assert.ok(p.includes("nativeMessaging"));
});

test("content_scripts has both remanga and mangalib entries", () => {
  const cs = manifest.content_scripts as Array<{ matches: string[]; js: string[] }>;
  assert.ok(cs.some((s) => s.matches.some((m) => m.includes("remanga.org")) && s.js.includes("content.js")));
  assert.ok(cs.some((s) => s.matches.some((m) => m.includes("mangalib.me")) && s.js.includes("mangalib-bridge.js")));
});

test("manifest preserves existing key field", () => {
  assert.ok(typeof manifest.key === "string" && manifest.key.length > 0);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Edit `public/manifest.json`**

In `permissions` add `"cookies"`. In `host_permissions` add (preserve existing 127.0.0.1 entries):

```json
    "https://api.cdnlibs.org/*",
    "https://mangalib.me/*",
    "https://*.mangalib.me/*",
    "https://api.remanga.org/*",
    "https://remanga.org/*"
```

Add a second `content_scripts` entry alongside the existing one:

```json
    {
      "matches": ["https://mangalib.me/*"],
      "js": ["mangalib-bridge.js"],
      "run_at": "document_idle"
    }
```

- [ ] **Step 4: Run, expect PASS** (4 tests).

- [ ] **Step 5: Commit**

```bash
git add public/manifest.json tests/manifest-import.test.ts
git commit -m "feat(import): manifest permissions, mangalib bridge content script"
```

---

## Task 13: Vite bundles for `import-page.ts` and `mangalib-bridge.ts`

**Files:**
- Create: `vite.import.config.ts`
- Create: `vite.bridge.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Create both configs**

```ts
// vite.import.config.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: "dist",
    sourcemap: true,
    lib: {
      entry: resolve(rootDirectory, "src/import-page.ts"),
      fileName: () => "import.js",
      formats: ["iife"],
      name: "RemangaReaderEnhancerImportPage",
    },
    rollupOptions: { output: { extend: false } },
  },
});
```

```ts
// vite.bridge.config.ts
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDirectory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: "dist",
    sourcemap: true,
    lib: {
      entry: resolve(rootDirectory, "src/mangalib-bridge.ts"),
      fileName: () => "mangalib-bridge.js",
      formats: ["iife"],
      name: "RemangaReaderEnhancerMangalibBridge",
    },
    rollupOptions: { output: { extend: false } },
  },
});
```

- [ ] **Step 2: Update `package.json` `build` script**

Replace `"build": "vite build && vite build --config vite.background.config.ts && vite build --config vite.popup.config.ts"`

with `"build": "vite build && vite build --config vite.background.config.ts && vite build --config vite.popup.config.ts && vite build --config vite.import.config.ts && vite build --config vite.bridge.config.ts"`.

- [ ] **Step 3: Stub `src/import-page.ts` so the build succeeds**

```ts
// src/import-page.ts
console.log("[import-page] stub — wired in Task 15");
```

- [ ] **Step 4: Verify**

```bash
npm run build
ls dist/import.js dist/mangalib-bridge.js
```

Both must exist.

- [ ] **Step 5: Commit**

```bash
git add vite.import.config.ts vite.bridge.config.ts package.json src/import-page.ts
git commit -m "chore(import): vite bundles for import page and mangalib bridge"
```

---

## Task 14: `import.html` — page shell

**Files:**
- Create: `public/import.html`
- Test: `tests/import-page-source.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/import-page-source.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("public/import.html"), "utf8");

test("import.html loads import.js", () => {
  assert.match(html, /src=["']import\.js["']/);
});

test("import.html exposes data-* hooks", () => {
  for (const hook of [
    "data-auth-status",
    "data-progress-fetch",
    "data-progress-match",
    "data-progress-execute",
    "data-preview-table",
    "data-execute-button",
    "data-report",
  ]) {
    assert.match(html, new RegExp(hook), `missing ${hook}`);
  }
});
```

- [ ] **Step 2: Run, expect FAIL** (file doesn't exist).

- [ ] **Step 3: Create `public/import.html`**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Импорт закладок из MangaLib — Remanga Enhancer</title>
    <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>
      :root { color-scheme: dark; --bg:#131416; --bg-elevated:#18191b; --border:#27272a; --text:#fafafa; --text-muted:#8a8f9c; --accent:#3edae0; --ok:#4ade80; --warn:#fbbf24; --bad:#ef4444; }
      *{box-sizing:border-box}
      body{margin:0;font-family:"Exo 2",system-ui,sans-serif;background:var(--bg);color:var(--text);padding:24px;max-width:1200px;margin:0 auto}
      h1{font-size:22px;margin:0 0 16px}
      .auth-strip{display:flex;gap:24px;padding:12px 16px;background:var(--bg-elevated);border:1px solid var(--border);border-radius:12px;margin-bottom:16px}
      .auth-strip span[data-state="ok"]{color:var(--ok)}
      .auth-strip span[data-state="bad"]{color:var(--bad)}
      .progress{margin:8px 0;color:var(--text-muted)}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{text-align:left;padding:8px 10px;border-bottom:1px solid var(--border);font-size:14px;vertical-align:top}
      th{color:var(--text-muted);font-weight:500}
      tr[data-kind="certain"] td:nth-child(2)::before{content:"✅ "}
      tr[data-kind="ambiguous"] td:nth-child(2)::before{content:"⚠ "}
      tr[data-kind="not_found"] td:nth-child(2)::before{content:"❌ "}
      tr[data-already-exists="true"] td:nth-child(2)::before{content:"🔁 "}
      button.primary{background:var(--accent);color:#001a1a;border:0;padding:10px 18px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px}
      button.primary:disabled{opacity:.5;cursor:not-allowed}
      .report{margin-top:24px;padding:16px;background:var(--bg-elevated);border-radius:12px}
    </style>
  </head>
  <body>
    <h1>Импорт закладок из MangaLib в Remanga</h1>
    <section class="auth-strip" data-auth-status>
      <div>MangaLib: <span data-site="mangalib" data-state="checking">проверяю…</span></div>
      <div>Remanga: <span data-site="remanga" data-state="checking">проверяю…</span></div>
    </section>
    <section>
      <p class="progress" data-progress-fetch>Получаю закладки с MangaLib…</p>
      <p class="progress" data-progress-match>Ищу совпадения на Remanga…</p>
    </section>
    <section data-preview-table></section>
    <button class="primary" data-execute-button disabled>Перенести отмеченные (0)</button>
    <p class="progress" data-progress-execute></p>
    <section class="report" data-report hidden></section>
    <script src="import.js"></script>
  </body>
</html>
```

- [ ] **Step 4: Run, expect PASS** (2 tests).

- [ ] **Step 5: Commit**

```bash
git add public/import.html tests/import-page-source.test.ts
git commit -m "feat(import): import.html shell with data-* hooks"
```

---

## Task 15: `import-page.ts` — wire UI to orchestrator

**Files:**
- Modify: `src/import-page.ts`
- Test: `tests/import-page-wiring.test.ts`

- [ ] **Step 1: Write source-level wiring test**

```ts
// tests/import-page-wiring.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("src/import-page.ts"), "utf8");

test("imports orchestrator and clients", () => {
  assert.match(source, /from "\.\/import-mangalib\/orchestrator\.js"/);
  assert.match(source, /from "\.\/import-mangalib\/mangalib-client\.js"/);
  assert.match(source, /from "\.\/import-mangalib\/remanga-client\.js"/);
});

test("calls runImport.buildPreview and runImport.execute", () => {
  assert.match(source, /runImport\.buildPreview/);
  assert.match(source, /runImport\.execute/);
});

test("reads mangalib token via runtime.sendMessage to background", () => {
  assert.match(source, /CHECK_AUTH_MESSAGE_TYPE/);
});

test("persists state via state.ts", () => {
  assert.match(source, /from "\.\/import-mangalib\/state\.js"/);
});
```

- [ ] **Step 2: Run, expect FAIL** (current file is the stub).

- [ ] **Step 3: Replace `src/import-page.ts` with full implementation**

```ts
// src/import-page.ts
import {
  fetchMangalibBookmarks,
  type MangalibTokenProvider,
} from "./import-mangalib/mangalib-client.js";
import {
  searchRemanga,
  fetchRemangaBookmarkTypes,
  fetchExistingRemangaBookmarks,
  fetchRemangaTitleDetail,
  fetchRemangaChapters,
  addRemangaBookmark,
  type RemangaTokenProvider,
} from "./import-mangalib/remanga-client.js";
import {
  runImport,
  type PreviewRow,
  type ImportProgress,
  type ExecutionReport,
} from "./import-mangalib/orchestrator.js";
import { saveImportState, clearImportState } from "./import-mangalib/state.js";
import {
  CHECK_AUTH_MESSAGE_TYPE,
  READ_MANGALIB_TOKEN_MESSAGE_TYPE,
  type CheckAuthRequest,
  type CheckAuthResponse,
  type ReadMangalibTokenResponse,
} from "./import-mangalib/messages.js";
import { markRemangaChapterAsViewed } from "./premium-free.js";

void main();

async function main(): Promise<void> {
  await renderAuthStrip();
  const preview = await buildPreviewWithProgress();
  renderPreview(preview);
  bindExecuteButton(preview);
}

function askBackground<T>(message: object): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: unknown) => {
      void chrome.runtime?.lastError;
      resolve((response ?? null) as T | null);
    });
  });
}

const mangalibTokenProvider: MangalibTokenProvider = async () => {
  const r = await askBackground<ReadMangalibTokenResponse>({ type: READ_MANGALIB_TOKEN_MESSAGE_TYPE });
  return r ?? { token: null, userId: null };
};

const remangaTokenProvider: RemangaTokenProvider = async () => {
  const cookies = await chrome.cookies.getAll({ url: "https://remanga.org/" });
  const tokenCookie = cookies.find((c) => c.name === "token");
  return tokenCookie?.value ?? null;
};

async function renderAuthStrip(): Promise<void> {
  const set = (site: "mangalib" | "remanga", text: string, state: "ok" | "bad") => {
    const span = document.querySelector<HTMLElement>(`[data-site="${site}"]`);
    if (!span) return;
    span.textContent = text;
    span.dataset.state = state;
  };
  const [m, r] = await Promise.all([
    askBackground<CheckAuthResponse>({ type: CHECK_AUTH_MESSAGE_TYPE, site: "mangalib" } satisfies CheckAuthRequest),
    askBackground<CheckAuthResponse>({ type: CHECK_AUTH_MESSAGE_TYPE, site: "remanga" } satisfies CheckAuthRequest),
  ]);
  set("mangalib", m?.signedIn ? `✓ Вошли как ${m.username ?? ""}` : "✗ Не авторизован", m?.signedIn ? "ok" : "bad");
  set("remanga", r?.signedIn ? `✓ Вошли как ${r.username ?? ""}` : "✗ Не авторизован", r?.signedIn ? "ok" : "bad");
}

async function buildPreviewWithProgress(): Promise<PreviewRow[]> {
  const fetchEl = document.querySelector<HTMLElement>("[data-progress-fetch]");
  const matchEl = document.querySelector<HTMLElement>("[data-progress-match]");
  const onProgress = (p: ImportProgress) => {
    if (p.phase === "fetching" && fetchEl) fetchEl.textContent = `Получаю закладки с MangaLib… ${p.current}`;
    if (p.phase === "matching" && matchEl) matchEl.textContent = `Ищу совпадения на Remanga… ${p.current} / ${p.total}`;
  };

  const deps = {
    fetchBookmarks: () => fetchMangalibBookmarks(mangalibTokenProvider, 1),
    fetchBookmarkTypes: () => fetchRemangaBookmarkTypes(remangaTokenProvider),
    fetchExistingBookmarks: async () => {
      const r = await askBackground<CheckAuthResponse>({ type: CHECK_AUTH_MESSAGE_TYPE, site: "remanga" } satisfies CheckAuthRequest);
      // We don't have user id directly in CheckAuthResponse; we ask remanga current/ via the client itself instead.
      // Use 0 as fallback — see Note below for production path.
      void r;
      return new Set<number>();
    },
    searchRemanga: (q: string) => searchRemanga(remangaTokenProvider, q),
    fetchTitleDetail: (dir: string) => fetchRemangaTitleDetail(remangaTokenProvider, dir),
    fetchChapters: (b: number) => fetchRemangaChapters(remangaTokenProvider, b),
    addBookmark: (titleId: number, typeId: number) => addRemangaBookmark(remangaTokenProvider, titleId, typeId),
    markChapterViewed: async (chapterId: number) => {
      const cookies = await chrome.cookies.getAll({ url: "https://remanga.org/" });
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      await markRemangaChapterAsViewed({ chapterId, cookie: cookieHeader, fetchImpl: fetch });
    },
    sleepMs: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  };

  await saveImportState({ startedAt: Date.now(), phase: "fetching", totalSelected: 0, doneIds: [], failedIds: [] });
  const preview = await runImport.buildPreview(deps, onProgress);
  await saveImportState({
    startedAt: Date.now(), phase: "preview",
    totalSelected: preview.filter((r) => r.selected).length,
    doneIds: [], failedIds: [],
  });
  if (matchEl) matchEl.textContent = `Готово, найдено ${preview.length} записей.`;
  return preview;
}

function renderPreview(preview: PreviewRow[]): void {
  const root = document.querySelector<HTMLElement>("[data-preview-table]");
  if (!root) return;
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `<tr><th>Перенести</th><th>MangaLib</th><th>Категория</th><th>Глава</th><th>Кандидат на Remanga</th></tr>`;
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  for (const row of preview) {
    const tr = document.createElement("tr");
    tr.dataset.kind = row.match.kind;
    tr.dataset.alreadyExists = String(row.alreadyExists);
    const tdSel = document.createElement("td");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = row.selected;
    cb.disabled = row.match.kind !== "certain" || row.targetBookmarkTypeId === null;
    cb.addEventListener("change", () => { row.selected = cb.checked; updateExecBtn(preview); });
    tdSel.appendChild(cb);
    const tdName = document.createElement("td");
    tdName.textContent = row.bookmark.rusName || row.bookmark.shortName || row.bookmark.slug;
    const tdCat = document.createElement("td");
    tdCat.textContent = row.targetCategoryName + (row.targetBookmarkTypeId === null ? " (категория не найдена)" : "");
    const tdCh = document.createElement("td");
    tdCh.textContent = row.bookmark.lastReadChapter !== null ? String(row.bookmark.lastReadChapter) : "—";
    const tdCand = document.createElement("td");
    tdCand.textContent =
      row.match.kind === "certain"
        ? row.match.chosen.main_name + (row.alreadyExists ? " (уже есть)" : "")
        : row.match.kind === "ambiguous"
          ? row.match.candidates.map((c) => c.main_name).join(" / ")
          : "не нашлось";
    tr.append(tdSel, tdName, tdCat, tdCh, tdCand);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  root.replaceChildren(table);
  updateExecBtn(preview);
}

function updateExecBtn(preview: PreviewRow[]): void {
  const btn = document.querySelector<HTMLButtonElement>("[data-execute-button]");
  if (!btn) return;
  const n = preview.filter((r) => r.selected).length;
  btn.disabled = n === 0;
  btn.textContent = `Перенести отмеченные (${n})`;
}

function bindExecuteButton(preview: PreviewRow[]): void {
  const btn = document.querySelector<HTMLButtonElement>("[data-execute-button]");
  const progressEl = document.querySelector<HTMLElement>("[data-progress-execute]");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const deps = {
      fetchBookmarks: () => fetchMangalibBookmarks(mangalibTokenProvider, 1),
      fetchBookmarkTypes: () => fetchRemangaBookmarkTypes(remangaTokenProvider),
      fetchExistingBookmarks: async () => new Set<number>(),
      searchRemanga: (q: string) => searchRemanga(remangaTokenProvider, q),
      fetchTitleDetail: (dir: string) => fetchRemangaTitleDetail(remangaTokenProvider, dir),
      fetchChapters: (b: number) => fetchRemangaChapters(remangaTokenProvider, b),
      addBookmark: (titleId: number, typeId: number) => addRemangaBookmark(remangaTokenProvider, titleId, typeId),
      markChapterViewed: async (chapterId: number) => {
        const cookies = await chrome.cookies.getAll({ url: "https://remanga.org/" });
        const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
        await markRemangaChapterAsViewed({ chapterId, cookie: cookieHeader, fetchImpl: fetch });
      },
      sleepMs: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    };
    const report = await runImport.execute(deps, preview, (p) => {
      if (p.phase === "executing" && progressEl) progressEl.textContent = `Перенос: ${p.current + 1} / ${p.total} — ${p.slug}`;
    });
    renderReport(report);
    await clearImportState();
  });
}

function renderReport(report: ExecutionReport): void {
  const root = document.querySelector<HTMLElement>("[data-report]");
  if (!root) return;
  root.hidden = false;
  root.innerHTML = `
    <h2>Готово</h2>
    <p>Перенесено: <b>${report.added.length}</b></p>
    <p>Пропущено: <b>${report.skipped.length}</b></p>
    <p>Не удалось: <b>${report.failed.length}</b></p>
    ${report.failed.length === 0 ? "" : `<details><summary>Подробности об ошибках</summary><ul>${report.failed.map((f) => `<li>${f.slug}: ${f.reason}</li>`).join("")}</ul></details>`}
  `;
}
```

- [ ] **Step 4: Run wiring tests, expect PASS** (4 tests).

- [ ] **Step 5: Run full check + build**

```bash
npm run check
npm run build
ls dist/import.js dist/mangalib-bridge.js public/import.html
```

All must succeed.

- [ ] **Step 6: Commit**

```bash
git add src/import-page.ts tests/import-page-wiring.test.ts
git commit -m "feat(import): wire import.html UI to orchestrator with progress and report"
```

---

## Task 16: Popup — auth status + import button + resume banner

**Files:**
- Modify: `public/popup.html`, `src/popup.ts`
- Test: `tests/popup-import-section.test.ts`

- [ ] **Step 1: Write the failing source-level test**

```ts
// tests/popup-import-section.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("public/popup.html"), "utf8");
const ts = readFileSync(resolve("src/popup.ts"), "utf8");

test("popup.html exposes import section with auth status hooks", () => {
  for (const hook of [
    "data-import-section",
    "data-auth-mangalib",
    "data-auth-remanga",
    "data-import-button",
    "data-resume-banner",
  ]) {
    assert.match(html, new RegExp(hook), `missing ${hook}`);
  }
});

test("popup.ts wires import section", () => {
  assert.match(ts, /CHECK_AUTH_MESSAGE_TYPE/);
  assert.match(ts, /chrome\.tabs\.create/);
  assert.match(ts, /import\.html/);
});
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Edit `public/popup.html`** — add new section near other groups:

```html
<section data-import-section class="import-section">
  <h2>Импорт закладок из MangaLib</h2>
  <div class="auth-row"><span>MangaLib:</span> <span data-auth-mangalib data-state="checking">проверяю…</span></div>
  <div class="auth-row"><span>Remanga:</span> <span data-auth-remanga data-state="checking">проверяю…</span></div>
  <button class="primary" data-import-button disabled>Импорт закладок из MangaLib</button>
  <div data-resume-banner hidden></div>
</section>
```

Add styles:

```css
.import-section{margin-top:16px;padding:12px;border:1px solid var(--border);border-radius:12px}
.import-section h2{font-size:14px;margin:0 0 8px;color:var(--text-muted);font-weight:600}
.auth-row{display:flex;justify-content:space-between;font-size:13px;padding:4px 0}
.auth-row span[data-state="ok"]{color:#4ade80}
.auth-row span[data-state="bad"]{color:#ef4444}
.import-section button.primary{width:100%;margin-top:8px}
[data-resume-banner]{margin-top:8px;padding:8px;background:rgba(251,191,36,.12);border-radius:8px;font-size:12px;cursor:pointer}
```

- [ ] **Step 4: Edit `src/popup.ts`** — add to imports:

```ts
import {
  CHECK_AUTH_MESSAGE_TYPE,
  type CheckAuthRequest,
  type CheckAuthResponse,
} from "./import-mangalib/messages.js";
import { loadImportState } from "./import-mangalib/state.js";
```

Add at the end of `main()`: `await wireImportSection();`

Add at the bottom of the file:

```ts
async function wireImportSection(): Promise<void> {
  const ml = document.querySelector<HTMLElement>("[data-auth-mangalib]");
  const rm = document.querySelector<HTMLElement>("[data-auth-remanga]");
  const btn = document.querySelector<HTMLButtonElement>("[data-import-button]");
  const banner = document.querySelector<HTMLElement>("[data-resume-banner]");
  if (!ml || !rm || !btn) return;

  const setSpan = (el: HTMLElement, r: CheckAuthResponse | null) => {
    if (r?.signedIn) { el.textContent = `✓ ${r.username ?? "вошли"}`; el.dataset.state = "ok"; }
    else { el.textContent = "✗ не авторизован"; el.dataset.state = "bad"; }
  };
  const ask = (site: "mangalib" | "remanga") => new Promise<CheckAuthResponse | null>((res) => {
    const req: CheckAuthRequest = { type: CHECK_AUTH_MESSAGE_TYPE, site };
    chrome.runtime.sendMessage(req, (resp: unknown) => {
      void chrome.runtime?.lastError;
      res(resp && typeof resp === "object" && "signedIn" in resp ? (resp as CheckAuthResponse) : null);
    });
  });

  const [m, r] = await Promise.all([ask("mangalib"), ask("remanga")]);
  setSpan(ml, m); setSpan(rm, r);
  btn.disabled = !(m?.signedIn && r?.signedIn);
  if (btn.disabled) btn.title = "Сначала войдите в оба сайта";
  btn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("import.html") });
  });

  if (banner) {
    const state = await loadImportState();
    if (state && state.phase !== "done") {
      banner.hidden = false;
      banner.textContent = `Прерванный импорт (${state.phase}). Открыть страницу импорта.`;
      banner.addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("import.html") });
      });
    }
  }
}
```

- [ ] **Step 5: Run wiring tests, expect PASS** (2 tests).

- [ ] **Step 6: Run full check + build**

```bash
npm run check
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add public/popup.html src/popup.ts tests/popup-import-section.test.ts
git commit -m "feat(import): popup auth status, import button, resume banner"
```

---

## Task 17: Manual smoke test

**Files:** none changed unless bugs surface.

**Critical rule:** **Don't click «Перенести отмеченные» on the user's real Remanga account.** Per memory `feedback_no_real_writes_to_remanga`, real writes need explicit per-action confirmation. Use a test account or stop at preview.

- [ ] **Step 1: Build and load**

```bash
npm run build
```

In Chrome → `chrome://extensions/` → Developer mode ON → "Load unpacked" → select `dist/`.

- [ ] **Step 2: Sign in to mangalib.me + remanga.org in same Chrome profile**

- [ ] **Step 3: Open popup, verify auth-status block**

Both should be green with usernames; "Импорт" button enabled.

- [ ] **Step 4: Click "Импорт"; new tab opens with `import.html`**

- [ ] **Step 5: Verify progress: «Получаю закладки с MangaLib… 5» (matches user's count) → «Ищу совпадения на Remanga…»**

- [ ] **Step 6: Spot-check the preview**

Each MangaLib bookmark should have one of: ✅/⚠/❌ tag. **Do not click «Перенести отмеченные» on a real account.** Take a screenshot of the preview, attach to PR / hand to user.

- [ ] **Step 7: Stop here unless using a test Remanga account**

If issues found, fix in the relevant module (back-track to its task), re-run that task's automated test, recommit, retest from Step 3.

- [ ] **Step 8: Update CLAUDE.md anti-patterns if needed**

If smoke surfaced a project-specific gotcha (e.g. "DO NOT call chrome.cookies without `cookies` permission"), add it under `## Anti-Patterns` as a one-liner.

- [ ] **Step 9: Final commit summary**

```bash
git log --oneline | head -25
```

---

## Self-review (already applied inline)

- All spec sections covered: popup with auth status (Task 16), preview on own page (Task 14, 15), status mapping (Task 1), title matching (Task 2), bookmarks parsing (Task 3), chapter progress (Task 4), resume state (Task 5), mangalib API (Task 6, 7, 8), remanga API (Task 9), orchestrator with rate-limit + error continue (Task 10), background relays (Task 11), manifest perms (Task 12), bundles (Task 13), smoke (Task 17).
- Tests reference real fixtures (`tests/fixtures/import-mangalib/*.json`), not synthetic data, except the `progress: "12"` synthetic case for testing non-zero parsing.
- Type names consistent: `RemangaCandidate { id, dir, main_name, secondary_name, another_name }`, `RemangaChapter { id, index }`, `MangalibBookmark { bookmarkId, mangaId, slug, slugUrl, rusName, engName, shortName, status, lastReadChapter, itemsTotal }`, `PreviewRow { bookmark, match, alreadyExists, selected, targetBookmarkTypeId, targetCategoryName }`, `ExecutionReport { added, skipped, failed[] }`. Used identically across tasks.
- POST `/api/v2/bookmarks/` for `addRemangaBookmark` is best-guess (TBD until smoke). Body shape `{title, type}` follows pre-existing convention from `vraestoren/remanga.py`. If smoke shows different URL/body, fix only `remanga-client.ts:addRemangaBookmark` — orchestrator is isolated.
- TDD cadence uniform: failing test → run → implement → run → commit. No skipped failure-runs.
