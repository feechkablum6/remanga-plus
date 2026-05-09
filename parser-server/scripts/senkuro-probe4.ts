import fs from "node:fs/promises";
import path from "node:path";
import { HttpClient } from "../src/http/client.js";

const ENDPOINT = "https://api.senkuro.com/graphql";
const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures");

const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });

const gql = async (query: string, variables?: unknown) => {
  const r = await client.request(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return JSON.parse(await r.text()) as { data?: any; errors?: Array<{ message: string }> };
};

const save = async (name: string, data: unknown) => {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURES_DIR, name), JSON.stringify(data, null, 2), "utf8");
};

const probeField = async (label: string, parentQuery: string, field: string) => {
  const q = parentQuery.replace("__FIELD__", `${field} { __typename }`);
  const r = await gql(q);
  const msg = r.errors?.map((e) => e.message).join(" | ") ?? "";
  if (/Unknown field/.test(msg)) return null;
  if (/must not have a selection since type/.test(msg)) {
    const m = msg.match(/type "([^"]+)"/);
    return `scalar(${m?.[1]})`;
  }
  if (/must have a selection/.test(msg)) return "object";
  if (/You must provide a `first` or `last`/i.test(msg)) return "connection";
  if (/required but not provided/i.test(msg)) return `args-required(${msg.slice(0, 80)})`;
  if (msg) return `ERR ${msg.slice(0, 100)}`;
  return `OK ${JSON.stringify(r.data).slice(0, 200)}`;
};

