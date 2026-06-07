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

const TEAL = "#3EDAE0";
const TEAL_BG = "rgba(62,218,224,0.06)";

const createFrameIcon = (
  x: string,
  y: string,
  tx: string,
  ty: string,
): SVGSVGElement => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "480");
  svg.setAttribute("height", "480");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "currentColor");
  svg.style.cssText = [
    "position:absolute",
    `left:${x}`,
    `top:${y}`,
    "height:220px",
    "width:220px",
    `transform:${tx} ${ty}`,
    `color:${TEAL}`,
    "opacity:0.22",
    "filter:blur(64px)",
  ].join(";");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M12 2L22 12L12 22L2 12Z");
  svg.appendChild(path);
  return svg;
};

const createScrollButton = (direction: "prev" | "next"): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute("aria-label", direction === "prev" ? "Previous slide" : "Next slide");
  const isPrev = direction === "prev";
  btn.style.cssText = [
    "position:absolute",
    "top:50%",
    isPrev ? "left:-16px" : "right:-16px",
    "transform:translateY(-50%)",
    "z-index:20",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "width:40px",
    "height:40px",
    "border-radius:50%",
    "border:1.5px solid rgba(62,218,224,0.35)",
    "background:rgba(24,25,27,0.94)",
    "color:#e2e8f0",
    "cursor:pointer",
    "opacity:0",
    "transition:opacity 180ms ease, transform 180ms ease, border-color 180ms ease",
    "box-shadow:0 4px 16px rgba(0,0,0,0.4)",
  ].join(";");
  btn.innerHTML = isPrev
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';
  return btn;
};

const scrollCarouselBy = (
  track: HTMLElement,
  direction: "prev" | "next",
): void => {
  const cardWidth =
    (track.firstElementChild as HTMLElement | null)?.offsetWidth ?? 150;
  const gap = 16;
  const scrollAmount = (cardWidth + gap) * 3;
  track.scrollBy({
    left: direction === "next" ? scrollAmount : -scrollAmount,
    behavior: "smooth",
  });
};

const updateScrollButtons = (
  track: HTMLElement,
  prevBtn: HTMLButtonElement,
  nextBtn: HTMLButtonElement,
): void => {
  const atStart = track.scrollLeft <= 1;
  const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 1;
  prevBtn.style.opacity = atStart ? "0" : "1";
  prevBtn.style.pointerEvents = atStart ? "none" : "auto";
  nextBtn.style.opacity = atEnd ? "0" : "1";
  nextBtn.style.pointerEvents = atEnd ? "none" : "auto";
};

