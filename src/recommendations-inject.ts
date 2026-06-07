// Renders genre-matched recommendations on the home page right below Remanga's
// own recommendations carousel. We do NOT insert into the native carousel's
// track: it is a React component that re-reconciles after hydration and removes
// any foreign DOM nodes (verified live). Instead we build a sibling block,
// cloning a native card as a visual template, which survives re-renders.

export type PersonalRecommendation = {
  dir: string;
  name: string;
  img: string;
  rating?: number;
  typeName?: string;
  issueYear?: number | null;
};

const HEADING_RE = /рекоменд/i;
const BLOCK_ATTR = "data-rre-control";
const BLOCK_SIG_ATTR = "data-rre-sig";
const BLOCK_VALUE = "personal-recommendations-block";
const CARD_ATTR_VALUE = "personal-recommendation";

const CARD_LINK_SELECTOR = 'a[href*="/manga/"], a[href*="/content/"]';
const RATING_RE = /^\d{1,2}([.,]\d)?$/;
const TYPE_RE = /(манхва|манга|маньхуа|комикс|оэл|руманга|западный)/i;

const extractDir = (href: string): string | null => {
  try {
    const url = new URL(href, "https://remanga.org");
    const match = url.pathname.match(/^\/(?:content|manga)\/([^/?#]+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
};

const isHeadingCandidate = (element: Element): boolean => {
  const text = (element.textContent ?? "").trim();
  if (text.length === 0 || text.length > 48 || !HEADING_RE.test(text)) return false;
  if (element.querySelector(CARD_LINK_SELECTOR) !== null) return false;
  if (element.closest("a, nav, header")) return false;
  // Never treat our own injected block (heading "… — по жанрам") as the native
  // section, otherwise each pass would dedupe against itself and self-destruct.
  if (element.closest(`[${BLOCK_ATTR}="${BLOCK_VALUE}"]`)) return false;
  return true;
};

const isSectionAncestor = (element: HTMLElement): boolean =>
  !element.matches("body, html") &&
  element.getAttribute(BLOCK_ATTR) !== BLOCK_VALUE &&
  element.querySelector(CARD_LINK_SELECTOR) !== null;

// Returns the native recommendations section wrapper (the element whose subtree
// holds the cards) and its visible heading text, or null when absent.
export const findRecommendationsSection = (
  root: ParentNode,
): { section: HTMLElement; headingText: string } | null => {
  const headings = Array.from(root.querySelectorAll<HTMLElement>("*")).filter(
    isHeadingCandidate,
  );
  let best: { section: HTMLElement; headingText: string; distance: number } | null = null;
  for (const heading of headings) {
    let ancestor: HTMLElement | null = heading.parentElement;
    let distance = 0;
    while (ancestor) {
      distance += 1;
      if (isSectionAncestor(ancestor)) {
        if (!best || distance < best.distance) {
          best = {
            section: ancestor,
            headingText: (heading.textContent ?? "").trim(),
            distance,
          };
        }
        break;
      }
      ancestor = ancestor.parentElement;
    }
  }
  return best ? { section: best.section, headingText: best.headingText } : null;
};

// The card "tile" is the smallest ancestor of a card link that still wraps a
// single title. For Remanga that is the carousel-item <a> itself.
const findCardElement = (link: HTMLElement, stop: Element): HTMLElement => {
  let candidate: HTMLElement = link;
  let current: HTMLElement | null = link;
  while (current?.parentElement && current.parentElement !== stop) {
    const parent: HTMLElement = current.parentElement;
    if (parent.matches("main, section, article, body, html")) break;
    if (parent.querySelectorAll(CARD_LINK_SELECTOR).length !== 1) break;
    candidate = parent;
    current = parent;
  }
  return candidate;
};

const buildImageUrl = (templateSrc: string, path: string): string => {
  if (/^https?:\/\//i.test(path)) return path;
  try {
    const url = new URL(templateSrc, "https://remanga.org");
    url.pathname = path.startsWith("/") ? path : `/${path}`;
    url.search = "";
    return url.toString();
  } catch {
    return path;
  }
};

const formatTypeLine = (rec: PersonalRecommendation): string => {
  if (!rec.typeName) return "";
  return rec.issueYear ? `${rec.typeName} ${rec.issueYear}` : rec.typeName;
};

// Re-skins a cloned native card to show one of our recommendations. The card is
// detached from React, so plain DOM edits stick.
const applyRecommendation = (
  card: HTMLElement,
  rec: PersonalRecommendation,
): void => {
  const anchor = card.matches("a")
    ? (card as HTMLAnchorElement)
    : card.querySelector("a");
  if (anchor) {
    anchor.setAttribute("href", `/manga/${rec.dir}`);
    anchor.setAttribute("title", rec.name);
    anchor.setAttribute("aria-label", rec.name);
  }
  // Strip the template's data-id so it can't be confused with the original.
  card.querySelectorAll("[data-id]").forEach((el) => el.removeAttribute("data-id"));
  // Refresh leftover tooltip `title` attributes (the card's inner wrapper keeps
  // the template title otherwise).
  const titleText = [rec.typeName, rec.name, rec.issueYear ?? ""]
    .filter((part) => part !== "" && part != null)
    .join(" ");
  card
    .querySelectorAll("[title]")
    .forEach((el) => el.setAttribute("title", titleText || rec.name));

  const img = card.querySelector("img");
  if (img) {
    img.setAttribute("src", buildImageUrl(img.getAttribute("src") ?? "", rec.img));
    img.setAttribute("alt", rec.name);
    img.removeAttribute("srcset");
    img.setAttribute("loading", "lazy");
  }

  const leaves = Array.from(card.querySelectorAll<HTMLElement>("*")).filter(
    (el) =>
      el.children.length === 0 &&
      el.tagName !== "IMG" &&
      (el.textContent ?? "").trim().length > 0,
  );

  const byLength = [...leaves].sort(
    (a, b) => (b.textContent ?? "").trim().length - (a.textContent ?? "").trim().length,
  );
  const nameLeaf = byLength[0];
  if (nameLeaf) nameLeaf.textContent = rec.name;

  const typeLine = formatTypeLine(rec);
  if (typeLine) {
    const typeLeaf = leaves.find(
      (el) => el !== nameLeaf && TYPE_RE.test((el.textContent ?? "").trim()),
    );
    if (typeLeaf) typeLeaf.textContent = typeLine;
  }

  if (typeof rec.rating === "number" && rec.rating > 0) {
    const ratingLeaf = leaves.find(
      (el) => el !== nameLeaf && RATING_RE.test((el.textContent ?? "").trim()),
    );
    if (ratingLeaf) ratingLeaf.textContent = rec.rating.toFixed(1);
  }
};

export const injectPersonalRecommendations = (
  root: ParentNode,
  recommendations: PersonalRecommendation[],
): number => {
  const found = findRecommendationsSection(root);
  if (!found) return 0;
  const { section, headingText } = found;

  const links = Array.from(section.querySelectorAll<HTMLAnchorElement>(CARD_LINK_SELECTOR));
  if (links.length === 0) return 0;

  const templateCard = findCardElement(links[0], section);
  const track = templateCard.parentElement;
  if (!track) return 0;

  const nativeDirs = new Set<string>();
  for (const link of links) {
    const dir = extractDir(link.getAttribute("href") ?? "");
    if (dir) nativeDirs.add(dir);
  }

  const fresh = recommendations.filter((rec) => rec.dir && !nativeDirs.has(rec.dir));

  // Build the signature string while we validate — avoids an extra pass.
  const orderedDirs = new Array<string>();
  for (const rec of fresh) {
    if (rec.dir) orderedDirs.push(rec.dir);
  }
  const signature = orderedDirs.sort().join(",");

  // Idempotent: if a block with the same signature is already in the DOM, skip
  // the entire injection. No removal → no flicker even when React re-reconciles
  // the page and triggers a self-heal.
  const existing = root.querySelector<HTMLElement>(
    `[${BLOCK_ATTR}="${BLOCK_VALUE}"]`,
  );
  if (existing && existing.getAttribute(BLOCK_SIG_ATTR) === signature) {
    return fresh.length;
  }

  if (fresh.length === 0) {
    existing?.remove();
    return 0;
  }

  const block = document.createElement("div");
  block.setAttribute(BLOCK_ATTR, BLOCK_VALUE);
  block.className = section.className;
  block.setAttribute(BLOCK_SIG_ATTR, signature);

  const heading = document.createElement("div");
  heading.style.cssText =
    "display:flex;align-items:center;gap:8px;padding:0 0 12px;font-weight:700;" +
    "font-size:16px;color:#e2e8f0;text-transform:uppercase;letter-spacing:0.02em;";
  heading.textContent = headingText
    ? `${headingText} — по жанрам`
    : "Рекомендации по жанрам";
  block.appendChild(heading);

  const grid = document.createElement("div");
  grid.style.cssText =
    "display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;";
  block.appendChild(grid);

  let injected = 0;
  for (const rec of fresh) {
    const clone = templateCard.cloneNode(true) as HTMLElement;
    clone.setAttribute(BLOCK_ATTR, CARD_ATTR_VALUE);
    clone.setAttribute("data-rre-rec-dir", rec.dir);
    // Drop carousel sizing classes so cards lay out in the grid.
    clone.className = "min-w-0";
    clone.style.cssText = "";
    applyRecommendation(clone, rec);
    grid.appendChild(clone);
    injected += 1;
  }

  // Atomic DOM swap: replace old block with new in one paint frame (no gap).
  if (existing) {
    existing.replaceWith(block);
  } else {
    section.after(block);
  }
  return injected;
};
