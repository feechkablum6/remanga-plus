import fs from "node:fs/promises";
import path from "node:path";
import { HttpClient } from "../src/http/client.js";

const ENDPOINT = "https://api.senkuro.com/graphql";
const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures");

const INTROSPECTION_QUERY = `
{
  __schema {
    queryType { name }
    types {
      name
      kind
      fields {
        name
        description
        args {
          name
          type { name kind ofType { name kind ofType { name kind ofType { name } } } }
        }
        type { name kind ofType { name kind ofType { name kind ofType { name } } } }
      }
    }
  }
}
`.trim();

interface GraphqlResponse<T = unknown> {
  data?: T;
  errors?: Array<{ message: string }>;
}

type TypeRef = {
  name: string | null;
  kind: string;
  ofType?: TypeRef | null;
};

type FieldDef = {
  name: string;
  description?: string | null;
  args: Array<{ name: string; type: TypeRef }>;
  type: TypeRef;
};

type TypeDef = {
  name: string | null;
  kind: string;
  fields?: FieldDef[] | null;
};

const client = new HttpClient({ timeoutMs: 30_000, maxRetries: 1 });

const gql = async <T>(query: string, variables?: unknown, label = "query"): Promise<GraphqlResponse<T>> => {
  const response = await client.request(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await response.text();
  if (!response.ok) {
    console.error(`[${label}] HTTP ${response.status}:`, text.slice(0, 400));
    throw new Error(`Senkuro ${label} returned ${response.status}`);
  }

  try {
    return JSON.parse(text) as GraphqlResponse<T>;
  } catch (error) {
    console.error(`[${label}] Failed to parse JSON, first 400 chars:`, text.slice(0, 400));
    throw error;
  }
};

const renderTypeRef = (ref: TypeRef | null | undefined): string => {
  if (!ref) return "?";
  if (ref.kind === "NON_NULL") return `${renderTypeRef(ref.ofType)}!`;
  if (ref.kind === "LIST") return `[${renderTypeRef(ref.ofType)}]`;
  return ref.name ?? ref.kind;
};

const saveJson = async (filename: string, data: unknown): Promise<void> => {
  await fs.mkdir(FIXTURES_DIR, { recursive: true });
  await fs.writeFile(path.join(FIXTURES_DIR, filename), JSON.stringify(data, null, 2), "utf8");
  console.log(`  → saved fixtures/${filename}`);
};

const findInterestingQueries = (types: TypeDef[]): FieldDef[] => {
  const queryType = types.find((t) => t.name === "Query");
  if (!queryType?.fields) return [];

  const keywords = [
    "search",
    "manga",
    "title",
    "media",
    "find",
    "chapter",
    "chapters",
    "pages",
    "branch",
    "bySlug",
    "byId",
    "feed",
    "catalog",
  ];

  return queryType.fields.filter((field) =>
    keywords.some((keyword) => field.name.toLowerCase().includes(keyword.toLowerCase())),
  );
};

const renderField = (field: FieldDef): string => {
  const args = field.args.length
    ? `(${field.args.map((a) => `${a.name}: ${renderTypeRef(a.type)}`).join(", ")})`
    : "";
  return `${field.name}${args}: ${renderTypeRef(field.type)}`;
};

const findTypeByName = (types: TypeDef[], name: string): TypeDef | undefined =>
  types.find((t) => t.name === name);

const extractUnderlyingType = (ref: TypeRef | null | undefined): string | null => {
  if (!ref) return null;
  if (ref.name) return ref.name;
  return extractUnderlyingType(ref.ofType);
};

async function main() {
  console.log("1. Fetching introspection schema...");
  const schemaResp = await gql<{
    __schema: { queryType: { name: string }; types: TypeDef[] };
  }>(INTROSPECTION_QUERY, undefined, "introspection");

  if (schemaResp.errors) {
    console.error("Introspection errors:", schemaResp.errors);
    return;
  }

  const schema = schemaResp.data?.__schema;
  if (!schema) {
    console.error("No __schema in response");
    return;
  }

  await saveJson("senkuro-schema.json", schemaResp);

  console.log("\n2. Interesting Query fields:");
  const interesting = findInterestingQueries(schema.types);
  for (const field of interesting) {
    console.log(`  • ${renderField(field)}`);
    if (field.description) console.log(`      desc: ${field.description.slice(0, 160)}`);
  }

  console.log("\n3. Query type all fields (full):");
  const queryType = schema.types.find((t) => t.name === "Query");
  queryType?.fields?.forEach((f) => console.log(`  · ${renderField(f)}`));

  console.log("\n4. Related types (Manga / Title / Chapter / Branch / Page / Search-ish):");
  const relatedTypeNames = new Set<string>();
  interesting.forEach((field) => {
    const underlying = extractUnderlyingType(field.type);
    if (underlying) relatedTypeNames.add(underlying);
    field.args.forEach((arg) => {
      const un = extractUnderlyingType(arg.type);
      if (un) relatedTypeNames.add(un);
    });
  });

  schema.types
    .filter((t) => t.name && /^(Manga|Title|Media|Chapter|Branch|Page|Search|Translator|Team|TitleAlt|Image|CoverImage)/.test(t.name))
    .forEach((t) => relatedTypeNames.add(t.name!));

  for (const typeName of relatedTypeNames) {
    const type = findTypeByName(schema.types, typeName);
    if (!type?.fields) continue;
    console.log(`\n  type ${typeName} (${type.kind}):`);
    type.fields.forEach((f) => console.log(`    · ${renderField(f)}`));
  }

  console.log("\n5. Probing a search with 'Tower of God'...");
  const searchCandidates = interesting.filter(
    (f) =>
      /search/i.test(f.name) ||
      (f.args.some((a) => /query|search|text|title|name/i.test(a.name)) && /manga|title|media/i.test(f.name)),
  );

  for (const candidate of searchCandidates) {
    const queryName = candidate.name;
    const textArg = candidate.args.find((a) => /query|search|text|title|name/i.test(a.name));
    if (!textArg) {
      console.log(`  skip ${queryName} — no string arg`);
      continue;
    }

    const returnTypeName = extractUnderlyingType(candidate.type);
    const returnType = returnTypeName ? findTypeByName(schema.types, returnTypeName) : null;

    const selectionFields = returnType?.fields
      ?.slice(0, 30)
      .filter((f) => f.args.length === 0)
      .filter((f) => {
        const underlying = extractUnderlyingType(f.type);
        if (!underlying) return true;
        const underlyingType = findTypeByName(schema.types, underlying);
        return !underlyingType?.fields;
      })
      .map((f) => f.name)
      .join(" ");

    let selection = selectionFields || "__typename";
    if (returnType?.fields?.some((f) => /edges/.test(f.name))) {
      selection = `__typename edges { __typename }`;
    } else if (returnType?.fields?.some((f) => /nodes/.test(f.name))) {
      selection = `__typename nodes { __typename }`;
    }

    const probeQuery = `query ($q: String!) { ${queryName}(${textArg.name}: $q) { ${selection} } }`;
    console.log(`\n  probing: ${probeQuery}`);

    try {
      const resp = await gql(probeQuery, { q: "Tower of God" }, `probe-${queryName}`);
      await saveJson(`senkuro-probe-${queryName}.json`, { query: probeQuery, response: resp });
      console.log(`    result keys:`, Object.keys((resp.data ?? {}) as Record<string, unknown>));
      if (resp.errors) console.log(`    errors:`, resp.errors);
    } catch (error) {
      console.log(`    probe failed:`, error instanceof Error ? error.message : error);
    }
  }

  console.log("\nDone. Review fixtures/senkuro-*.json for the raw data.");
}

main().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