export const injectPersonalRecommendations = (
  root: ParentNode,
  recommendations: PersonalRecommendation[],
): number => {
  const found = findRecommendationsSection(root);
  if (!found) return 0;
  const { section } = found;

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

  const orderedDirs = new Array<string>();
  for (const rec of fresh) {
    if (rec.dir) orderedDirs.push(rec.dir);
  }
  const signature = orderedDirs.sort().join(",");

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

  // --- Build the block ---

  const block = document.createElement("div");
  block.setAttribute(BLOCK_ATTR, BLOCK_VALUE);
  block.setAttribute(BLOCK_SIG_ATTR, signature);
  block.style.cssText = "position:relative;width:100%;padding-bottom:20px;";

  // Decorative frame overlay — gradient bg + rounded border + blurred icons.
  const frameOverlay = document.createElement("div");
  frameOverlay.style.cssText = [
    "pointer-events:none",
    "position:absolute",
    "left:0",
    "right:0",
    "top:18px",
    "bottom:0",
    "overflow:hidden",
    "border-radius:22px",
    `background:linear-gradient(180deg, ${TEAL_BG} 0%, rgba(19,20,22,0) 55%)`,
  ].join(";");

  const frameBorder = document.createElement("div");
  frameBorder.style.cssText = [
    "position:absolute",
    "inset:0",
    "border-radius:22px",
    "border:2px solid #3EDAE0",
  ].join(";");
  frameOverlay.appendChild(frameBorder);

  // Three blurred icons, matching the native three-position decoration.
  frameOverlay.appendChild(createFrameIcon("-64px", "50%", "translateY(-50%)", ""));
  frameOverlay.appendChild(createFrameIcon("50%", "-100px", "translateX(-50%)", ""));
  frameOverlay.appendChild(createFrameIcon("calc(100% + 64px)", "100%", "", "translateY(50%)"));

  block.appendChild(frameOverlay);

  // Badge row with scroll buttons.
  const contentRow = document.createElement("div");
  contentRow.style.cssText = [
    "position:relative",
    "z-index:10",
    "display:flex",
    "align-items:center",
    "justify-content:space-between",
    "padding:0 32px 16px",
  ].join(";");

  const badge = document.createElement("div");
  badge.style.cssText = [
    "display:flex",
    "height:40px",
    "align-items:center",
    "gap:8px",
    "border-radius:8px",
    "border:2px solid #3EDAE0",
    "background:#3EDAE0",
    "padding-right:20px",
    "padding-left:12px",
  ].join(";");

  const iconWrapper = document.createElement("div");
  iconWrapper.style.cssText = "position:relative;color:#0f1729;display:flex;";
  iconWrapper.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">' +
    '<path d="M12 2L22 12L12 22L2 12Z"/>' +
    "</svg>";

  const label = document.createElement("span");
  label.style.cssText = [
    "font-size:18px",
    "line-height:1",
    "font-weight:600",
    "color:#fff",
    "text-transform:uppercase",
    "font-style:italic",
  ].join(";");
  label.textContent = "Remanga PLUS";

  badge.append(iconWrapper, label);

  // Scroll buttons (shown on hover).
  const prevBtn = createScrollButton("prev");
  const nextBtn = createScrollButton("next");

  contentRow.append(badge, prevBtn, nextBtn);
  block.appendChild(contentRow);

  // Horizontal scroll track.
  const carouselWrapper = document.createElement("div");
  carouselWrapper.style.cssText = [
    "position:relative",
    "z-index:10",
    "padding:0 32px",
  ].join(";");

  const scrollTrack = document.createElement("div");
  scrollTrack.setAttribute(BLOCK_ATTR, "personal-recommendations-track");
  scrollTrack.style.cssText = [
    "display:flex",
    "gap:16px",
    "overflow-x:auto",
    "scroll-snap-type:x mandatory",
    "scrollbar-width:none",
    "-ms-overflow-style:none",
    "padding-bottom:4px",
  ].join(";");

  // Hide webkit scrollbar.
  const styleTag = document.createElement("style");
  styleTag.textContent =
    `[${BLOCK_ATTR}="personal-recommendations-track"]::-webkit-scrollbar{display:none}`;
  scrollTrack.appendChild(styleTag);

  let injected = 0;
  for (const rec of fresh) {
    const clone = templateCard.cloneNode(true) as HTMLElement;
    clone.setAttribute(BLOCK_ATTR, CARD_ATTR_VALUE);
    clone.setAttribute("data-rre-rec-dir", rec.dir);
    clone.className = "min-w-0";
    clone.style.cssText = [
      "flex:0 0 150px",
      "scroll-snap-align:start",
    ].join(";");
    applyRecommendation(clone, rec);
    scrollTrack.appendChild(clone);
    injected += 1;
  }

  // Wire scroll buttons.
  const onScroll = () => updateScrollButtons(scrollTrack, prevBtn, nextBtn);
  scrollTrack.addEventListener("scroll", onScroll, { passive: true });

  prevBtn.addEventListener("click", (e) => {
    e.preventDefault();
    scrollCarouselBy(scrollTrack, "prev");
  });
  nextBtn.addEventListener("click", (e) => {
    e.preventDefault();
    scrollCarouselBy(scrollTrack, "next");
  });

  // Show buttons on hover over the carousel area.
  carouselWrapper.addEventListener("pointerenter", () => {
    prevBtn.style.opacity = scrollTrack.scrollLeft > 1 ? "1" : "0";
    if (scrollTrack.scrollLeft > 1) prevBtn.style.pointerEvents = "auto";
    nextBtn.style.opacity =
      scrollTrack.scrollLeft + scrollTrack.clientWidth < scrollTrack.scrollWidth - 1
        ? "1"
        : "0";
    if (scrollTrack.scrollLeft + scrollTrack.clientWidth < scrollTrack.scrollWidth - 1) {
      nextBtn.style.pointerEvents = "auto";
    }
  });
  carouselWrapper.addEventListener("pointerleave", () => {
    prevBtn.style.opacity = "0";
    prevBtn.style.pointerEvents = "none";
    nextBtn.style.opacity = "0";
    nextBtn.style.pointerEvents = "none";
  });

  carouselWrapper.appendChild(scrollTrack);
  block.appendChild(carouselWrapper);

  // Initial button state.
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => updateScrollButtons(scrollTrack, prevBtn, nextBtn));
  }

  // Atomic DOM swap.
  if (existing) {
    existing.replaceWith(block);
  } else {
    section.after(block);
  }
  return injected;
};
