import fs from "node:fs/promises";
import path from "node:path";
import { HttpClient } from "../src/http/client.js";

const FIX = path.resolve(process.cwd(), "fixtures/inkstory");
const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });

const save = async (name: string, data: string | Buffer) => {
  await fs.mkdir(FIX, { recursive: true });
  await fs.writeFile(path.join(FIX, name), data);
};

const probe = async (url: string, label: string): Promise<number> => {
  try {
    const r = await client.request(url, {
      headers: { Accept: "application/json,text/html,*/*" },
    });
    const body = await r.text();
    console.log(`  ${r.status} ${url}`);
    if (r.status === 200 && body.length > 0) {
      const preview = body.slice(0, 250).replace(/\s+/g, " ");
      console.log(`    → ${preview}`);
      await save(`probe-${label}.txt`, body);
    }
    return r.status;
  } catch (e) {
    console.log(`  FAIL ${url}: ${e instanceof Error ? e.message : e}`);
    return 0;
  }
};

async function main() {
  const titleHtml = await fs.readFile(path.join(FIX, "title.html"), "utf8");

  console.log("=== A. Plus / paid-chapter markers in title.html ===");
  const plusHits = [
    { label: "lock icon (svg)", re: /<svg[^>]*(lock|Lock)/g },
    { label: "class 'locked' or 'premium'", re: /class="[^"]*(locked|premium|plus)[^"]*"/gi },
    { label: "word 'Подписка' or 'Plus'", re: /Подписк[аое]|\bPlus\b|Премиум/g },
    { label: "word 'только Plus' / 'только подписчикам'", re: /только[^<]{0,40}(Plus|подписчикам|премиум)/gi },
    { label: "data-plus / data-paid attr", re: /data-(plus|paid|locked)="[^"]*"/g },
    { label: "'Открыть' button label", re: /Открыть[^<]{0,20}/g },
  ];
  for (const { label, re } of plusHits) {
    const matches = Array.from(titleHtml.matchAll(re)).slice(0, 5);
    console.log(`  ${label}: ${matches.length}${matches.length ? " — " + matches.map((m) => m[0].slice(0, 80)).join(" | ") : ""}`);
  }

  console.log("\n=== B. Chapter list section — look for pagination ===");
  const chapterSection = titleHtml.match(/<[^>]*class="[^"]*chapter[^"]*"[\s\S]{0,8000}/i);
  if (chapterSection) {
    console.log("  sample chapter block (first 500 chars):");
    console.log("  ", chapterSection[0].slice(0, 500).replace(/\s+/g, " "));
  }
  // Count total chapter links vs shown. Look for "Показать все" or "next page" hints
  const chapterCount = Array.from(titleHtml.matchAll(/\/content\/solo-leveling\/[a-f0-9-]{36}/g)).length;
  console.log(`  total chapter-like hrefs in page: ${chapterCount}`);
  const showMore = titleHtml.match(/(?:Показать|Load|More|Следующ)[^<]{0,40}/g)?.slice(0, 3);
  console.log(`  "Load more" hints:`, showMore);

  console.log("\n=== C. inuko.me API discovery ===");
  const candidates = [
    "https://api.inuko.me/",
    "https://inuko.me/api/",
    "https://api.inuko.me/content",
    "https://api.inuko.me/content/solo-leveling",
    "https://api.inuko.me/content/solo-leveling/chapters",
    "https://api.inuko.me/v1/content",
    "https://api.inuko.me/graphql",
    "https://inuko.me/",
    "https://api.inkstory.net/",
    "https://inkstory.net/api/content",
    "https://inkstory.net/api/content/solo-leveling",
    "https://inkstory.net/api/content/solo-leveling/chapters",
  ];
  for (const url of candidates) {
    const lbl = url.replace(/[^a-z0-9]/gi, "_").slice(0, 60);
    await probe(url, lbl);
  }

  console.log("\n=== D. Intercept Astro islands: inspect what data is embedded ===");
  // Astro embeds islands as <astro-island> tags with props
  const islandMatches = Array.from(titleHtml.matchAll(/<astro-island[^>]+>/g));
  console.log(`  astro-island tags: ${islandMatches.length}`);
  islandMatches.slice(0, 5).forEach((m) => {
    const tag = m[0];
    const comp = tag.match(/component-url="([^"]+)"/)?.[1];
    const propsEnc = tag.match(/props="([^"]+)"/)?.[1];
    console.log(`    component=${comp}`);
    if (propsEnc && propsEnc.length < 300) {
      console.log(`    props=${propsEnc}`);
    } else if (propsEnc) {
      console.log(`    props (len=${propsEnc.length}) preview=${propsEnc.slice(0, 200)}`);
    }
  });

  // Save decoded props of first island with substantial props
  if (islandMatches.length > 0) {
    const firstWithProps = islandMatches.find((m) => /props="[^"]{500,}"/.test(m[0]));
    if (firstWithProps) {
      const propsEnc = firstWithProps[0].match(/props="([^"]+)"/)?.[1];
      if (propsEnc) {
        const decoded = propsEnc
          .replace(/&quot;/g, '"')
          .replace(/&#38;/g, "&")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#39;/g, "'");
        await save("astro-island-props.json", decoded);
        console.log(`  saved decoded island props (${decoded.length} chars)`);
      }
    }
  }

  console.log("\n=== E. search page HTML — does it return content or a placeholder? ===");
  // content?q=solo+leveling returned 200 html; check whether it actually has results
  const searchHtml = await client
    .request("https://inkstory.net/content?q=solo+leveling", {
      headers: { Accept: "text/html" },
    })
    .then((r) => r.text());
  await save("search-solo-leveling.html", searchHtml);
  const searchResults = Array.from(searchHtml.matchAll(/\/content\/([a-z0-9-]+)"/g));
  const uniqueSlugs = new Set(searchResults.map((m) => m[1]));
  console.log(`  search HTML length: ${searchHtml.length}, unique content slugs: ${uniqueSlugs.size}`);
  Array.from(uniqueSlugs).slice(0, 10).forEach((s) => console.log(`    ${s}`));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
