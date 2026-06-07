import "./setup-dom.js";
import assert from "node:assert/strict";
import test from "node:test";
import {
  findRecommendationsSection,
  injectPersonalRecommendations,
  type PersonalRecommendation,
} from "../src/recommendations-inject.js";

const card = (dir: string, name: string, type: string, rating: string): string => `
  <a role="group" data-slot="carousel-item" href="/manga/${dir}/main">
    <div data-id="1" class="cs-title-card">
      <img src="https://remanga.org/media/${dir}.webp">
      <span class="rating">${rating}</span>
      <span class="type">${type}</span>
      <span class="name">${name}</span>
    </div>
  </a>`;

const buildHome = (): void => {
  document.body.innerHTML = `
    <nav><a href="/manga">Рекомендации</a></nav>
    <main>
      <div class="page">
        <section data-test="recs">
          <div class="relative z-10"><span>Рекомендации для вас</span></div>
          <div class="relative w-full pb-5">
            <div class="flex">
              ${card("native-a", "Native A long title here", "Манхва 2020", "7.0")}
              ${card("native-b", "Native B long title here", "Манхва 2019", "6.5")}
            </div>
          </div>
        </section>
      </div>
    </main>
  `;
};

const recs: PersonalRecommendation[] = [
  { dir: "rec-1", name: "Rec One", img: "/media/r1.webp", rating: 9.7, typeName: "Манхва", issueYear: 2018 },
  { dir: "rec-2", name: "Rec Two", img: "/media/r2.webp", rating: 8.4, typeName: "Маньхуа", issueYear: 2021 },
];

const carousel = (): HTMLElement =>
  document.querySelector('[data-test="recs"] .pb-5') as HTMLElement;

test("findRecommendationsSection matches 'Рекомендации для вас' and returns heading text", () => {
  buildHome();
  const found = findRecommendationsSection(document);
  assert.ok(found);
  assert.equal(found?.headingText, "Рекомендации для вас");
  assert.equal(found?.section.querySelectorAll('a[href*="/manga/"]').length, 2);
});

test("injectPersonalRecommendations appends a sibling block, not into the native carousel", () => {
  buildHome();
  const before = carousel().querySelectorAll('a[href*="/manga/"]').length;
  const count = injectPersonalRecommendations(document, recs);
  assert.equal(count, 2);

  // Native carousel is untouched.
  assert.equal(carousel().querySelectorAll('a[href*="/manga/"]').length, before);

  // Our block is a sibling right after the section, with our cards.
  const block = document.querySelector('[data-rre-control="personal-recommendations-block"]') as HTMLElement;
  assert.ok(block);
  const ourCards = block.querySelectorAll('[data-rre-control="personal-recommendation"]');
  assert.equal(ourCards.length, 2);
});

test("injected card carries our href, image, name, rating, type and drops template data-id", () => {
  buildHome();
  injectPersonalRecommendations(document, recs);
  const first = document.querySelector('[data-rre-rec-dir="rec-1"]') as HTMLElement;
  assert.ok(first);
  assert.equal(first.querySelector("a, [href]") ? (first.matches("a") ? first.getAttribute("href") : first.querySelector("a")?.getAttribute("href")) : first.getAttribute("href"), "/manga/rec-1");
  assert.equal(first.querySelector("img")?.getAttribute("src"), "https://remanga.org/media/r1.webp");
  assert.equal(first.querySelector(".name")?.textContent, "Rec One");
  assert.equal(first.querySelector(".rating")?.textContent, "9.7");
  assert.equal(first.querySelector(".type")?.textContent, "Манхва 2018");
  assert.equal(first.querySelector("[data-id]"), null);
});

test("injectPersonalRecommendations skips titles already shown in the native carousel", () => {
  buildHome();
  const withDup: PersonalRecommendation[] = [
    { dir: "native-a", name: "Dup", img: "/media/x.webp" },
    { dir: "rec-9", name: "Rec Nine", img: "/media/r9.webp" },
  ];
  assert.equal(injectPersonalRecommendations(document, withDup), 1);
  const block = document.querySelector('[data-rre-control="personal-recommendations-block"]') as HTMLElement;
  assert.equal(block.querySelectorAll('[data-rre-rec-dir="native-a"]').length, 0);
  assert.equal(block.querySelectorAll('[data-rre-rec-dir="rec-9"]').length, 1);
});

test("injectPersonalRecommendations is idempotent — rebuilds a single block", () => {
  buildHome();
  injectPersonalRecommendations(document, recs);
  injectPersonalRecommendations(document, recs);
  assert.equal(
    document.querySelectorAll('[data-rre-control="personal-recommendations-block"]').length,
    1,
  );
  assert.equal(
    document.querySelectorAll('[data-rre-control="personal-recommendation"]').length,
    2,
  );
});

test("repeated injection does not treat our own block as the native section (no self-destruct)", () => {
  buildHome();
  // Our block heading "Рекомендации для вас — по жанрам" matches /рекоменд/ and
  // contains card links; a naive re-scan would pick it, dedupe to empty, and
  // delete the block. Verify the block survives several passes.
  for (let i = 0; i < 4; i += 1) {
    assert.equal(injectPersonalRecommendations(document, recs), 2);
  }
  assert.equal(
    document.querySelectorAll('[data-rre-control="personal-recommendations-block"]').length,
    1,
  );
  assert.equal(
    document.querySelectorAll('[data-rre-rec-dir="rec-1"]').length,
    1,
  );
});

test("injectPersonalRecommendations is a no-op without a recommendations section", () => {
  document.body.innerHTML = `<main><section><div>Новинки</div><div class="flex"><a href="/manga/x"><img src=""></a></div></section></main>`;
  assert.equal(injectPersonalRecommendations(document, recs), 0);
});
