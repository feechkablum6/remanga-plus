import fs from "node:fs/promises";
import path from "node:path";

const FIX = path.resolve(process.cwd(), "fixtures/inkstory");

const decodeEntities = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#38;/g, "&").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'");

const flatten = (node: unknown): unknown => {
  if (Array.isArray(node)) {
    if (node.length === 2 && typeof node[0] === "number") return flatten(node[1]);
    return node.map(flatten);
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) out[k] = flatten(v);
    return out;
  }
  return node;
};

async function main() {
  const html = await fs.readFile("/tmp/ink-tab-chapters.html", "utf8");
  await fs.mkdir(FIX, { recursive: true });
  await fs.writeFile(path.join(FIX, "title-chapters-tab.html"), html);

  // Find astro-island for BookVirtualizedChapterList
  const m = html.match(
    /<astro-island[^>]*component-url="\/_astro\/BookVirtualizedChapterList[^"]+"[^>]*>/,
  );
  if (!m) {
    console.log("BookVirtualizedChapterList island not found");
    return;
  }
  console.log("island tag:", m[0].slice(0, 300));

  const propsMatch = m[0].match(/props="([^"]*)"/);
  if (!propsMatch) {
    console.log("no props attr");
    return;
  }
  const decoded = decodeEntities(propsMatch[1]);
  console.log(`props len: ${decoded.length}`);
  await fs.writeFile(path.join(FIX, "virtualized-chapter-list-raw.txt"), decoded);

  let parsed;
  try {
    parsed = JSON.parse(decoded);
  } catch (e) {
    console.log("JSON parse fail:", e instanceof Error ? e.message : e);
    return;
  }
  const flat = flatten(parsed);
  await fs.writeFile(
    path.join(FIX, "virtualized-chapter-list.json"),
    JSON.stringify(flat, null, 2),
  );
  console.log("saved virtualized-chapter-list.json");
  if (flat && typeof flat === "object") {
    const keys = Object.keys(flat as Record<string, unknown>);
    console.log(`top keys:`, keys);
    for (const k of keys) {
      const v = (flat as Record<string, unknown>)[k];
      if (Array.isArray(v)) console.log(`  ${k}: Array len=${v.length}`);
      else if (typeof v === "object" && v !== null) console.log(`  ${k}: object keys=${Object.keys(v as Record<string, unknown>)}`);
      else console.log(`  ${k}: ${typeof v} = ${String(v).slice(0, 120)}`);
    }
  }

  // Dig into chapters array if exists
  const obj = flat as Record<string, any>;
  const chaptersArr = obj.chapters ?? obj.items ?? obj.list ?? obj.data ?? null;
  if (Array.isArray(chaptersArr)) {
    console.log(`\nchapters-like array len=${chaptersArr.length}`);
    console.log("sample [0]:", JSON.stringify(chaptersArr[0], null, 2).slice(0, 600));
    console.log("sample [last]:", JSON.stringify(chaptersArr[chaptersArr.length - 1], null, 2).slice(0, 600));
    const paidKeys = chaptersArr[0] ? Object.keys(chaptersArr[0]).filter((k) => /paid|lock|plus|premium|access|free/i.test(k)) : [];
    console.log("paid-related keys on chapter:", paidKeys);
  }

  // Also look for "authorizationRequired" or "plus" directly
  const authHits = Array.from(decoded.matchAll(/"(authorizationRequired|plusOnly|isPlusOnly|premium|locked|accessLevel|paid)":[^,}]{0,60}/g)).slice(0, 10);
  console.log("auth-like keys found in raw:", authHits.map((h) => h[0]));
}

main().catch((e) => { console.error(e); process.exit(1); });
