import fs from "node:fs/promises";
import path from "node:path";
import { HttpClient } from "../src/http/client.js";

const ENDPOINT = "https://api.senkuro.com/graphql";
const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures");

const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });

const gql = async (q: string) => {
  const r = await client.request(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: q }),
  });
  return JSON.parse(await r.text()) as { data?: any; errors?: Array<{ message: string }> };
};

const save = async (name: string, data: unknown) => {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURES_DIR, name), JSON.stringify(data, null, 2), "utf8");
};

async function main() {
  console.log("=== Final fixtures for SenkuroProvider tests ===\n");

  // 1. Search fixture (full query)
  const searchResp = await gql(`
    {
      mangas(first: 3, search: "tower of god") {
        edges {
          node {
            id
            slug
            status
            type
            originalName { lang content }
            titles { lang content }
            alternativeNames { lang content }
          }
        }
      }
    }
  `);
  await save("senkuro-search.json", searchResp);
  console.log("search → senkuro-search.json");
  console.log(JSON.stringify(searchResp.data?.mangas?.edges?.[0]?.node, null, 2));

  // 2. Manga details fixture
  const mangaResp = await gql(`
    {
      manga(slug: "tower-of-god") {
        id
        slug
        status
        type
        cover { original { url width height } }
        originalName { lang content }
        titles { lang content }
        alternativeNames { lang content }
        branches { id lang chapters }
      }
    }
  `);
  await save("senkuro-manga.json", mangaResp);
  console.log("\nmanga → senkuro-manga.json");

  const branches = mangaResp.data?.manga?.branches as Array<{ id: string; lang: string; chapters: number }> | undefined;
  const ruBranch = branches?.find((b) => b.lang === "RU") ?? branches?.[0];
  if (!ruBranch) {
    console.log("no branches, stop");
    return;
  }
  console.log(`using branch ${ruBranch.id} (${ruBranch.lang}, ${ruBranch.chapters} chapters)`);

  // 3. Chapters fixture
  const chaptersResp = await gql(`
    {
      mangaChapters(branchId: "${ruBranch.id}", first: 5) {
        edges {
          node {
            id
            slug
            number
            volume
            name
            branchId
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  `);
  await save("senkuro-chapters.json", chaptersResp);
  console.log("\nchapters → senkuro-chapters.json");
  const chapters = chaptersResp.data?.mangaChapters?.edges as Array<{ node: { slug: string; number: string } }> | undefined;
  console.log("first chapters:", chapters?.slice(0, 3).map((c) => ({ slug: c.node.slug, number: c.node.number })));

  // 4. Chapter with pages fixture
  const chapterSlug = chapters?.[0]?.node?.slug;
  if (!chapterSlug) {
    console.log("no chapter slug");
    return;
  }
  const chapterResp = await gql(`
    {
      mangaChapter(slug: "${chapterSlug}") {
        id
        slug
        number
        volume
        name
        branch { id lang }
        pages {
          id
          number
          image { original { url width height } }
        }
      }
    }
  `);
  await save("senkuro-chapter.json", chapterResp);
  console.log("\nchapter → senkuro-chapter.json");
  const chap = chapterResp.data?.mangaChapter as {
    number: string;
    volume: string;
    name: string;
    pages: Array<{ number: number; image: { original: { url: string } } }>;
  } | undefined;
  console.log(`chapter: vol=${chap?.volume} chapter=${chap?.number} name="${chap?.name}"`);
  console.log(`  pages: ${chap?.pages?.length}, first url: ${chap?.pages?.[0]?.image?.original?.url}`);

  console.log("\n=== Summary of Senkuro API findings ===");
  console.log(`
Endpoint: POST ${ENDPOINT}
No auth required for read. CORS likely permissive.

Query: mangas(first: Int!, search: String): MangaConnection
  -> edges { node: Manga }
  -> pageInfo { hasNextPage endCursor }

Query: manga(slug: String!): Manga | null

Query: mangaChapters(branchId: ID!, first: Int!): MangaChapterConnection
  -> edges { node: MangaChapter }
  -> pageInfo

Query: mangaChapter(slug: String!): MangaChapter | null
  NB: "slug" for chapters is a numeric ID (e.g. "156162230679782950"),
  not the encoded global id. Both manga.slug and chapter.slug are passable
  to respective queries.

type Manga {
  id: ID   # base64-encoded global ID like "MANGA:xxx"
  slug: String
  status: MangaStatus  # enum: ONGOING, ...
  type: MangaType      # enum: MANHWA, MANGA, MANHUA, ...
  cover: Image
  originalName: I18nTitle
  titles: [I18nTitle]
  alternativeNames: [I18nTitle]
  branches: [MangaBranch]
}

type I18nTitle {
  lang: LanguageCode  # enum: EN, RU, JA, KO, ...
  content: String
}

type MangaBranch {
  id: ID               # base64 "MANGA_BRANCH:xxx"
  lang: LanguageCode
  chapters: Int        # count, NOT list
}

type Image {
  original: ImageSize
  # (other sizes like thumbnail might exist)
}

type ImageSize {
  url: String
  width: Int
  height: Int
}

type MangaChapter {
  id: ID               # base64 "MANGA_CHAPTER:xxx"
  slug: String         # numeric string, usable with mangaChapter(slug:...)
  number: String       # "650" etc.
  volume: String
  name: String
  branch: MangaBranch
  branchId: ID
  pages: [MangaChapterPage]
  createdAt: NaiveDateTime
  updatedAt: NaiveDateTime
  # NO: publishedAt, pageCount, isLocked, paid
}

type MangaChapterPage {
  id: ID
  number: Int
  image: Image
  # NO: url, src, width, height directly on Page
}
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
