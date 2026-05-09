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

const fetchText = async (url: string, label: string): Promise<string> => {
  const r = await client.request(url, {
    headers: { Accept: "text/html,application/xhtml+xml,*/*" },
  });
  console.log(`${label}: HTTP ${r.status} ${url}`);
  if (!r.ok) {
    const body = await r.text();
    console.log(`  body preview: ${body.slice(0, 200)}`);
    throw new Error(`${label} returned ${r.status}`);
  }
  return r.text();
};

const extractNextData = (html: string): unknown | null => {
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    console.log("  __NEXT_DATA__ parse fail:", e instanceof Error ? e.message : e);
    return null;
  }
};

const listScripts = (html: string): string[] => {
  const srcs: string[] = [];
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) srcs.push(m[1]);
  return srcs;
};

const listLinks = (html: string): string[] => {
  const hrefs: string[] = [];
  for (const m of html.matchAll(/<link[^>]+href="([^"]+)"/g)) hrefs.push(m[1]);
  return hrefs;
};

const findApiLikeStrings = (html: string): string[] => {
  const hits = new Set<string>();
  const patterns = [
    /\/_next\/data\/[^"'\s<>]+/g,
    /\/api\/trpc\/[^"'\s<>]+/g,
    /\/api\/(?!trpc)[a-z0-9/\-_.?&=]+/gi,
    /\/graphql[^"'\s<>]*/g,
    /https?:\/\/[a-z0-9.-]+\/api\/[^"'\s<>]+/gi,
  ];
  for (const re of patterns) for (const m of html.matchAll(re)) hits.add(m[0]);
  return Array.from(hits);
};

async function main() {
  console.log("=== 1. Homepage ===");
  const home = await fetchText("https://inkstory.net/", "home");
  await save("homepage.html", home);
  const homeScripts = listScripts(home).slice(0, 20);
  const homeLinks = listLinks(home).slice(0, 15);
  console.log(`  scripts (${homeScripts.length}):`);
  homeScripts.forEach((s) => console.log(`    ${s}`));
  console.log(`  links:`);
  homeLinks.forEach((s) => console.log(`    ${s}`));
  const homeApi = findApiLikeStrings(home);
  console.log(`  API-ish URLs found (${homeApi.length}):`);
  homeApi.slice(0, 15).forEach((s) => console.log(`    ${s}`));
  const homeNext = extractNextData(home);
  console.log(`  __NEXT_DATA__: ${homeNext ? "YES" : "no"}`);

  console.log("\n=== 2. Title page: solo-leveling ===");
  const titleUrl = "https://inkstory.net/content/solo-leveling";
  let title: string;
  try {
    title = await fetchText(titleUrl, "title");
    await save("title.html", title);
  } catch (e) {
    console.log(`  can't fetch: ${e instanceof Error ? e.message : e}`);
    return;
  }

  const titleScripts = listScripts(title);
  console.log(`  scripts (${titleScripts.length}), first 10:`);
  titleScripts.slice(0, 10).forEach((s) => console.log(`    ${s}`));
  const titleApi = findApiLikeStrings(title);
  console.log(`  API-ish URLs (${titleApi.length}):`);
  titleApi.slice(0, 20).forEach((s) => console.log(`    ${s}`));
  const titleNext = extractNextData(title);
  if (titleNext) {
    await save("title-next-data.json", JSON.stringify(titleNext, null, 2));
    console.log(`  __NEXT_DATA__: YES, saved`);
    // Try to identify title props shape
    const props = (titleNext as { props?: unknown }).props;
    if (props) {
      const pageProps = (props as { pageProps?: unknown }).pageProps;
      if (pageProps && typeof pageProps === "object") {
        const keys = Object.keys(pageProps as Record<string, unknown>);
        console.log(`  pageProps keys:`, keys);
      }
    }
    const buildId = (titleNext as { buildId?: string }).buildId;
    if (buildId) console.log(`  buildId: ${buildId}`);
  } else {
    console.log(`  __NEXT_DATA__: NO`);
  }

  console.log("\n=== 3. Try _next/data endpoint for title ===");
  if (titleNext) {
    const buildId = (titleNext as { buildId?: string }).buildId;
    if (buildId) {
      const nextDataUrl = `https://inkstory.net/_next/data/${buildId}/content/solo-leveling.json`;
      try {
        const json = await fetchText(nextDataUrl, "nextdata-title");
        await save("title-nextdata.json", json);
      } catch (e) {
        console.log(`  failed: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  console.log("\n=== 4. Locate a chapter URL on the title page ===");
  const chapterLinks = Array.from(title.matchAll(/href="([^"]*\/content\/solo-leveling\/[^"]+)"/g))
    .map((m) => m[1])
    .filter((h) => h.length < 200);
  const uniqueChapters = Array.from(new Set(chapterLinks));
  console.log(`  found chapter-like links (${uniqueChapters.length}), first 5:`);
  uniqueChapters.slice(0, 5).forEach((l) => console.log(`    ${l}`));

  const firstChapterHref = uniqueChapters[uniqueChapters.length - 1] ?? uniqueChapters[0];
  if (firstChapterHref) {
    const chUrl = firstChapterHref.startsWith("http")
      ? firstChapterHref
      : `https://inkstory.net${firstChapterHref}`;
    console.log(`\n  fetching chapter: ${chUrl}`);
    try {
      const ch = await fetchText(chUrl, "chapter");
      await save("chapter.html", ch);
      const chApi = findApiLikeStrings(ch);
      console.log(`  chapter API-ish URLs (${chApi.length}):`);
      chApi.slice(0, 15).forEach((s) => console.log(`    ${s}`));
      const chNext = extractNextData(ch);
      if (chNext) {
        await save("chapter-next-data.json", JSON.stringify(chNext, null, 2));
        console.log(`  chapter __NEXT_DATA__: saved`);
      }
      // Find image URLs (gstatic.inuko.me, static.inuko.me, cdn.inuko.me etc.)
      const imgPatterns = [/https?:\/\/[a-z0-9.-]*inuko\.me\/[^"'\s<>]+/gi, /https?:\/\/[a-z0-9.-]+\/book\/[^"'\s<>]+\.(?:jpe?g|png|webp)/gi];
      const images = new Set<string>();
      for (const re of imgPatterns) for (const m of ch.matchAll(re)) images.add(m[0]);
      console.log(`  image URLs in chapter HTML: ${images.size}`);
      Array.from(images).slice(0, 5).forEach((s) => console.log(`    ${s}`));
      await save("chapter-images.txt", Array.from(images).join("\n"));
    } catch (e) {
      console.log(`  chapter fetch failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log("\n=== 5. Search probe ===");
  const searchCandidates = [
    "https://inkstory.net/search?q=solo+leveling",
    "https://inkstory.net/content?search=solo+leveling",
    "https://inkstory.net/content?q=solo+leveling",
    "https://inkstory.net/api/search?q=solo+leveling",
    "https://inkstory.net/api/content/search?q=solo+leveling",
    "https://inkstory.net/api/trpc/content.search?input=%7B%22query%22%3A%22solo%20leveling%22%7D",
  ];
  for (const url of searchCandidates) {
    try {
      const r = await client.request(url, { headers: { Accept: "application/json,text/html,*/*" } });
      console.log(`  ${r.status} ${url}`);
      if (r.status === 200) {
        const body = await r.text();
        const preview = body.slice(0, 180).replace(/\s+/g, " ");
        console.log(`    preview: ${preview}`);
      }
    } catch (e) {
      console.log(`  fail ${url}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log("\n=== 6. Image fetch: Referer required? ===");
  // grab first image URL if found
  const imageProbeHtml = await fs.readFile(path.join(FIX, "chapter.html"), "utf8").catch(() => "");
  const firstImg = imageProbeHtml.match(/https?:\/\/[a-z0-9.-]*inuko\.me\/[^"'\s<>]+\.(?:jpe?g|png|webp)/i)?.[0];
  if (firstImg) {
    console.log(`  testing: ${firstImg}`);
    for (const refer of [null, "https://inkstory.net/"]) {
      const headers: Record<string, string> = {};
      if (refer) headers.Referer = refer;
      try {
        const r = await client.request(firstImg, { method: "GET", headers });
        console.log(`    Referer=${refer ?? "none"}: HTTP ${r.status} type=${r.headers.get("content-type")} size=${r.headers.get("content-length")}`);
      } catch (e) {
        console.log(`    Referer=${refer ?? "none"}: FAIL ${e instanceof Error ? e.message : e}`);
      }
    }
  } else {
    console.log("  no image URL found in chapter HTML to probe");
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
