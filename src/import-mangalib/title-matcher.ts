export interface RemangaCandidate {
  id: number;
  dir: string;
  main_name: string;
  secondary_name: string;
  another_name: string;
}

export type MatchResult =
  | { kind: "certain"; chosen: RemangaCandidate }
  | { kind: "ambiguous"; candidates: RemangaCandidate[] }
  | { kind: "not_found" };

const PUNCTUATION_RE = /[.,/#!$%^&*;:{}=\-_`~()'"?!«»…]+/g;
const WHITESPACE_RE = /\s+/g;

export function normaliseTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/й/g, "и")
    .replace(PUNCTUATION_RE, " ")
    .replace(WHITESPACE_RE, " ")
    .trim();
}

function namesOf(c: RemangaCandidate): string[] {
  const main = normaliseTitle(c.main_name || "");
  const secondary = normaliseTitle(c.secondary_name || "");
  const synonyms = (c.another_name || "")
    .split("/")
    .map((s) => normaliseTitle(s))
    .filter(Boolean);
  return [main, secondary, ...synonyms].filter(Boolean);
}

function fuzzyContains(query: string, candidate: string): boolean {
  if (!query || !candidate) return false;
  return candidate.includes(query) || query.includes(candidate);
}

export function matchTitle(query: string, candidates: RemangaCandidate[]): MatchResult {
  if (candidates.length === 0) return { kind: "not_found" };
  const normalisedQuery = normaliseTitle(query);

  const exact = candidates.find((c) => namesOf(c).some((n) => n === normalisedQuery));
  if (exact) return { kind: "certain", chosen: exact };

  const fuzzy = candidates.filter((c) => namesOf(c).some((n) => fuzzyContains(normalisedQuery, n)));
  if (fuzzy.length === 0) return { kind: "not_found" };
  return { kind: "ambiguous", candidates: fuzzy.slice(0, 3) };
}
