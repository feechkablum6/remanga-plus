import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderAuthRow, type AuthState } from "../src/popup-auth-row.js";

const html = readFileSync(resolve("public/popup.html"), "utf8");

const cases: Array<{
  name: string;
  state: { mangalib: AuthState; remanga: AuthState };
  mangalibIcon: string;
  mangalibName: string;
  remangaIcon: string;
  remangaName: string;
  importDisabled: boolean;
  hintText: string | null;
}> = [
  {
    name: "both ok → button enabled, no hint",
    state: { mangalib: "ok", remanga: "ok" },
    mangalibIcon: "ok",
    mangalibName: "ok",
    remangaIcon: "ok",
    remangaName: "ok",
    importDisabled: false,
    hintText: null,
  },
  {
    name: "mangalib bad → button disabled, hint about MangaLib",
    state: { mangalib: "bad", remanga: "ok" },
    mangalibIcon: "bad",
    mangalibName: "bad",
    remangaIcon: "ok",
    remangaName: "ok",
    importDisabled: true,
    hintText: "Войдите в MangaLib для импорта",
  },
  {
    name: "remanga bad → button disabled, hint about Remanga",
    state: { mangalib: "ok", remanga: "bad" },
    mangalibIcon: "ok",
    mangalibName: "ok",
    remangaIcon: "bad",
    remangaName: "bad",
    importDisabled: true,
    hintText: "Войдите в Remanga для импорта",
  },
  {
    name: "both bad → button disabled, hint about both",
    state: { mangalib: "bad", remanga: "bad" },
    mangalibIcon: "bad",
    mangalibName: "bad",
    remangaIcon: "bad",
    remangaName: "bad",
    importDisabled: true,
    hintText: "Войдите в MangaLib и Remanga для импорта",
  },
  {
    name: "checking → button disabled, no hint",
    state: { mangalib: "checking", remanga: "checking" },
    mangalibIcon: "checking",
    mangalibName: "checking",
    remangaIcon: "checking",
    remangaName: "checking",
    importDisabled: true,
    hintText: null,
  },
];

for (const c of cases) {
  test(c.name, () => {
    const dom = new JSDOM(html);
    renderAuthRow(dom.window.document, c.state);
    const doc = dom.window.document;
    assert.equal(
      doc.querySelector('[data-auth-icon="mangalib"]')?.getAttribute("data-state"),
      c.mangalibIcon,
      "mangalib icon state",
    );
    assert.equal(
      doc.querySelector('[data-auth-link="mangalib"]')?.getAttribute("data-state"),
      c.mangalibName,
      "mangalib link state",
    );
    assert.equal(
      doc.querySelector('[data-auth-icon="remanga"]')?.getAttribute("data-state"),
      c.remangaIcon,
      "remanga icon state",
    );
    assert.equal(
      doc.querySelector('[data-auth-link="remanga"]')?.getAttribute("data-state"),
      c.remangaName,
      "remanga link state",
    );
    const btn = doc.querySelector<HTMLButtonElement>("[data-import-button]");
    assert.equal(btn?.disabled, c.importDisabled, "import disabled");

    const hint = doc.querySelector<HTMLElement>("[data-auth-hint]");
    if (c.hintText === null) {
      assert.equal(hint?.hidden, true, "hint hidden");
    } else {
      assert.equal(hint?.hidden, false, "hint visible");
      assert.equal(hint?.textContent, c.hintText);
    }
  });
}
