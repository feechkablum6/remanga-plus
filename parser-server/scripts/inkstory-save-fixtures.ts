import fs from "node:fs/promises";
import path from "node:path";
import { HttpClient } from "../src/http/client.js";

const FIX = path.resolve(process.cwd(), "fixtures/inkstory");
const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });

const save = async (name: string, data: string | Buffer) => {
  await fs.mkdir(FIX, { recursive: true });
  await fs.writeFile(path.join(FIX, name), data);
  console.log(`  → fixtures/inkstory/${name} (${typeof data === "string" ? data.length : data.byteLength} bytes)`);
};

const get = async (url: string) => {
  const r = await client.request(url, { headers: { Accept: "application/json" } });
  return { status: r.status, body: await r.text(), headers: r.headers };
};

async function main() {
  const BOOK = "4fe5dc17-e2d0-417c-8224-034a7c6bdb44";
  const BRANCH = "d71550c4-be1a-4d4c-b99a-51aa8e32e704";
  const CHAP = "552f7cd3-3f6e-4b28-966e-e6317bc75da8";

  console.log("=== 1. Search ===");
  const search = await get(`https://api.inkstory.net/v2/books?search=solo+leveling`);
  await save("api-search.json", search.body);
  const searchJson = JSON.parse(search.body) as Array<{ slug: string; titles?: unknown[]; type?: string }>;
  console.log(`  results: ${searchJson.length}, first 3 slugs:`);
  searchJson.slice(0, 3).forEach((r) => console.log(`    ${r.slug} (${r.type})`));

  console.log("\n=== 2. Book by slug ===");
  const book = await get(`https://api.inkstory.net/v2/books/solo-leveling`);
  await save("api-book.json", book.body);
  const bookJson = JSON.parse(book.body) as Record<string, unknown>;
  console.log(`  keys:`, Object.keys(bookJson));
  const bookTitles = bookJson.titles as Array<{ language: string; name: string }> | undefined;
  console.log(`  titles:`, bookTitles);

  console.log("\n=== 3. Branches ===");
  const branches = await get(`https://api.inkstory.net/v2/branches?book=solo-leveling`);
  await save("api-branches.json", branches.body);
  const branchesJson = JSON.parse(branches.body) as Array<{
    id: string;
    moderationStatus?: string;
    publishers?: Array<{ kind: string; slug: string; name: string }>;
    chaptersCount?: number;
    language?: string;
  }>;
  console.log(`  branches: ${branchesJson.length}`);
  branchesJson.forEach((b) =>
    console.log(`    ${b.id} lang=${b.language} chapters=${b.chaptersCount} publishers=${b.publishers?.map((p) => p.slug).join(",")}`),
  );

  console.log("\n=== 4. Chapters by bookId ===");
  const chapters = await get(`https://api.inkstory.net/v2/chapters?bookId=${BOOK}`);
  await save("api-chapters.json", chapters.body);
  const chaptersJson = JSON.parse(chapters.body) as Array<{
    id: string;
    number: number;
    volume: number | null;
    branchId: string;
    donut?: boolean;
    corrupted?: boolean;
    moderationStatus?: string;
  }>;
  console.log(`  chapters total: ${chaptersJson.length}`);
  const byBranch = new Map<string, number>();
  let donutCount = 0;
  let corruptedCount = 0;
  for (const c of chaptersJson) {
    byBranch.set(c.branchId, (byBranch.get(c.branchId) ?? 0) + 1);
    if (c.donut) donutCount += 1;
    if (c.corrupted) corruptedCount += 1;
  }
  console.log(`  by branch:`, Array.from(byBranch.entries()));
  console.log(`  donut=true: ${donutCount}, corrupted=true: ${corruptedCount}`);
  console.log(`  first chapter keys:`, Object.keys(chaptersJson[0]));
  console.log(`  first chapter:`, JSON.stringify(chaptersJson[0], null, 2).slice(0, 600));

  console.log("\n=== 5. Chapter pages ===");
  const chap = await get(`https://api.inkstory.net/v2/chapters/${CHAP}`);
  await save("api-chapter.json", chap.body);
  const chapJson = JSON.parse(chap.body) as {
    id: string;
    name: string;
    number: number;
    volume: number;
    pages: Array<{ id: string; image: string; index: number; height: number; width: number }>;
    donut?: boolean;
  };
  console.log(`  chapter: ${chapJson.number} (vol ${chapJson.volume})`);
  console.log(`  pages: ${chapJson.pages.length}, first image: ${chapJson.pages[0].image.slice(0, 120)}`);
  console.log(`  donut: ${chapJson.donut}`);

  console.log("\n=== 6. Branch ===");
  const branch = await get(`https://api.inkstory.net/v2/branches/${BRANCH}`);
  await save("api-branch.json", branch.body);

  console.log("\n=== 7. Look for a paid (donut) chapter ===");
  const donutChap = chaptersJson.find((c) => c.donut);
  if (donutChap) {
    const paid = await get(`https://api.inkstory.net/v2/chapters/${donutChap.id}`);
    await save("api-chapter-donut.json", paid.body);
    console.log(`  donut chapter HTTP ${paid.status}, body size: ${paid.body.length}`);
    const paidJson = JSON.parse(paid.body);
    const pagesLen = Array.isArray(paidJson.pages) ? paidJson.pages.length : "n/a";
    console.log(`  pages count in donut chapter: ${pagesLen}`);
    if (paidJson.pages && paidJson.pages.length === 0) {
      console.log(`    → donut chapter has no accessible pages (paid wall)`);
    }
    console.log(`  keys:`, Object.keys(paidJson));
  } else {
    console.log("  no donut chapter in solo-leveling — look in another title");
  }

  console.log("\n=== 8. Try a different manga for donut example ===");
  // Search for any book that might have donut chapters. Try popular ongoing.
  const altSearch = await get(`https://api.inkstory.net/v2/books?search=oshi+no+ko`);
  const altJson = JSON.parse(altSearch.body) as Array<{ slug: string }>;
  if (altJson.length) {
    const altSlug = altJson[0].slug;
    const altBook = await get(`https://api.inkstory.net/v2/books/${altSlug}`);
    const altBookJson = JSON.parse(altBook.body) as { id: string };
    const altChaps = await get(`https://api.inkstory.net/v2/chapters?bookId=${altBookJson.id}`);
    const altChapsJson = JSON.parse(altChaps.body) as Array<{ id: string; number: number; donut?: boolean }>;
    const altDonuts = altChapsJson.filter((c) => c.donut);
    console.log(`  ${altSlug}: ${altChapsJson.length} chapters, ${altDonuts.length} donut`);
    if (altDonuts.length) {
      const sample = altDonuts[0];
      const sampleFetch = await get(`https://api.inkstory.net/v2/chapters/${sample.id}`);
      await save(`api-chapter-${altSlug}-donut.json`, sampleFetch.body);
      const sf = JSON.parse(sampleFetch.body);
      console.log(`    donut sample #${sample.number}: HTTP ${sampleFetch.status}, pages=${sf.pages?.length ?? "n/a"}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
