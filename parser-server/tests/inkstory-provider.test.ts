import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const fixturesDir = path.resolve(process.cwd(), "fixtures/inkstory");
const searchFixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, "api-search.json"), "utf8"));
const bookFixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, "api-book.json"), "utf8"));
const branchesFixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, "api-branches.json"), "utf8"));
const chaptersFixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, "api-chapters.json"), "utf8"));
const chapterFixture = JSON.parse(fs.readFileSync(path.join(fixturesDir, "api-chapter.json"), "utf8"));

const loadModule = async () => {
  const module = await import("../src/providers/inkstory.js");
  return module as {
    extractInkstorySearchResults: (json: unknown) => unknown;
    extractInkstoryTitleDetails: (json: unknown, titleRef: string) => unknown;
    extractInkstoryChapterPages: (json: unknown, chapterRef: string) => unknown;
    pickInkstoryBranch: (branches: unknown) => unknown;
    InkstoryProvider: new (http?: unknown) => {
      name: string;
      manualSearchUrl: (q: string) => string;
      searchTitles: (q: string) => Promise<unknown[]>;
      getTitleDetails: (ref: string, options?: { forcedBranchId?: string }) => Promise<unknown>;
      parseChapter: (ref: string) => Promise<unknown>;
      fetchImage: (url: string) => Promise<Buffer>;
    };
  };
};

describe("extractInkstorySearchResults", () => {
  it("maps books array to SourceTitleSearchResult with RU name preference", async () => {
    const { extractInkstorySearchResults } = await loadModule();
    const result = extractInkstorySearchResults(searchFixture) as Array<{
      titleId: string;
      slug: string;
      titleName: string;
      titleUrl: string;
    }>;
    assert.ok(result.length >= 1);
    const solo = result.find((r) => r.slug === "solo-leveling");
    assert.ok(solo, "solo-leveling must be in results");
    assert.equal(solo.titleName, "Поднятие уровня в одиночку");
    assert.equal(solo.titleUrl, "https://inkstory.net/content/solo-leveling");
    assert.ok(solo.titleId, "titleId must be present");
  });

  it("returns empty array for empty / malformed search payloads", async () => {
    const { extractInkstorySearchResults } = await loadModule();
    assert.deepEqual(extractInkstorySearchResults([]), []);
    assert.deepEqual(extractInkstorySearchResults(null), []);
    assert.deepEqual(extractInkstorySearchResults({}), []);
  });
});

describe("pickInkstoryBranch", () => {
  const mkBranch = (
    overrides: Partial<{
      id: string;
      chaptersCount: number;
      editorsChoice: boolean;
      licensed: boolean;
      deleted: boolean;
      moderationStatus: string;
      updatedAt: string;
    }>,
  ) => ({
    id: overrides.id ?? `id-${Math.random()}`,
    chaptersCount: overrides.chaptersCount ?? 10,
    editorsChoice: overrides.editorsChoice ?? false,
    licensed: overrides.licensed ?? false,
    deleted: overrides.deleted ?? false,
    moderationStatus: overrides.moderationStatus ?? "APPROVED",
    updatedAt: overrides.updatedAt ?? "2024-01-01T00:00:00Z",
  });

  it("returns null when no branches have chapters", async () => {
    const { pickInkstoryBranch } = await loadModule();
    assert.equal(
      pickInkstoryBranch([mkBranch({ chaptersCount: 0 }), mkBranch({ chaptersCount: 0 })]),
      null,
    );
  });

  it("rejects deleted and non-APPROVED branches", async () => {
    const { pickInkstoryBranch } = await loadModule();
    const r = pickInkstoryBranch([
      mkBranch({ id: "del", deleted: true, chaptersCount: 100 }),
      mkBranch({ id: "pending", moderationStatus: "PENDING", chaptersCount: 100 }),
      mkBranch({ id: "ok", chaptersCount: 50 }),
    ]) as { id: string } | null;
    assert.equal(r?.id, "ok");
  });

  it("prefers editorsChoice even with fewer chapters", async () => {
    const { pickInkstoryBranch } = await loadModule();
    const r = pickInkstoryBranch([
      mkBranch({ id: "big", chaptersCount: 200 }),
      mkBranch({ id: "editors", chaptersCount: 50, editorsChoice: true }),
    ]) as { id: string };
    assert.equal(r.id, "editors");
  });

  it("tie-breaks by chaptersCount DESC then updatedAt DESC", async () => {
    const { pickInkstoryBranch } = await loadModule();
    const r = pickInkstoryBranch([
      mkBranch({ id: "small-new", chaptersCount: 50, updatedAt: "2025-06-01T00:00:00Z" }),
      mkBranch({ id: "big-old", chaptersCount: 200, updatedAt: "2023-01-01T00:00:00Z" }),
      mkBranch({ id: "big-new", chaptersCount: 200, updatedAt: "2025-06-01T00:00:00Z" }),
    ]) as { id: string };
    assert.equal(r.id, "big-new");
  });
});

