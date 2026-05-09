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

// Поля, которые хочется проверить для Manga
const mangaCandidateFields = [
  "id",
  "slug",
  "cover",
  "coverImage",
  "image",
  "status",
  "type",
  "kind",
  "rating",
  "description",
  "originalName",
  "russianName",
  "englishName",
  "genres",
  "tags",
  "branches",
  "titles",
  "releaseYear",
  "publishedAt",
  "createdAt",
  "updatedAt",
];

// Поля для типа Branch (гипотеза: branch = translation team's chapter set)
const branchCandidateFields = [
  "id",
  "slug",
  "name",
  "team",
  "translator",
  "chapters",
  "chaptersCount",
  "lang",
  "language",
];

const titleCandidateFields = ["lang", "language", "text", "name", "title", "content"];
const chapterCandidateFields = [
  "id",
  "number",
  "volume",
  "chapter",
  "name",
  "title",
  "slug",
  "pages",
  "pageCount",
  "publishedAt",
  "createdAt",
  "updatedAt",
  "translator",
  "team",
  "branch",
  "frames",
  "images",
];

async function probeFields(parent: string, wrapper: string, fields: string[]) {
  const results: Record<string, string> = {};
  for (const field of fields) {
    const selection = `${field} { __typename }`;
    const queryWithSub = wrapper.replace("__SELECTION__", selection);
    const resp = await gql(queryWithSub);
    if (resp.errors) {
      const msg = resp.errors.map((e) => e.message).join(" | ");
      if (/Unknown field/.test(msg)) {
        results[field] = "MISSING";
      } else if (/must not have a selection since type/.test(msg)) {
        results[field] = "scalar (" + (msg.match(/type "([^"]+)"/) ?? [])[1] + ")";
      } else if (/must have a selection/.test(msg)) {
        results[field] = "object — need selection";
      } else if (/You must provide a `first` or `last`/i.test(msg)) {
        results[field] = "connection (paginated)";
      } else {
        results[field] = msg.slice(0, 120);
      }
    } else {
      results[field] = "OK (null probably)";
    }
  }
  console.log(`\n--- Fields on ${parent} ---`);
  for (const [k, v] of Object.entries(results)) {
    if (v !== "MISSING") console.log(`  ${k}: ${v}`);
  }
  return results;
}

async function main() {
  const collected: Record<string, unknown> = {};

  // Manga fields
  collected["Manga"] = await probeFields(
    "Manga",
    `{ manga(slug: "x") { __SELECTION__ } }`,
    mangaCandidateFields,
  );

  // Branch fields
  collected["Branch"] = await probeFields(
    "Branch (inside manga.branches)",
    `{ manga(slug: "x") { branches { __SELECTION__ } } }`,
    branchCandidateFields,
  );

  // Title fields
  collected["Title"] = await probeFields(
    "Title (inside manga.titles)",
    `{ manga(slug: "x") { titles { __SELECTION__ } } }`,
    titleCandidateFields,
  );

  // Chapter fields — пробуем через branches.chapters
  collected["Chapter"] = await probeFields(
    "Chapter (inside branches.chapters)",
    `{ manga(slug: "x") { branches { chapters { __SELECTION__ } } } }`,
    chapterCandidateFields,
  );

  // MangaConnection → edges → node structure
  const nodeResp = await gql(`{ mangas(first: 1, search: "tower of god") { edges { node { __typename slug id } } } }`);
  console.log("\n--- mangas edges node probe:");
  console.log(JSON.stringify(nodeResp, null, 2).slice(0, 1000));
  collected["mangasEdgesNodeProbe"] = nodeResp;

  // PageInfo
  const pageInfoResp = await gql(`{ mangas(first: 1) { pageInfo { __typename } } }`);
  console.log("\n--- mangas pageInfo probe:");
  console.log(JSON.stringify(pageInfoResp, null, 2).slice(0, 400));

  await save("senkuro-probe-fields.json", collected);
  console.log("\nSaved → fixtures/senkuro-probe-fields.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
