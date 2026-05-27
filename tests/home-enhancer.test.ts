import "./setup-dom.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  applyHomeEnhancements,
  getEnabledBookmarkDirs,
  HEADER_BUTTON_KEYS,
} from "../src/home-enhancer.js";
import { mergeSettings } from "../src/settings.js";

const buildHeader = (): { root: HTMLElement; cleanup: () => void } => {
  const root = document.createElement("div");
  root.innerHTML = `
    <header data-sentry-component="HeaderBase">
      <a data-sentry-component="LogoButton" href="/">Logo</a>
      <div class="hidden md:flex">
        <a href="/manga">Каталог</a>
        <a href="/manga/top">Топы</a>
        <a href="/forum?ordering=last">Форум</a>
        <nav><div><ul><li><button data-state="closed"></button></li></ul></div></nav>
      </div>
      <button data-sentry-component="SearchButton">Поиск</button>
      <a href="/user/bookmarks">Закладки</a>
      <a href="/chat" data-test="chat"></a>
      <a href="/user/notifications">
        <button data-sentry-component="Notifications"></button>
      </a>
      <button aria-haspopup="menu" data-state="closed">F user</button>
    </header>
    <div class="fixed bottom-8 right-8 z-100">
      <button data-sentry-component="AngleButton">Охотники подземелий</button>
    </div>
  `;
  document.body.appendChild(root);
  return {
    root,
    cleanup: () => root.remove(),
  };
};

test("HEADER_BUTTON_KEYS lists exactly 10 entries", () => {
  assert.equal(HEADER_BUTTON_KEYS.length, 10);
});

test("applyHomeEnhancements hides each header button when its toggle is true", () => {
  const { root, cleanup } = buildHeader();
  try {
    const settings = mergeSettings({
      hideHeaderButtons: { forum: true, chat: true },
    });
    applyHomeEnhancements(root, settings);

    const forum = root.querySelector('a[href*="/forum"]') as HTMLElement;
    const chat = root.querySelector('a[href="/chat"]') as HTMLElement;
    const catalog = root.querySelector('a[href="/manga"]') as HTMLElement;

    assert.equal(forum.style.display, "none");
    assert.equal(chat.style.display, "none");
    assert.notEqual(catalog.style.display, "none");
  } finally {
    cleanup();
  }
});

test("applyHomeEnhancements restores element when toggle becomes false", () => {
  const { root, cleanup } = buildHeader();
  try {
    applyHomeEnhancements(root, mergeSettings({ hideHeaderButtons: { forum: true } }));
    const forum = root.querySelector('a[href*="/forum"]') as HTMLElement;
    assert.equal(forum.style.display, "none");

    applyHomeEnhancements(root, mergeSettings({}));
    assert.notEqual(forum.style.display, "none");
  } finally {
    cleanup();
  }
});

test("applyHomeEnhancements hides game banner when hideHomeGameBanner = true", () => {
  const { root, cleanup } = buildHeader();
  try {
    applyHomeEnhancements(root, mergeSettings({ hideHomeGameBanner: true }));
    const banner = root.querySelector('div.fixed.bottom-8.right-8.z-100') as HTMLElement;
    assert.equal(banner.style.display, "none");
  } finally {
    cleanup();
  }
});

const buildPromoBanner = (): { root: HTMLElement; cleanup: () => void } => {
  const root = document.createElement("div");
  root.innerHTML = `
    <main>
      <div data-promo-host class="border-border bg-card relative mx-auto w-full max-w-[600px] rounded-2xl border px-4 py-3">
        <div class="flex items-center gap-3 pr-8">
          <img src="/cat.png" alt="" />
          <div>
            <p>Твой чит-код на ReManga!</p>
            <p>Промокоды, анонсы и новости — всё в одном канале.</p>
          </div>
          <a class="cs-button" href="https://remanga.org/lnk6ayx5yy">Подписаться</a>
        </div>
        <button aria-label="Dismiss"><svg></svg></button>
      </div>
    </main>
  `;
  document.body.appendChild(root);
  return {
    root,
    cleanup: () => root.remove(),
  };
};

test("applyHomeEnhancements hides telegram promo banner when hideHomePromoBanner = true", () => {
  const { root, cleanup } = buildPromoBanner();
  try {
    applyHomeEnhancements(root, mergeSettings({ hideHomePromoBanner: true }));
    const banner = root.querySelector("[data-promo-host]") as HTMLElement;
    assert.equal(banner.style.display, "none");
  } finally {
    cleanup();
  }
});

test("applyHomeEnhancements leaves telegram promo banner visible when toggle is false", () => {
  const { root, cleanup } = buildPromoBanner();
  try {
    applyHomeEnhancements(root, mergeSettings({}));
    const banner = root.querySelector("[data-promo-host]") as HTMLElement;
    assert.notEqual(banner.style.display, "none");
  } finally {
    cleanup();
  }
});

