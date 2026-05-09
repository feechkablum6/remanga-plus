import { HttpClient } from "../src/http/client.js";

const ENDPOINT = "https://api.senkuro.com/graphql";
const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });

const gql = async (q: string) => {
  const r = await client.request(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: q }),
  });
  return JSON.parse(await r.text()) as { data?: any; errors?: Array<{ message: string }> };
};

async function main() {
  // Ищем популярные тайтлы и смотрим branches
  const queries = ["solo leveling", "naruto", "one piece", "attack on titan", "berserk", "bleach"];
  for (const q of queries) {
    const r = await gql(
      `{ mangas(first: 1, search: "${q}") { edges { node { slug branches { id lang chapters } } } } }`,
    );
    const node = r.data?.mangas?.edges?.[0]?.node;
    if (!node) continue;
    console.log(`${q} → slug=${node.slug} branches:`, JSON.stringify(node.branches));
    if ((node.branches?.length ?? 0) > 1) {
      console.log("  → found multi-branch candidate");

      // Для каждой ветки берём первую главу и смотрим её slug + number
      for (const branch of node.branches as Array<{ id: string; lang: string; chapters: number }>) {
        if (branch.chapters === 0) continue;
        const chaps = await gql(
          `{ mangaChapters(branchId: "${branch.id}", first: 3) { edges { node { id slug number volume branchId } } } }`,
        );
        console.log(`    branch ${branch.lang}:`, JSON.stringify(chaps.data?.mangaChapters?.edges));
      }

      // Проверяем что mangaChapter(slug:) возвращает правильный branch
      const firstBranch = (node.branches as Array<{ id: string; lang: string; chapters: number }>).find((b) => b.chapters > 0);
      if (firstBranch) {
        const c = await gql(
          `{ mangaChapters(branchId: "${firstBranch.id}", first: 1) { edges { node { slug } } } }`,
        );
        const chapSlug = c.data?.mangaChapters?.edges?.[0]?.node?.slug;
        if (chapSlug) {
          const mc = await gql(
            `{ mangaChapter(slug: "${chapSlug}") { slug number branchId branch { lang } } }`,
          );
          console.log(`    mangaChapter(${chapSlug}) →`, JSON.stringify(mc.data?.mangaChapter));
        }
      }
      break;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
