import { HttpClient } from "../src/http/client.js";

const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });
const gql = async (q: string) => {
  const r = await client.request("https://api.senkuro.com/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
  return JSON.parse(await r.text()) as { data?: any };
};

async function main() {
  const r = await gql(
    `{ mangas(first: 100) { edges { node { slug branches { id lang chapters } } } } }`,
  );
  const edges = (r.data?.mangas?.edges ?? []) as Array<{
    node: { slug: string; branches: Array<{ id: string; lang: string; chapters: number }> };
  }>;
  console.log(`scanned ${edges.length} mangas`);
  const multi = edges.filter((e) => (e.node.branches?.length ?? 0) > 1);
  console.log(`multi-branch: ${multi.length}`);
  for (const e of multi.slice(0, 5)) {
    console.log(`  ${e.node.slug}:`, JSON.stringify(e.node.branches));
  }

  if (multi.length === 0) {
    console.log(
      "No multi-branch found in first 100 — Senkuro appears single-branch per title. Skipping chapter-uniqueness probe.",
    );
    return;
  }

  // Take first multi-branch manga, get chapters from both branches, compare slugs
  const target = multi[0];
  console.log(`\nProbing chapter.slug uniqueness for ${target.node.slug}`);
  for (const branch of target.node.branches) {
    if (branch.chapters === 0) continue;
    const cr = await gql(
      `{ mangaChapters(branchId: "${branch.id}", first: 3) { edges { node { id slug number branchId } } } }`,
    );
    console.log(
      `  branch ${branch.lang} (${branch.chapters} ch):`,
      JSON.stringify(cr.data?.mangaChapters?.edges),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