test("applyHomeEnhancements restores promo banner when toggle becomes false", () => {
  const { root, cleanup } = buildPromoBanner();
  try {
    applyHomeEnhancements(root, mergeSettings({ hideHomePromoBanner: true }));
    const banner = root.querySelector("[data-promo-host]") as HTMLElement;
    assert.equal(banner.style.display, "none");

    applyHomeEnhancements(root, mergeSettings({}));
    assert.notEqual(banner.style.display, "none");
  } finally {
    cleanup();
  }
});

test("applyHomeEnhancements does not hide unrelated containers when toggle is on", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <div data-other class="rounded-2xl border p-3">
      <a href="/manga/some-title">Обычная ссылка</a>
      <button>Какая-то кнопка</button>
    </div>
  `;
  document.body.appendChild(root);
  try {
    applyHomeEnhancements(root, mergeSettings({ hideHomePromoBanner: true }));
    const other = root.querySelector("[data-other]") as HTMLElement;
    assert.notEqual(other.style.display, "none");
  } finally {
    root.remove();
  }
});

test("applyHomeEnhancements hides only the smallest promo container, not main page wrapper", () => {
  const { root, cleanup } = buildPromoBanner();
  try {
    applyHomeEnhancements(root, mergeSettings({ hideHomePromoBanner: true }));
    const banner = root.querySelector("[data-promo-host]") as HTMLElement;
    const main = root.querySelector("main") as HTMLElement;
    assert.equal(banner.style.display, "none");
    assert.notEqual(main.style.display, "none");
  } finally {
    cleanup();
  }
});

test("applyHomeEnhancements hides logo, search, bookmarks, ellipsis, avatar when toggled", () => {
  const { root, cleanup } = buildHeader();
  try {
    const settings = mergeSettings({
      hideHeaderButtons: {
        logo: true,
        search: true,
        bookmarks: true,
        ellipsis: true,
        avatar: true,
      },
    });
    applyHomeEnhancements(root, settings);

    const logo = root.querySelector('a[data-sentry-component="LogoButton"]') as HTMLElement;
    const search = root.querySelector('[data-sentry-component="SearchButton"]') as HTMLElement;
    const bookmarks = root.querySelector('a[href="/user/bookmarks"]') as HTMLElement;
    const ellipsis = root.querySelector('div.md\\:flex > nav') as HTMLElement;
    const avatar = root.querySelector('button[aria-haspopup="menu"]') as HTMLElement;

    assert.equal(logo.style.display, "none");
    assert.equal(search.style.display, "none");
    assert.equal(bookmarks.style.display, "none");
    assert.equal(ellipsis.style.display, "none");
    assert.equal(avatar.style.display, "none");
  } finally {
    cleanup();
  }
});

test("getEnabledBookmarkDirs returns dirs matching enabled categories", () => {
  const dirs = getEnabledBookmarkDirs(
    {
      "reading-title": ["reading"],
      "dropped-title": ["dropped"],
      "favorite-title": ["favorite", "completed"],
    },
    mergeSettings({
      filterBookmarkCategories: {
        reading: true,
        dropped: false,
        favorite: true,
      },
    }).filterBookmarkCategories,
  );

  assert.deepEqual([...dirs].sort(), ["favorite-title", "reading-title"]);
});

test("applyHomeEnhancements hides home manga links whose dirs are filtered", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <main>
      <a data-card="reading" href="/manga/reading-title">Reading</a>
      <a data-card="other" href="/manga/other-title">Other</a>
    </main>
  `;
  document.body.appendChild(root);
  try {
    applyHomeEnhancements(
      root,
      mergeSettings({ filterHomeBookmarks: true }),
      new Set(["reading-title"]),
    );

    const reading = root.querySelector('[data-card="reading"]') as HTMLElement;
    const other = root.querySelector('[data-card="other"]') as HTMLElement;
    assert.equal(reading.style.display, "none");
    assert.notEqual(other.style.display, "none");
  } finally {
    root.remove();
  }
});

