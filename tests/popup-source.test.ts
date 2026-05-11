import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve("public/popup.html"), "utf8");

test("popup.html has main screen container", () => {
  assert.match(html, /data-screen=["']main["']/);
});

test("popup.html has three drill-down screen containers", () => {
  for (const key of ["site", "reader", "premium-free"]) {
    assert.match(html, new RegExp(`data-screen=["']${key}["']`), `missing screen=${key}`);
  }
});

test("popup.html main screen has three category card slots", () => {
  for (const key of ["site", "reader", "premium-free"]) {
    assert.match(html, new RegExp(`data-card=["']${key}["']`), `missing card=${key}`);
  }
});

test("popup.html has service block (parser status + auth row + import button)", () => {
  for (const hook of [
    "data-service-block",
    "data-server-status",
    "data-server-label",
    "data-server-restart",
    "data-auth-mangalib",
    "data-auth-remanga",
    "data-import-button",
    "data-resume-banner",
  ]) {
    assert.match(html, new RegExp(hook), `missing ${hook}`);
  }
});

test("popup.html drill-down screens have back-button hooks", () => {
  for (const key of ["site", "reader", "premium-free"]) {
    assert.match(html, new RegExp(`data-back=["']${key}["']`), `missing back=${key}`);
  }
});

test("popup.html drill-down screens have toggle-list slots", () => {
  for (const key of ["site", "reader", "premium-free"]) {
    assert.match(html, new RegExp(`data-toggle-list=["']${key}["']`), `missing toggle-list=${key}`);
  }
});
