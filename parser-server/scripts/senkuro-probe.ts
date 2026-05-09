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
    return { status: response.status, json: JSON.parse(text) as unknown };
  } catch {
    return { status: response.status, raw: text.slice(0, 500) };
  }
};

const save = async (name: string, data: unknown) => {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURES_DIR, name), JSON.stringify(data, null, 2), "utf8");
};

const probes: Array<[string, string, unknown?]> = [
  // 1. Field existence / error messages — mapping fields
  ["err-field-foo", "{ foo }"],
  ["err-manga-no-args", "{ manga { __typename } }"],
  ["err-mangas-fields", "{ mangas { __typename } }"],
  ["err-manga-id-field", "{ manga(slug: \"x\") { id } }"],
  ["err-manga-typename", "{ manga(slug: \"x\") { __typename } }"],

  // 2. MangaConnection structure
  ["err-mangas-edges", "{ mangas { edges { __typename } } }"],
  ["err-mangas-nodes", "{ mangas { nodes { __typename } } }"],
  ["err-mangas-pageInfo", "{ mangas { pageInfo { __typename } } }"],

  // 3. Search argument discovery
  ["err-mangas-search-arg", "{ mangas(search: \"tower\") { __typename } }"],
  ["err-mangas-query-arg", "{ mangas(query: \"tower\") { __typename } }"],
  ["err-mangas-title-arg", "{ mangas(title: \"tower\") { __typename } }"],

  // 4. Chapter discovery
  ["err-chapters-field", "{ chapters { __typename } }"],
  ["err-chapterPages-field", "{ chapterPages { __typename } }"],
  ["err-chapter-manga", "{ manga(slug: \"x\") { chapters { __typename } } }"],
  ["err-chapter-branches", "{ manga(slug: \"x\") { branches { __typename } } }"],

  // 5. Alt names
  ["err-manga-altNames", "{ manga(slug: \"x\") { altNames { __typename } } }"],
  ["err-manga-titles", "{ manga(slug: \"x\") { titles { __typename } } }"],
  ["err-manga-names", "{ manga(slug: \"x\") { names { __typename } } }"],

  // 6. Types to explore via __type
  ["err-Manga-type", "{ __type(name: \"Manga\") { name fields { name } } }"],
  ["err-MangaConnection-type", "{ __type(name: \"MangaConnection\") { name fields { name } } }"],
  ["err-Chapter-type", "{ __type(name: \"Chapter\") { name fields { name } } }"],
  ["err-Query-type", "{ __type(name: \"Query\") { name fields { name args { name } } } }"],
];

async function main() {
  const collected: Record<string, unknown> = {};
  for (const [label, q, vars] of probes) {
    process.stdout.write(`${label}: `);
    try {
      const res = await gql(q, vars);
      collected[label] = { query: q, ...res };
      const body = (res as { json?: { errors?: Array<{ message: string }>; data?: unknown } }).json;
      if (body?.errors) {
        console.log(body.errors.map((e) => e.message).join(" | "));
      } else {
        console.log("ok:", JSON.stringify(body?.data).slice(0, 260));
      }
    } catch (error) {
      console.log("FAIL", error instanceof Error ? error.message : error);
      collected[label] = { query: q, error: String(error) };
    }
  }
  await save("senkuro-probe-raw.json", collected);
  console.log("\nSaved probes → fixtures/senkuro-probe-raw.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
