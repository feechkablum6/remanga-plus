import fs from "node:fs/promises";
import path from "node:path";
import { HttpClient } from "../src/http/client.js";

const ENDPOINT = "https://api.senkuro.com/graphql";
const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures");

const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });

const gql = async (q: string) => {
  const r = await client.request(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: q }),
  });
  return JSON.parse(await r.text()) as { data?: any; errors?: Array<{ message: string }> };
};

const save = async (name: string, data: unknown) => {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURES_DIR, name), JSON.stringify(data, null, 2), "utf8");
};

const probe = async (label: string, q: string) => {
  const r = await gql(q);
  const msg = r.errors?.map((e) => e.message).join(" | ") ?? "";
  if (msg) console.log(`${label}: ERR ${msg.slice(0, 200)}`);
  else console.log(`${label}: OK ${JSON.stringify(r.data).slice(0, 400)}`);
  return r;
};

async function main() {
  const BRANCH_ID = "TUFOR0FfQlJBTkNIOjUxODE1ODA1NDA2NTAzMzA2";

  console.log("=== MangaChapterPage fields ===");
  const pageFields = [
    "id", "number", "url", "src", "image", "width", "height",
    "original", "preview", "thumbnail", "aspectRatio",
  ];
  for (const f of pageFields) {
    await probe(`Page.${f}`, `{ mangaChapters(branchId: "${BRANCH_ID}", first: 1) { edges { node { pages { ${f} } } } } }`);
  }

  console.log("\n=== Check cover.original shape ===");
  await probe("cover.original.url", `{ manga(slug: "tower-of-god") { cover { original { url } } } }`);
  await probe("cover.original.width", `{ manga(slug: "tower-of-god") { cover { original { width height } } } }`);

  console.log("\n=== mangaChapter(slug:...) signature ===");
  // Сначала получим реальный id и slug главы
  const chaps = await gql(
    `{ mangaChapters(branchId: "${BRANCH_ID}", first: 1) { edges { node { id slug number name } } } }`,
  );
  console.log("chapters sample:", JSON.stringify(chaps, null, 2).slice(0, 600));
  await save("senkuro-chapters.json", chaps);

  const firstChap = chaps.data?.mangaChapters?.edges?.[0]?.node as
    | { id: string; slug?: string; number: string; name: string }
    | undefined;

  if (firstChap) {
    console.log("\nchapter id:", firstChap.id, "slug:", firstChap.slug);

    // Попробуем mangaChapter(slug: id)
    await probe("mangaChapter(by id)", `{ mangaChapter(slug: "${firstChap.id}") { id slug number } }`);
    if (firstChap.slug) {
      await probe(
        "mangaChapter(by slug)",
        `{ mangaChapter(slug: "${firstChap.slug}") { id slug number } }`,
      );
    }

    // И попробуем mangaChapter(id: ...)
    await probe("mangaChapter(id: ...)", `{ mangaChapter(id: "${firstChap.id}") { __typename } }`);
  }

  console.log("\n=== Fetch real chapter with pages to build fixture ===");
  // возьмём последнюю (первую в порядке выдачи) главу — скорее всего 1-я.
  // Лучше взять первую доступную, без пагинации по концу.
  if (firstChap) {
    const chapSlug = firstChap.slug ?? firstChap.id;
    const full = await gql(
      `{ mangaChapter(slug: "${chapSlug}") { id slug number volume name pages { url } branch { id lang } } }`,
    );
    console.log("full chapter:", JSON.stringify(full, null, 2).slice(0, 1600));
    await save("senkuro-chapter.json", full);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