test("applyHomeEnhancements hides home content links whose dirs are filtered", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <header><a href="/content/reading-title">Header title should stay visible</a></header>
    <main>
      <a data-card="reading" href="/content/reading-title">Reading</a>
      <a data-card="other" href="/content/other-title">Other</a>
    </main>
  `;
  document.body.appendChild(root);
  try {
    applyHomeEnhancements(
      root,
      mergeSettings({ filterHomeBookmarks: true }),
      new Set(["reading-title"]),
    );

    const header = root.querySelector("header a") as HTMLElement;
    const reading = root.querySelector('[data-card="reading"]') as HTMLElement;
    const other = root.querySelector('[data-card="other"]') as HTMLElement;
    assert.notEqual(header.style.display, "none");
    assert.equal(reading.style.display, "none");
    assert.notEqual(other.style.display, "none");
  } finally {
    root.remove();
  }
});

test("applyHomeEnhancements hides the title card wrapper, not only the link", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <main>
      <div data-card="reading" class="grid-item">
        <img src="/cover.jpg" alt="" />
        <a href="/content/reading-title">Reading</a>
      </div>
      <div data-card="other" class="grid-item">
        <img src="/cover-2.jpg" alt="" />
        <a href="/content/other-title">Other</a>
      </div>
    </main>
  `;
  document.body.appendChild(root);
  try {
    applyHomeEnhancements(
      root,
      mergeSettings({ filterHomeBookmarks: true }),
      new Set(["reading-title"]),
    );

    const reading = root.querySelector('[data-card="reading"]') as HTMLElement;
    const readingLink = reading.querySelector("a") as HTMLElement;
    const other = root.querySelector('[data-card="other"]') as HTMLElement;
    assert.equal(reading.style.display, "none");
    assert.notEqual(readingLink.style.display, "none");
    assert.notEqual(other.style.display, "none");
  } finally {
    root.remove();
  }
});

test("applyHomeEnhancements restores bookmark-filtered links when disabled", () => {
  const root = document.createElement("div");
  root.innerHTML = `<main><a data-card="reading" href="/manga/reading-title">Reading</a></main>`;
  document.body.appendChild(root);
  try {
    applyHomeEnhancements(
      root,
      mergeSettings({ filterHomeBookmarks: true }),
      new Set(["reading-title"]),
    );
    const reading = root.querySelector('[data-card="reading"]') as HTMLElement;
    assert.equal(reading.style.display, "none");

    applyHomeEnhancements(root, mergeSettings({ filterHomeBookmarks: false }), null);
    assert.notEqual(reading.style.display, "none");
  } finally {
    root.remove();
  }
});

test("applyHomeEnhancements does NOT hide cards inside 'Продолжить чтение' section (link to /user/history)", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <main>
      <div data-section="continue-reading">
        <div class="mb-4">
          <p>Продолжить чтение</p>
          <a href="/user/history">Больше</a>
        </div>
        <div>
          <div data-card="reading-cr">
            <a href="/manga/reading-title/main">Reading in CR</a>
            <div role="progressbar"></div>
          </div>
          <div data-card="other-cr">
            <a href="/manga/other-title/main">Other in CR</a>
            <div role="progressbar"></div>
          </div>
        </div>
      </div>
      <div data-section="hot">
        <p>Горячие новинки</p>
        <a href="/manga/hot-updates">Больше</a>
        <div>
          <div data-card="reading-hot">
            <a href="/manga/reading-title">Reading in Hot</a>
          </div>
          <div data-card="other-hot">
            <a href="/manga/other-title">Other in Hot</a>
          </div>
        </div>
      </div>
    </main>
  `;
  document.body.appendChild(root);
  try {
    applyHomeEnhancements(
      root,
      mergeSettings({ filterHomeBookmarks: true }),
      new Set(["reading-title"]),
    );

    const crReading = root.querySelector('[data-card="reading-cr"]') as HTMLElement;
    const crOther = root.querySelector('[data-card="other-cr"]') as HTMLElement;
    const hotReading = root.querySelector('[data-card="reading-hot"]') as HTMLElement;
    const hotOther = root.querySelector('[data-card="other-hot"]') as HTMLElement;

    assert.notEqual(crReading.style.display, "none");
    assert.notEqual(crOther.style.display, "none");
    assert.equal(hotReading.style.display, "none");
    assert.notEqual(hotOther.style.display, "none");
  } finally {
    root.remove();
  }
});

test("applyHomeEnhancements hides home cards with visible bookmark badges when dirs are unavailable", () => {
  const root = document.createElement("div");
  root.innerHTML = `
    <main>
      <a data-card="planned" href="/manga/planned-title/main">
        <span>Буду читать</span>
        <span>Planned title</span>
      </a>
      <a data-card="other" href="/manga/other-title/main">Other</a>
    </main>
  `;
  document.body.appendChild(root);
  try {
    applyHomeEnhancements(
      root,
      mergeSettings({ filterHomeBookmarks: true }),
      null,
    );

    const planned = root.querySelector('[data-card="planned"]') as HTMLElement;
    const other = root.querySelector('[data-card="other"]') as HTMLElement;
    assert.equal(planned.style.display, "none");
    assert.notEqual(other.style.display, "none");
  } finally {
    root.remove();
  }
});
