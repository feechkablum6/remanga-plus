import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  renderServerConfig,
  wireServerConfig,
  type ServerConfigState,
} from "../src/popup-server-config.js";

const html = readFileSync(resolve("public/popup.html"), "utf8");

const setup = () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const commits: ServerConfigState[] = [];
  wireServerConfig(doc, (state) => commits.push(state));
  return {
    doc,
    commits,
    url: doc.querySelector<HTMLInputElement>("[data-server-url]")!,
    token: doc.querySelector<HTMLInputElement>("[data-server-token]")!,
    fire: (el: HTMLElement, type: string) =>
      el.dispatchEvent(new dom.window.Event(type, { bubbles: true })),
  };
};

const waitForDebounce = () => new Promise((r) => setTimeout(r, 400));

test("saves on input without waiting for blur — the popup may close first", async () => {
  const { url, token, commits, fire } = setup();

  url.value = "https://parser.example.com";
  fire(url, "input");
  token.value = "secret";
  fire(token, "input");

  await waitForDebounce();

  assert.deepEqual(commits.at(-1), {
    url: "https://parser.example.com",
    token: "secret",
  });
});

test("does not save a half-typed URL, and does not flag it as invalid yet", async () => {
  const { url, commits, fire } = setup();

  url.value = "https:/";
  fire(url, "input");
  await waitForDebounce();

  assert.equal(commits.length, 0);
  assert.equal(url.dataset.state, undefined);
});

test("flags an unparseable URL once the field settles", () => {
  const { url, commits, fire } = setup();

  url.value = "не адрес";
  fire(url, "change");

  assert.equal(commits.length, 0);
  assert.equal(url.dataset.state, "invalid");
});

test("normalizes the origin when the field settles", () => {
  const { url, commits, fire } = setup();

  url.value = "https://parser.example.com/api/";
  fire(url, "change");

  assert.equal(url.value, "https://parser.example.com");
  assert.deepEqual(commits.at(-1), {
    url: "https://parser.example.com",
    token: "",
  });
});

test("clearing the field commits an empty origin — back to the local server", () => {
  const { url, commits, fire } = setup();

  url.value = "";
  fire(url, "change");

  assert.deepEqual(commits.at(-1), { url: "", token: "" });
});

test("renderServerConfig leaves the focused field alone", () => {
  const { doc, url, token } = setup();

  url.value = "typing…";
  url.focus();
  renderServerConfig(doc, { url: "https://other.example.com", token: "t" });

  assert.equal(url.value, "typing…");
  assert.equal(token.value, "t");
});

test("paste button fills the field from the clipboard and saves it", async () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const commits: ServerConfigState[] = [];

  Object.defineProperty(dom.window.navigator, "clipboard", {
    value: { readText: async () => "  https://parser.example.com/  " },
    configurable: true,
  });
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });

  try {
    wireServerConfig(doc, (state) => commits.push(state));
    const button = doc.querySelector<HTMLButtonElement>('[data-server-paste="url"]')!;
    button.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    const url = doc.querySelector<HTMLInputElement>("[data-server-url]")!;
    assert.equal(url.value, "https://parser.example.com");
    assert.deepEqual(commits.at(-1), {
      url: "https://parser.example.com",
      token: "",
    });
    assert.equal(button.dataset.state, "done");
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  }
});

test("paste button reports failure when the clipboard is unreadable", async () => {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  Object.defineProperty(dom.window.navigator, "clipboard", {
    value: {
      readText: async () => {
        throw new Error("denied");
      },
    },
    configurable: true,
  });
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });

  try {
    wireServerConfig(doc, () => {});
    const button = doc.querySelector<HTMLButtonElement>('[data-server-paste="token"]')!;
    button.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 20));

    assert.equal(button.dataset.state, "failed");
  } finally {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
    });
  }
});
