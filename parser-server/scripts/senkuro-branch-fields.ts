import { HttpClient } from '../src/http/client.js';
const c = new HttpClient({ timeoutMs: 30_000 });
const g = async (q: string) => JSON.parse(await (await c.request('https://api.senkuro.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) })).text()) as any;

async function main() {
  const fields = ['updatedAt', 'createdAt', 'publishedAt', 'lastChapterAt', 'lastUpdate', 'lastUpdatedAt', 'latestChapter', 'latestChapterAt', 'name', 'title', 'slug', 'team'];
  for (const f of fields) {
    const r = await g(`{ manga(slug: "tower-of-god") { branches { ${f} } } }`);
    const msg = r.errors?.map((e: any) => e.message).join(' | ') ?? '';
    if (/Unknown field/.test(msg)) continue;
    console.log(`  branch.${f}: ${msg || JSON.stringify(r.data).slice(0, 160)}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
