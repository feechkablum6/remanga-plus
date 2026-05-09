import fs from "node:fs/promises";
import path from "node:path";

const FIX = path.resolve(process.cwd(), "fixtures/inkstory");

const decodeEntities = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#38;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");

interface Island {
  component: string;
  propsRaw: string;
  propsDecoded: string;
  propsLen: number;
}

const extractIslands = (html: string): Island[] => {
  const islands: Island[] = [];
  const openRe = /<astro-island[^>]+>/g;
  for (const m of html.matchAll(openRe)) {
    const tag = m[0];
    const compMatch = tag.match(/component-url="([^"]+)"/);
    const propsMatch = tag.match(/props="([^"]*)"/);
    if (!propsMatch) continue;
    const propsRaw = propsMatch[1];
    const decoded = decodeEntities(propsRaw);
    islands.push({
      component: compMatch?.[1] ?? "?",
      propsRaw,
      propsDecoded: decoded,
      propsLen: decoded.length,
    });
  }
  return islands;
};

const tryJsonParse = (s: string): unknown | null => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

// Astro $$serialize format: [type, value] tuples. type=0 means "value", type=1 primitive.
// We'll walk and extract any long strings / slugs / UUIDs.
const flattenAstroValue = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    // Astro uses [type, value]
    if (node.length === 2 && typeof node[0] === "number") {
      return flattenAstroValue(node[1]);
    }
    return node.map(flattenAstroValue);
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = flattenAstroValue(v);
    }
    return out;
  }
  return node;
};

async function dumpIslands(htmlPath: string, outName: string) {
  console.log(`\n=== ${path.basename(htmlPath)} ===`);
  const html = await fs.readFile(htmlPath, "utf8");
  const islands = extractIslands(html);
  console.log(`  islands: ${islands.length}`);

  // sort by propsLen desc, top 5
  const ranked = [...islands].sort((a, b) => b.propsLen - a.propsLen);
  console.log(`  top 5 by props size:`);
  ranked.slice(0, 5).forEach((it, i) => {
    const comp = it.component.split("/").pop();
    console.log(`    #${i} ${comp} propsLen=${it.propsLen}`);
  });

  // Save top-3 decoded as JSON if they parse
  const savedSummaries: Array<{ component: string; parsedShape: unknown }> = [];
  for (let i = 0; i < Math.min(3, ranked.length); i += 1) {
    const it = ranked[i];
    const comp = it.component.split("/").pop()?.replace(/\.\w+\.js$/, "") ?? `island${i}`;
    const parsed = tryJsonParse(it.propsDecoded);
    if (parsed) {
      const flat = flattenAstroValue(parsed);
      const outPath = path.join(FIX, `${outName}-island-${i}-${comp}.json`);
      await fs.writeFile(outPath, JSON.stringify(flat, null, 2));
      console.log(`    saved ${path.basename(outPath)}`);
      // short summary
      if (typeof flat === "object" && flat !== null) {
        const keys = Object.keys(flat as Record<string, unknown>);
        console.log(`      top-level keys: [${keys.join(", ")}]`);
        savedSummaries.push({ component: comp, parsedShape: keys });
      }
    } else {
      console.log(`    #${i} JSON parse failed`);
      // save raw
      await fs.writeFile(path.join(FIX, `${outName}-island-${i}-raw.txt`), it.propsDecoded);
    }
  }

  return savedSummaries;
}

async function main() {
  await dumpIslands(path.join(FIX, "title.html"), "title");
  await dumpIslands(path.join(FIX, "chapter.html"), "chapter");

  console.log(`\n=== Look for chapter arrays in title island JSONs ===`);
  const entries = await fs.readdir(FIX);
  for (const f of entries) {
    if (!f.startsWith("title-island-") || !f.endsWith(".json")) continue;
    const body = await fs.readFile(path.join(FIX, f), "utf8");
    const occ = (body.match(/"chapter/g) ?? []).length;
    const chapCount = (body.match(/"chapterIndex":\s*\d+/g) ?? []).length;
    console.log(`  ${f}: len=${body.length} "chapter" occurrences=${occ} chapterIndex=${chapCount}`);
    if (occ > 0) {
      // find sample chapter object
      const sample = body.match(/\{[^{}]{0,80}chapterIndex[^{}]{0,200}\}/);
      if (sample) console.log(`    sample: ${sample[0].slice(0, 300)}`);
      const firstUuid = body.match(/"id":\s*"[a-f0-9-]{36}"/);
      if (firstUuid) console.log(`    first id: ${firstUuid[0]}`);
    }
  }

  console.log(`\n=== Same for chapter island JSONs ===`);
  for (const f of entries) {
    if (!f.startsWith("chapter-island-") || !f.endsWith(".json")) continue;
    const body = await fs.readFile(path.join(FIX, f), "utf8");
    console.log(`  ${f}: len=${body.length}`);
    const paidHits = (body.match(/"paid"|"locked"|"plusOnly"|"isPlus"|"premium"|"accessLevel"/gi) ?? []).slice(0, 5);
    console.log(`    paid-related keys: ${paidHits.length} — ${[...new Set(paidHits)].slice(0, 5)}`);
    const imgHits = (body.match(/static\.inuko\.me\/chapters\/[a-f0-9-]{36}\/[^"]+/g) ?? []).length;
    console.log(`    image URLs: ${imgHits}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