describe("extractInkstoryTitleDetails", () => {
  const ruBranch = branchesFixture.find(
    (b: { publishers?: Array<{ slug: string }> }) => b.publishers?.[0]?.slug === "cherno-alfa",
  );
  const activeBranchId = branchesFixture.find(
    (b: { chaptersCount: number }) => b.chaptersCount > 100,
  )?.id;

  it("aggregates name + altNames into titleName + aliases", async () => {
    const { extractInkstoryTitleDetails } = await loadModule();
    const details = extractInkstoryTitleDetails(
      { book: bookFixture, chapters: chaptersFixture, branches: branchesFixture },
      "solo-leveling",
    ) as {
      titleName: string;
      aliases: string[];
      titleUrl: string;
      slug: string;
    };

    assert.equal(details.slug, "solo-leveling");
    assert.equal(details.titleUrl, "https://inkstory.net/content/solo-leveling");
    // titleName should be the RU name from book.name.ru
    assert.equal(details.titleName, "Поднятие уровня в одиночку");
    // English, original (Korean) and altNames entries must be in aliases
    assert.ok(details.aliases.includes("Solo Leveling"));
    assert.ok(details.aliases.includes("나 혼자만 레벨업"));
    assert.ok(details.aliases.includes("Only I Level up"));
    assert.ok(details.aliases.includes("Соло"));
  });

  it("filters chapters to the chosen branch and drops donut/corrupted/not-approved", async () => {
    const { extractInkstoryTitleDetails } = await loadModule();
    const synthetic = {
      book: { ...bookFixture, id: "BOOK", slug: "x" },
      branches: [
        {
          id: "B_MAIN",
          chaptersCount: 3,
          editorsChoice: true,
          deleted: false,
          moderationStatus: "APPROVED",
          updatedAt: "2025-01-01T00:00:00Z",
        },
        {
          id: "B_OTHER",
          chaptersCount: 1,
          deleted: false,
          moderationStatus: "APPROVED",
          updatedAt: "2025-01-01T00:00:00Z",
        },
      ],
      chapters: [
        { id: "ok1", number: 1, volume: 1, donut: false, corrupted: false, moderationStatus: "APPROVED", branchId: "B_MAIN" },
        { id: "donut", number: 2, volume: 1, donut: true, corrupted: false, moderationStatus: "APPROVED", branchId: "B_MAIN" },
        { id: "corrupt", number: 3, volume: 1, donut: false, corrupted: true, moderationStatus: "APPROVED", branchId: "B_MAIN" },
        { id: "pending", number: 4, volume: 1, donut: false, corrupted: false, moderationStatus: "PENDING", branchId: "B_MAIN" },
        { id: "ok2", number: 5, volume: 1, donut: false, corrupted: false, moderationStatus: "APPROVED", branchId: "B_MAIN" },
        { id: "other-branch", number: 6, volume: 1, donut: false, corrupted: false, moderationStatus: "APPROVED", branchId: "B_OTHER" },
      ],
    };
    const details = extractInkstoryTitleDetails(synthetic, "x") as {
      chapters: Array<{ chapterId: string; chapter: string; volume: number }>;
    };
    assert.deepEqual(
      details.chapters.map((c) => c.chapterId),
      ["ok1", "ok2"],
    );
    assert.equal(details.chapters[0].volume, 1);
    assert.equal(details.chapters[0].chapter, "1");
  });

  it("returns empty chapters when no branch passes the filter", async () => {
    const { extractInkstoryTitleDetails } = await loadModule();
    const synthetic = {
      book: { ...bookFixture, id: "X", slug: "empty" },
      branches: [{ id: "b", chaptersCount: 0, deleted: false, moderationStatus: "APPROVED" }],
      chapters: [],
    };
    const details = extractInkstoryTitleDetails(synthetic, "empty") as { chapters: unknown[] };
    assert.deepEqual(details.chapters, []);
  });

  it("produces chapterUrl in /content/<slug>/<uuid> form matching the website", async () => {
    const { extractInkstoryTitleDetails } = await loadModule();
    const details = extractInkstoryTitleDetails(
      { book: bookFixture, chapters: chaptersFixture, branches: branchesFixture },
      "solo-leveling",
    ) as { chapters: Array<{ chapterUrl: string }> };
    assert.ok(
      details.chapters[0].chapterUrl.startsWith("https://inkstory.net/content/solo-leveling/"),
    );
    assert.match(details.chapters[0].chapterUrl, /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
  });
});

describe("extractInkstoryChapterPages", () => {
  it("maps pages[].image to ExternalChapterParseResult keeping index order", async () => {
    const { extractInkstoryChapterPages } = await loadModule();
    const result = extractInkstoryChapterPages(
      chapterFixture,
      "552f7cd3-3f6e-4b28-966e-e6317bc75da8",
    ) as {
      chapterId: string;
      chapter: string;
      volume: number;
      pages: Array<{ index: number; imageRef: string }>;
    };
    assert.equal(result.chapterId, "552f7cd3-3f6e-4b28-966e-e6317bc75da8");
    assert.equal(result.chapter, "200");
    assert.equal(result.volume, 3);
    assert.ok(result.pages.length >= 8);
    assert.equal(result.pages[0].index, 0);
    assert.ok(result.pages[0].imageRef.startsWith("https://static.inuko.me/chapters/"));
    for (let i = 1; i < result.pages.length; i += 1) {
      assert.ok(result.pages[i].index > result.pages[i - 1].index);
    }
  });

  it("throws when chapter is missing", async () => {
    const { extractInkstoryChapterPages } = await loadModule();
    assert.throws(() => extractInkstoryChapterPages(null, "x"), /not found|null|missing/i);
  });
});

describe("InkstoryProvider", () => {
  it("has the right name and manualSearchUrl", async () => {
    const { InkstoryProvider } = await loadModule();
    const p = new InkstoryProvider();
    assert.equal(p.name, "inkstory");
    assert.equal(
      p.manualSearchUrl("solo leveling"),
      "https://inkstory.net/content?search=solo%20leveling",
    );
  });

  it("searchTitles GETs /v2/books?search=<q>", async () => {
    const { InkstoryProvider } = await loadModule();
    let capturedUrl: string | undefined;
    const fakeHttp = {
      async request(url: string) {
        capturedUrl = url;
        return new Response(JSON.stringify(searchFixture), { status: 200 });
      },
    };
    const results = await new InkstoryProvider(fakeHttp).searchTitles("solo leveling");
    assert.ok(capturedUrl?.includes("/v2/books"));
    assert.ok(
      capturedUrl?.includes("search=solo+leveling") ||
        capturedUrl?.includes("search=solo%20leveling"),
    );
    assert.ok(results.length >= 1);
  });

  it("getTitleDetails hits book, branches, chapters endpoints", async () => {
    const { InkstoryProvider } = await loadModule();
    const hits: string[] = [];
    const fakeHttp = {
      async request(url: string) {
        hits.push(url);
        if (/\/v2\/books\/[^?]*$/.test(url)) {
          return new Response(JSON.stringify(bookFixture), { status: 200 });
        }
        if (url.includes("/v2/branches")) {
          return new Response(JSON.stringify(branchesFixture), { status: 200 });
        }
        if (url.includes("/v2/chapters?")) {
          return new Response(JSON.stringify(chaptersFixture), { status: 200 });
        }
        return new Response("[]", { status: 200 });
      },
    };

    const details = (await new InkstoryProvider(fakeHttp).getTitleDetails("solo-leveling")) as {
      slug: string;
      chapters: unknown[];
    };
    assert.equal(details.slug, "solo-leveling");
    assert.ok(details.chapters.length > 0);
    assert.equal(hits.length, 3);
    assert.ok(hits[0].includes("/v2/books/solo-leveling"));
    assert.ok(hits.some((u) => u.includes("/v2/branches")));
    assert.ok(hits.some((u) => u.includes("/v2/chapters?bookId=")));
  });

  it("parseChapter extracts UUID from URL and GETs /v2/chapters/<uuid>", async () => {
    const { InkstoryProvider } = await loadModule();
    let calledWith: string | undefined;
    const fakeHttp = {
      async request(url: string) {
        calledWith = url;
        return new Response(JSON.stringify(chapterFixture), { status: 200 });
      },
    };
    const result = (await new InkstoryProvider(fakeHttp).parseChapter(
      "https://inkstory.net/content/solo-leveling/552f7cd3-3f6e-4b28-966e-e6317bc75da8",
    )) as { chapterId: string; pages: unknown[] };
    assert.equal(
      calledWith,
      "https://api.inkstory.net/v2/chapters/552f7cd3-3f6e-4b28-966e-e6317bc75da8",
    );
    assert.equal(result.chapterId, "552f7cd3-3f6e-4b28-966e-e6317bc75da8");
    assert.ok(result.pages.length > 0);
  });

  it("getTitleDetails exposes branches and selectedBranchId", async () => {
    const { InkstoryProvider } = await loadModule();
    const fakeHttp = {
      async request(url: string) {
        if (url.includes("/v2/branches")) {
          return new Response(JSON.stringify(branchesFixture), { status: 200 });
        }
        if (/\/v2\/books\/[^?]+$/.test(url)) {
          return new Response(JSON.stringify(bookFixture), { status: 200 });
        }
        if (url.includes("/v2/chapters?bookId=")) {
          return new Response(JSON.stringify(chaptersFixture), { status: 200 });
        }
        return new Response("[]", { status: 200 });
      },
    };
    const details = (await new InkstoryProvider(fakeHttp).getTitleDetails(
      "solo-leveling",
    )) as {
      branches?: Array<{ id: string; name: string; chaptersCount: number }>;
      selectedBranchId?: string;
      chapters: unknown[];
    };
    assert.ok(details.branches, "branches should be present");
    assert.ok(details.branches.length >= 1);
    assert.ok(details.selectedBranchId, "selectedBranchId should be present");
    const selected = details.branches.find((b) => b.id === details.selectedBranchId);
    assert.ok(selected, "selectedBranchId must exist in branches");
    assert.equal(details.chapters.length > 0, true);
    // Every branch must have a human-readable name (not empty)
    details.branches.forEach((b) => assert.ok(b.name && b.name.length > 0, `branch ${b.id} needs a name`));
  });

  it("getTitleDetails({forcedBranchId}) uses the forced branch instead of the default pick", async () => {
    const { InkstoryProvider } = await loadModule();
    const fakeHttp = {
      async request(url: string) {
        if (url.includes("/v2/branches")) {
          return new Response(JSON.stringify(branchesFixture), { status: 200 });
        }
        if (/\/v2\/books\/[^?]+$/.test(url)) {
          return new Response(JSON.stringify(bookFixture), { status: 200 });
        }
        if (url.includes("/v2/chapters?bookId=")) {
          return new Response(JSON.stringify(chaptersFixture), { status: 200 });
        }
        return new Response("[]", { status: 200 });
      },
    };
    // pick a branch that is NOT the default (default for Solo Leveling = `ede41e93` with 203 chapters)
    const forcedBranchId = "d71550c4-be1a-4d4c-b99a-51aa8e32e704";
    const details = (await new InkstoryProvider(fakeHttp).getTitleDetails("solo-leveling", {
      forcedBranchId,
    })) as { selectedBranchId?: string; chapters: Array<{ chapterId: string }> };
    assert.equal(details.selectedBranchId, forcedBranchId);
    assert.ok(details.chapters.length > 0);
    // All returned chapters must belong to the forced branch.
    // We can't check branchId from the adapted SourceChapterReference directly, but
    // we can check that chapter 200's id corresponds to the one in this branch (552f7cd3).
    const ch200 = details.chapters.find((c) => /552f7cd3/.test(c.chapterId));
    assert.ok(ch200, "forced branch 'd71550c4' chapter 200 (id 552f7cd3-...) must be listed");
  });

  it("fetchImage does a plain GET without Referer", async () => {
    const { InkstoryProvider } = await loadModule();
    let observed: Headers | undefined;
    const fakeHttp = {
      async request(_url: string, init?: RequestInit) {
        observed = new Headers(init?.headers);
        return new Response(Buffer.from([0xff, 0xd8]), { status: 200 });
      },
    };
    const buf = await new InkstoryProvider(fakeHttp).fetchImage(
      "https://static.inuko.me/chapters/x/y.jpeg",
    );
    assert.equal(buf.length, 2);
    assert.equal(observed?.get("referer"), null);
  });

  it("fetchImage decrypts protected XOR chapter images", async () => {
    const { InkstoryProvider } = await loadModule();
    const plain = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
    const key = Buffer.from("UySkp0BzPhwlvP2V");
    const encrypted = Buffer.from(plain.map((byte, index) => byte ^ key[index % key.length]));
    let requestedUrl = "";
    const fakeHttp = {
      async request(url: string) {
        requestedUrl = url;
        return new Response(encrypted, { status: 200 });
      },
    };

    const buf = await new InkstoryProvider(fakeHttp).fetchImage(
      "https://static.inuko.me/chapters/x/0f8ba8a7-aa26-sa38-8c9a-8cace6221978.jpeg",
    );

    assert.equal(requestedUrl, "https://static.inuko.me/chapters/x/0f8ba8a7-aa26-xa38-8c9a-8cace6221978.jpeg");
    assert.deepEqual(buf, plain);
  });
});
