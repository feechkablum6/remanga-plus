import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

import {
  createStatusBlock,
  updateStatusBlock,
} from "../src/premium-free-status-ui.js";

const setupDom = (): { teardown: () => void } => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousDocument = globalThis.document;
  const previousWindow = (globalThis as { window?: unknown }).window;
  globalThis.document = dom.window.document as unknown as Document;
  (globalThis as { window?: unknown }).window = dom.window;
  return {
    teardown: () => {
      globalThis.document = previousDocument;
      (globalThis as { window?: unknown }).window = previousWindow;
    },
  };
};

const findChipText = (
  block: HTMLElement,
  providerName: string,
): string => {
  const chip = block.querySelector<HTMLElement>(
    `[data-rre-provider="${providerName}"]`,
  );
  if (!chip) throw new Error(`chip ${providerName} missing`);
  const nameSpan = chip.querySelector<HTMLElement>(
    '[data-rre-control="premium-free-chip-name"]',
  );
  return nameSpan?.textContent ?? "";
};

test("chip label says 'не найдено' for not_found status", () => {
  const { teardown } = setupDom();
  try {
    const block = createStatusBlock("searching");
    updateStatusBlock(block, {
      phase: "searching",
      providers: [
        {
          name: "teletype",
          displayName: "Teletype",
          status: "not_found",
        },
      ],
    });

    assert.equal(findChipText(block, "teletype"), "Teletype — не найдено");
  } finally {
    teardown();
  }
});

test("chip label says 'ошибка' for provider_error status", () => {
  const { teardown } = setupDom();
  try {
    const block = createStatusBlock("searching");
    updateStatusBlock(block, {
      phase: "searching",
      providers: [
        {
          name: "inkstory",
          displayName: "InkStory",
          status: "provider_error",
        },
      ],
    });

    assert.equal(findChipText(block, "inkstory"), "InkStory — ошибка");
  } finally {
    teardown();
  }
});

test("chip label says 'найдено' for success status", () => {
  const { teardown } = setupDom();
  try {
    const block = createStatusBlock("searching");
    updateStatusBlock(block, {
      phase: "searching",
      providers: [
        {
          name: "mangabuff",
          displayName: "Mangabuff",
          status: "success",
        },
      ],
    });

    assert.equal(findChipText(block, "mangabuff"), "Mangabuff — найдено");
  } finally {
    teardown();
  }
});

test("chip label stays plain for in-progress statuses", () => {
  const { teardown } = setupDom();
  try {
    const block = createStatusBlock("searching");
    updateStatusBlock(block, {
      phase: "searching",
      providers: [
        { name: "p1", displayName: "P1", status: "pending" },
        { name: "p2", displayName: "P2", status: "searching" },
        { name: "p3", displayName: "P3", status: "found_title" },
        { name: "p4", displayName: "P4", status: "loading_chapters" },
        { name: "p5", displayName: "P5", status: "parsing" },
      ],
    });

    assert.equal(findChipText(block, "p1"), "P1");
    assert.equal(findChipText(block, "p2"), "P2");
    assert.equal(findChipText(block, "p3"), "P3");
    assert.equal(findChipText(block, "p4"), "P4");
    assert.equal(findChipText(block, "p5"), "P5");
  } finally {
    teardown();
  }
});
