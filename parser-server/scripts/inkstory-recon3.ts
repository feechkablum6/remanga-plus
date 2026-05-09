import fs from "node:fs/promises";
import path from "node:path";
import { HttpClient } from "../src/http/client.js";

const FIX = path.resolve(process.cwd(), "fixtures/inkstory");
const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });

const save = async (name: string, data: string | Buffer) => {
  await fs.mkdir(FIX, { recursive: true });
  await fs.writeFile(path.join(FIX, name), data);
};

const get = async (url: string, label: string): Promise<{ status: number; body: string }> => {
  try {
    const r = await client.request(url, {
      headers: {
        Accept: "text/html,application/json,*/*",
        Referer: "https://inkstory.net/",
      },
    });
    const body = await r.text();
    console.log(`  ${r.status} ${url}`);
    return { status: r.status, body };
  } catch (e) {
    console.log(`  FAIL ${url}: ${e instanceof Error ? e.message : e}`);
    return { status: 0, body: "" };
  }
};

async function main() {
  console.log("=== A. Chapter-page navigation: does chapter.html expose prev/next chapter? ===");
  const chapterHtml = await fs.readFile(path.join(FIX, "chapter.html"), "utf8");
  const navRefs = Array.from(chapterHtml.matchAll(/href="([^"]*\/content\/solo-leveling\/[^"]+)"/g)).map((m) => m[1]);
  console.log(`  distinct chapter hrefs in chapter page: ${new Set(navRefs).size}`);
  Array.from(new Set(navRefs)).slice(0, 15).forEach((h) => console.log(`    ${h}`));
  const navButtons = chapterHtml.match(/(?:Следующая|Предыдущая|Next|Prev|next-chapter|prev-chapter)[^<]{0,80}/gi)?.slice(0, 5);
  console.log(`  nav button hints:`, navButtons);

  // Any structured data like <a data-chapter-id="..." ... />
  const dataAttrs = Array.from(chapterHtml.matchAll(/data-(chapter|book|content|page)-[a-z0-9-]+="[^"]+"/gi)).slice(0, 10);
  console.log(`  data-* attrs (first 10):`, dataAttrs.map((m) => m[0].slice(0, 80)));

  console.log("\n=== B. Title page pagination probes ===");
  // Check common Astro pagination patterns
  for (const q of ["?page=2", "?offset=20", "?p=2", "?chapters_page=2", "/chapters", "/chapters/2"]) {
    const { status, body } = await get(`https://inkstory.net/content/solo-leveling${q}`, `pg-${q}`);
    if (status === 200) {
      const ch = Array.from(body.matchAll(/\/content\/solo-leveling\/[a-f0-9-]{36}/g)).length;
      console.log(`    chapter hrefs on this page: ${ch}`);
    }
  }

  console.log("\n=== C. Search for XHR endpoints in client scripts ===");
  // GlobalSearch.CqlmQeEn.js — this is the client-side search island. Fetch and grep.
  const scriptUrls = [
    "https://inkstory.net/_astro/GlobalSearch.CqlmQeEn.js",
    "https://inkstory.net/_astro/MainLayout.astro_astro_type_script_index_0_lang._Xhkj3Oy.js",
    "https://inkstory.net/_astro/ClientRouter.astro_astro_type_script_index_0_lang.Ddusn6Na.js",
  ];
  for (const url of scriptUrls) {
    const { body } = await get(url, "");
    // look for fetch(), XMLHttpRequest, axios, /api/, URL('https://...')
    const fetches = Array.from(body.matchAll(/fetch\(\s*[`"'][^`"']+[`"']/g)).slice(0, 10);
    const apiPaths = Array.from(body.matchAll(/["'`]\/api\/[a-z0-9/_.\-?={}$&]+["'`]/gi)).slice(0, 15);
    const apiAbs = Array.from(body.matchAll(/https?:\/\/[a-z0-9.-]+\/api\/[a-z0-9/_.\-?={}$&]*/gi)).slice(0, 10);
    const ioHosts = Array.from(body.matchAll(/https?:\/\/[a-z0-9.-]+\.inuko\.me[^"'`]*/gi)).slice(0, 10);
    console.log(`  ${url.split("/").pop()}:`);
    console.log(`    fetch(): ${fetches.length}, /api/ strings: ${apiPaths.length}, abs /api/: ${apiAbs.length}, inuko.me: ${ioHosts.length}`);
    fetches.forEach((f) => console.log(`      fetch: ${f[0].slice(0, 100)}`));
    apiPaths.forEach((f) => console.log(`      /api: ${f[0]}`));
    apiAbs.forEach((f) => console.log(`      abs: ${f[0].slice(0, 100)}`));
    ioHosts.forEach((f) => console.log(`      inuko: ${f[0].slice(0, 100)}`));
  }

  console.log("\n=== D. Look for search HTML endpoint forms with JSON accept ===");
  for (const url of [
    "https://inkstory.net/content?q=solo",
    "https://inkstory.net/content.json?q=solo",
    "https://inkstory.net/content?q=solo&format=json",
  ]) {
    const r = await client.request(url, { headers: { Accept: "application/json" } });
    const ct = r.headers.get("content-type");
    const body = await r.text();
    console.log(`  ${r.status} ct=${ct} len=${body.length} ${url}`);
    if (ct?.includes("json")) {
      await save(`json-resp-${url.replace(/[^a-z0-9]/gi, "_").slice(0, 60)}.json`, body);
    }
  }

  console.log("\n=== E. Title page structural blocks — find chapter list container ===");
  const titleHtml = await fs.readFile(path.join(FIX, "title.html"), "utf8");
  // Find a sample of the chapter list markup
  const firstChapterAnchor = titleHtml.match(/<a[^>]+href="[^"]*\/content\/solo-leveling\/[a-f0-9-]{36}"[^>]*>[\s\S]{0,500}/);
  if (firstChapterAnchor) {
    console.log("  first chapter anchor + 500 chars after:");
    console.log("  ", firstChapterAnchor[0].replace(/\s+/g, " ").slice(0, 800));
  }

  // Also check outer container
  const chaptersContainer = titleHtml.match(/<(section|div|ol|ul)[^>]*(?:id|class)="[^"]*(chapter|список)[^"]*"[\s\S]{0,300}/i);
  if (chaptersContainer) console.log("  container snippet:", chaptersContainer[0].slice(0, 400));
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