async function main() {
  console.log("=== Get real branch ID for Tower of God ===");
  const mangaDetails = await gql(
    `{ manga(slug: "tower-of-god") { id branches { id lang chapters } } }`,
  );
  const branches = mangaDetails.data?.manga?.branches as Array<{ id: string; lang: string; chapters: number }> | undefined;
  if (!branches?.length) {
    console.log("No branches");
    return;
  }
  const ruBranch = branches.find((b) => b.lang === "RU") ?? branches[0];
  const branchId = ruBranch.id;
  console.log(`branch id = ${branchId} (lang=${ruBranch.lang}, ${ruBranch.chapters} chapters)`);

  console.log("\n=== Probe MangaChaptersConnection shape ===");
  const shapes = [
    `{ mangaChapters(branchId: "${branchId}", first: 1) { __typename } }`,
    `{ mangaChapters(branchId: "${branchId}", first: 1) { edges { __typename } } }`,
    `{ mangaChapters(branchId: "${branchId}", first: 1) { pageInfo { __typename } } }`,
  ];
  for (const q of shapes) {
    const r = await gql(q);
    console.log(`${q.slice(0, 80)}... →`, JSON.stringify(r));
  }

  console.log("\n=== Probe chapter fields ===");
  const chapterParent = `{ mangaChapters(branchId: "${branchId}", first: 1) { edges { node { __FIELD__ } } } }`;
  const chapterCandidates = [
    "id", "slug", "number", "volume", "chapter", "name", "title",
    "pages", "pageCount", "frames", "images",
    "publishedAt", "createdAt", "updatedAt", "uploadedAt",
    "translator", "team", "branch", "branchId",
    "isAvailable", "isLocked", "locked", "free", "paid", "premium",
    "url", "externalUrl",
    "status", "type",
  ];
  const chapterResults: Record<string, string | null> = {};
  for (const f of chapterCandidates) {
    const r = await probeField(`Chapter.${f}`, chapterParent, f);
    if (r !== null) {
      chapterResults[f] = r;
      console.log(`  chapter.${f}: ${r}`);
    }
  }
  await save("senkuro-chapter-fields.json", chapterResults);

  console.log("\n=== Full chapter sample ===");
  const sample = await gql(
    `{ mangaChapters(branchId: "${branchId}", first: 3) { edges { node { id number volume name pages frames images pageCount publishedAt } } } }`,
  );
  console.log(JSON.stringify(sample, null, 2).slice(0, 2500));
  await save("senkuro-chapter-sample.json", sample);

  console.log("\n=== Probe mangaChapter(slug:...) response ===");
  // нужно понять что такое slug у главы. Возможно id? Попробуем оба.
  const chapterEdges = sample.data?.mangaChapters?.edges;
  const firstNode = chapterEdges?.[0]?.node;
  console.log("first chapter node keys:", firstNode && Object.keys(firstNode));

  if (firstNode?.id) {
    // Попытка получить главу через mangaChapter по id и slug
    const byId = await gql(`{ mangaChapter(slug: "${firstNode.id}") { __typename } }`);
    console.log("mangaChapter by id:", JSON.stringify(byId).slice(0, 400));

    // Если есть slug — используем
    const slugy = (firstNode as { slug?: string; number?: string | number }).slug;
    if (slugy) {
      const bySlug = await gql(`{ mangaChapter(slug: "${slugy}") { __typename } }`);
      console.log("mangaChapter by real slug:", JSON.stringify(bySlug).slice(0, 400));
    }
  }

  console.log("\n=== Probe fields on mangaChapter's return type ===");
  const chapterSlugOrId = (firstNode as { slug?: string; id?: string } | undefined)?.slug
    ?? (firstNode as { id?: string } | undefined)?.id;
  if (chapterSlugOrId) {
    const detailedFields = [
      "id", "slug", "number", "volume", "chapter",
      "pages", "pageCount", "frames", "images",
      "manga", "branch",
      "isAvailable", "isLocked", "paid",
      "publishedAt", "createdAt",
    ];
    const parent = `{ mangaChapter(slug: "${chapterSlugOrId}") { __FIELD__ } }`;
    for (const f of detailedFields) {
      const r = await probeField(f, parent, f);
      if (r !== null) console.log(`  mangaChapter.${f}: ${r}`);
    }

    const pagesShapes = [
      `{ mangaChapter(slug: "${chapterSlugOrId}") { pages { url } } }`,
      `{ mangaChapter(slug: "${chapterSlugOrId}") { pages { image { url } } } }`,
      `{ mangaChapter(slug: "${chapterSlugOrId}") { pages { __typename id } } }`,
      `{ mangaChapter(slug: "${chapterSlugOrId}") { frames { __typename } } }`,
      `{ mangaChapter(slug: "${chapterSlugOrId}") { images { __typename } } }`,
    ];
    for (const q of pagesShapes) {
      const r = await gql(q);
      console.log(q.slice(0, 90), "→", JSON.stringify(r).slice(0, 500));
    }
  }

  console.log("\n=== Probe i18n-title fields ===");
  const i18nParent = `{ manga(slug: "tower-of-god") { originalName { __FIELD__ } } }`;
  const i18nCandidates = ["lang", "content", "language", "text"];
  for (const f of i18nCandidates) {
    const r = await probeField(f, i18nParent, f);
    if (r !== null) console.log(`  I18nTitle.${f}: ${r}`);
  }

  console.log("\n=== Save full real-world search & manga for fixtures ===");
  const searchFixture = await gql(`
    {
      mangas(first: 5, search: "tower of god") {
        edges {
          node {
            id
            slug
            status
            type
            originalName { lang content }
            titles { lang content }
            alternativeNames { lang content }
          }
        }
      }
    }
  `);
  await save("senkuro-search.json", searchFixture);

  const mangaFixture = await gql(`
    {
      manga(slug: "tower-of-god") {
        id
        slug
        status
        type
        score
        views
        originalName { lang content }
        titles { lang content }
        alternativeNames { lang content }
        branches { id lang chapters }
      }
    }
  `);
  await save("senkuro-manga.json", mangaFixture);

  if (branchId) {
    const chaptersFixture = await gql(`
      {
        mangaChapters(branchId: "${branchId}", first: 5) {
          edges {
            node {
              id
              number
              volume
              name
            }
          }
        }
      }
    `);
    await save("senkuro-chapters.json", chaptersFixture);
  }

  console.log("\nSAVED fixtures/senkuro-{search,manga,chapters}.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
