import test from "node:test";
import assert from "node:assert/strict";
import { createPopupRouter, type PopupScreen } from "../src/popup-router.js";

test("router starts at main", () => {
  const router = createPopupRouter();
  assert.equal(router.current(), "main");
});

test("navigate to drill-down changes current", () => {
  const router = createPopupRouter();
  router.navigate("site");
  assert.equal(router.current(), "site");
});

test("back from drill-down returns to main", () => {
  const router = createPopupRouter();
  router.navigate("reader");
  router.back();
  assert.equal(router.current(), "main");
});

test("back from main is no-op", () => {
  const router = createPopupRouter();
  router.back();
  assert.equal(router.current(), "main");
});

test("subscribe is called on navigate", () => {
  const router = createPopupRouter();
  const seen: PopupScreen[] = [];
  router.subscribe((screen) => seen.push(screen));
  router.navigate("premium-free");
  router.back();
  assert.deepEqual(seen, ["premium-free", "main"]);
});

test("subscribe is not called when navigating to current screen", () => {
  const router = createPopupRouter();
  const seen: PopupScreen[] = [];
  router.subscribe((screen) => seen.push(screen));
  router.navigate("main");
  assert.deepEqual(seen, []);
});

test("unsubscribe stops notifications", () => {
  const router = createPopupRouter();
  const seen: PopupScreen[] = [];
  const unsub = router.subscribe((screen) => seen.push(screen));
  router.navigate("site");
  unsub();
  router.navigate("reader");
  assert.deepEqual(seen, ["site"]);
});
