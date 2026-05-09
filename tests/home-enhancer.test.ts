import "./setup-dom.js";
import assert from "node:assert/strict";
import test from "node:test";

import { applyHomeEnhancements, HEADER_BUTTON_KEYS } from "../src/home-enhancer.js";
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
        <button data-state="closed" data-sentry-element="Button"></button>
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
    const ellipsis = root.querySelector('div.md\\:flex > button[data-state]') as HTMLElement;
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
