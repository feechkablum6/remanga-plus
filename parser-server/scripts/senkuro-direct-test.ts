import { HttpClient } from "../src/http/client.js";
import { SenkuroProvider } from "../src/providers/senkuro.js";

async function main() {
  const provider = new SenkuroProvider(new HttpClient({ timeoutMs: 30_000 }));

  console.log("1. searchTitles('Tower of God')");
  const results = await provider.searchTitles("Tower of God");
  console.log(`   got ${results.length} results:`);
  results.forEach((r) => console.log(`   - ${r.slug} / ${r.titleName}`));

  if (results.length === 0) {
    console.log("   no results, stop");
    return;
  }

  const slug = results[0].slug;
  console.log(`\n2. getTitleDetails('${slug}')`);
  const details = await provider.getTitleDetails(slug);
  console.log(`   titleName: ${details.titleName}`);
  console.log(`   aliases (${details.aliases.length}):`, details.aliases.slice(0, 3));
  console.log(`   chapters count: ${details.chapters.length}`);
  if (details.chapters.length > 0) {
    console.log(`   first chapter: ${details.chapters[0].chapter}, vol ${details.chapters[0].volume}`);
    console.log(`   last chapter: ${details.chapters[details.chapters.length - 1].chapter}, vol ${details.chapters[details.chapters.length - 1].volume}`);
    const has650 = details.chapters.find((c) => c.chapter === "650");
    console.log(`   has chapter 650? ${!!has650}`, has650);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
