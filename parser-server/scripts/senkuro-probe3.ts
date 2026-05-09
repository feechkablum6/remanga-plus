import fs from "node:fs/promises";
import path from "node:path";
import { HttpClient } from "../src/http/client.js";

const ENDPOINT = "https://api.senkuro.com/graphql";
const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures");

const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });

const gql = async (query: string, variables?: unknown) => {
  const response = await client.request(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as { data?: unknown; errors?: Array<{ message: string }> };
  } catch {
    return { errors: [{ message: text.slice(0, 500) }] };
  }
};

const save = async (name: string, data: unknown) => {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURES_DIR, name), JSON.stringify(data, null, 2), "utf8");
};

type QueryCandidate = { name: string; args?: string; selection?: string };

const probeQuery = async (label: string, q: string) => {
  const resp = await gql(q);
  if (resp.errors) {
    const msg = resp.errors.map((e) => e.message).join(" | ");
    console.log(`${label}: ERR ${msg.slice(0, 250)}`);
  } else {
    console.log(`${label}: OK ${JSON.stringify(resp.data).slice(0, 250)}`);
  }
  return resp;
};

async function main() {
  console.log("=== A. Chapter-related Query fields ===");
  // Проверяем возможные top-level queries для глав
  const chapterRootCandidates = [
    "chapter",
    "chapters",
    "mangaChapters",
    "mangaChapter",
    "chapterByMangaId",
    "chapterById",
    "chapterBySlug",
    "mangaChapterList",
    "branch",
    "branches",
    "mangaBranch",
  ];

  for (const name of chapterRootCandidates) {
    await probeQuery(name, `{ ${name} { __typename } }`);
  }

  console.log("\n=== B. Introspect Manga object more deeply ===");
  const deeperMangaFields = [
    "summary",
    "synopsis",
    "description",
    "descriptionLocalized",
    "genres",
    "tags",
    "alternativeNames",
    "translators",
    "teams",
    "format",
    "category",
    "kind",
    "releaseYear",
    "year",
    "publishedAt",
    "author",
    "authors",
    "artist",
    "artists",
    "score",
    "stats",
    "views",
    "mangaPage",
  ];

  for (const f of deeperMangaFields) {
    const r = await gql(`{ manga(slug: "tower-of-god") { ${f} { __typename } } }`);
    const msg = r.errors?.map((e) => e.message).join(" | ") ?? "";
    if (msg.includes("Unknown field")) continue;
    console.log(`  manga.${f}: ${msg || `OK ${JSON.stringify(r.data).slice(0, 160)}`}`);
  }

  console.log("\n=== C. Check originalName type ===");
  await probeQuery("manga.originalName fields", `{ manga(slug: "tower-of-god") { originalName { __typename } } }`);

  console.log("\n=== D. cover fields ===");
  const coverFields = ["original", "url", "thumbnail", "large", "medium", "small", "preview", "__typename"];
  for (const f of coverFields) {
    const r = await gql(`{ manga(slug: "tower-of-god") { cover { ${f} } } }`);
    const msg = r.errors?.map((e) => e.message).join(" | ") ?? "";
    if (msg.includes("Unknown field")) continue;
    console.log(`  cover.${f}: ${msg || JSON.stringify(r.data).slice(0, 240)}`);
  }

  console.log("\n=== E. Real search + details of 'tower of god' ===");
  const realSearch = await gql(
    `{ mangas(first: 3, search: "tower of god") { edges { node { id slug status type titles { lang content } originalName { __typename } } } } }`,
  );
  console.log("search:", JSON.stringify(realSearch, null, 2).slice(0, 1500));
  await save("senkuro-search-probe.json", realSearch);

  const realManga = await gql(
    `{ manga(slug: "tower-of-god") { id slug status type titles { lang content } branches { id lang chapters } } }`,
  );
  console.log("\nmanga details:", JSON.stringify(realManga, null, 2).slice(0, 1500));
  await save("senkuro-manga-probe.json", realManga);

  console.log("\n=== F. Chapter arguments: try mangaChapters / chapters / etc with various args ===");
  const guessedChapterQueries = [
    `{ mangaChapters(mangaSlug: "tower-of-god") { __typename } }`,
    `{ mangaChapters(mangaId: "abc") { __typename } }`,
    `{ mangaChapters(branchId: "abc") { __typename } }`,
    `{ mangaChapters(first: 5) { __typename } }`,
    `{ chapters(first: 5) { __typename } }`,
    `{ chapters(mangaSlug: "tower-of-god") { __typename } }`,
    `{ chapters(branchId: "abc") { __typename } }`,
    `{ chapter(id: "x") { __typename } }`,
    `{ chapter(slug: "x") { __typename } }`,
    `{ chapterPages(id: "x") { __typename } }`,
    `{ chapterPages(chapterId: "x") { __typename } }`,
  ];
  for (const q of guessedChapterQueries) {
    await probeQuery(q, q);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
