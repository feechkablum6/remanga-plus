import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderServerStatus, wireRestartButton } from "../src/popup-service-status.js";

const html = readFileSync(resolve("public/popup.html"), "utf8");

test("initial state shows 'Проверка…', no restart button", () => {
  const dom = new JSDOM(html);
  renderServerStatus(dom.window.document, { kind: "checking" });
  const label = dom.window.document.querySelector("[data-server-label]");
  const btn = dom.window.document.querySelector<HTMLElement>("[data-server-restart]");
  assert.equal(label?.textContent, "Проверка…");
  assert.equal(btn?.hidden, true);
});

test("ok state shows 'Parser-server :PORT' with no restart button", () => {
  const dom = new JSDOM(html);
  renderServerStatus(dom.window.document, { kind: "ok", port: 7845 });
  const label = dom.window.document.querySelector("[data-server-label]");
  const btn = dom.window.document.querySelector<HTMLElement>("[data-server-restart]");
  const row = dom.window.document.querySelector("[data-server-status]");
  assert.equal(label?.textContent, "Parser-server :7845");
  assert.equal(btn?.hidden, true);
  assert.equal(row?.getAttribute("data-state"), "ok");
});

test("down state shows error label and visible restart button", () => {
  const dom = new JSDOM(html);
  renderServerStatus(dom.window.document, { kind: "down" });
  const label = dom.window.document.querySelector("[data-server-label]");
  const btn = dom.window.document.querySelector<HTMLElement>("[data-server-restart]");
  const row = dom.window.document.querySelector("[data-server-status]");
  assert.equal(label?.textContent, "Parser-server не запущен");
  assert.equal(btn?.hidden, false);
  assert.equal(row?.getAttribute("data-state"), "down");
});

test("busy state shows the restart button with data-state=busy", () => {
  const dom = new JSDOM(html);
  renderServerStatus(dom.window.document, { kind: "busy" });
  const btn = dom.window.document.querySelector<HTMLElement>("[data-server-restart]");
  assert.equal(btn?.hidden, false);
  assert.equal(btn?.dataset.state, "busy");
});

test("wireRestartButton calls handler on click", () => {
  const dom = new JSDOM(html);
  let clicks = 0;
  wireRestartButton(dom.window.document, () => {
    clicks++;
  });
  const btn = dom.window.document.querySelector<HTMLElement>("[data-server-restart]");
  btn?.removeAttribute("hidden");
  btn?.dispatchEvent(new dom.window.Event("click"));
  assert.equal(clicks, 1);
});

test("wireRestartButton ignores click when busy", () => {
  const dom = new JSDOM(html);
  let clicks = 0;
  wireRestartButton(dom.window.document, () => {
    clicks++;
  });
  const btn = dom.window.document.querySelector<HTMLElement>("[data-server-restart]");
  btn?.removeAttribute("hidden");
  if (btn) btn.dataset.state = "busy";
  btn?.dispatchEvent(new dom.window.Event("click"));
  assert.equal(clicks, 0);
});
