import { test } from "node:test";
import assert from "node:assert/strict";

import { mapServerProgressToChips } from "../src/premium-free.js";

const statusOf = (
  providers: Record<string, { status: string; reason?: string }>,
  name: string,
): string | undefined =>
  mapServerProgressToChips(providers).find((chip) => chip.name === name)?.status;

test("a source without this chapter reads as 'not_found', not as a failure", () => {
  const chips = {
    inkstory: { status: "failed", reason: "chapter_not_found" },
    telemanga: { status: "failed", reason: "chapter_not_found" },
    senkuro: { status: "failed", reason: "no_match" },
  };

  assert.equal(statusOf(chips, "inkstory"), "not_found");
  assert.equal(statusOf(chips, "telemanga"), "not_found");
  assert.equal(statusOf(chips, "senkuro"), "not_found");
});

test("a genuinely broken source still reads as 'provider_error'", () => {
  const chips = {
    teletype: { status: "failed", reason: "provider_error" },
    mangabuff: { status: "failed" },
  };

  assert.equal(statusOf(chips, "teletype"), "provider_error");
  assert.equal(statusOf(chips, "mangabuff"), "provider_error");
});

test("in-flight and successful states are passed through", () => {
  const chips = {
    wamanga: { status: "success" },
    usagi: { status: "searching" },
    inkstory: { status: "loading_chapters" },
    senkuro: { status: "parsing" },
    telemanga: { status: "pending" },
  };

  assert.equal(statusOf(chips, "wamanga"), "success");
  assert.equal(statusOf(chips, "usagi"), "searching");
  assert.equal(statusOf(chips, "inkstory"), "loading_chapters");
  assert.equal(statusOf(chips, "senkuro"), "parsing");
  assert.equal(statusOf(chips, "telemanga"), "pending");
});

test("chips carry the human-readable provider name", () => {
  const chips = mapServerProgressToChips({ wamanga: { status: "success" } });
  assert.equal(chips[0]?.displayName, "WaManga");
});
