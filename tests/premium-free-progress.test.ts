import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  createProgressTracker,
  type ProgressEmitter,
} from "../src/premium-free-progress.js";

type FakeNode = {
  tagName: string;
  textContent: string;
  attributes: Record<string, string>;
  style: Record<string, string>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  remove(): void;
  appendChild(node: FakeNode): FakeNode;
};

const fakeEmitter = (): {
  subscribe: ProgressEmitter;
  emit: (proxyPath: string, success: boolean) => void;
  listenerCount: () => number;
} => {
  const listeners: Array<(e: { proxyPath: string; success: boolean }) => void> = [];
  return {
    subscribe: (listener) => {
      listeners.push(listener);
      return () => {
        const i = listeners.indexOf(listener);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    emit: (proxyPath, success) =>
      listeners.forEach((l) => l({ proxyPath, success })),
    listenerCount: () => listeners.length,
  };
};

const installDocStub = (): { body: FakeNode[] } => {
  const body: FakeNode[] = [];
  const make = (): FakeNode => {
    const node: FakeNode = {
      tagName: "DIV",
      textContent: "",
      attributes: {},
      style: {},
      setAttribute(name, value) { node.attributes[name] = value; },
      removeAttribute(name) { delete node.attributes[name]; },
      remove() {
        const idx = body.indexOf(node);
        if (idx >= 0) body.splice(idx, 1);
      },
      appendChild(child) { body.push(child); return child; },
    };
    return node;
  };
  (globalThis as unknown as { document: unknown; window: unknown }).document = {
    body: { appendChild: (n: FakeNode) => { body.push(n); return n; } },
    createElement: (_tag: string) => make(),
    querySelector: (selector: string) => {
      const m = selector.match(/\[data-rre-control="([^"]+)"\]/);
      if (!m) return null;
      const value = m[1];
      return body.find((n) => n.attributes["data-rre-control"] === value) ?? null;
    },
  };
  (globalThis as unknown as { window: unknown }).window = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };
  return { body };
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const findChip = (body: FakeNode[]): FakeNode | undefined =>
  body.find((n) => n.attributes["data-rre-control"] === "premium-free-progress");

test("tracker counts unique successful loads", () => {
  installDocStub();
  const e = fakeEmitter();
  const tracker = createProgressTracker({ total: 3, subscribe: e.subscribe });

  e.emit("a", true);
  e.emit("a", true); // duplicate — must not increment
  e.emit("b", false); // error counts as completed

  assert.equal(tracker.snapshot().loaded, 2);
  assert.equal(tracker.snapshot().total, 3);
  tracker.dispose();
});

test("chip appears after 500ms when loaded < total", async () => {
  const dom = installDocStub();
  const e = fakeEmitter();
  const tracker = createProgressTracker({ total: 5, subscribe: e.subscribe });

  e.emit("a", true);
  await wait(550);
  const chip = findChip(dom.body);
  assert.ok(chip, "chip should appear after 500ms");
  assert.match(chip!.textContent, /1\s*\/\s*5/);
  tracker.dispose();
});

test("chip does not appear if loaded === total before 500ms", async () => {
  const dom = installDocStub();
  const e = fakeEmitter();
  const tracker = createProgressTracker({ total: 1, subscribe: e.subscribe });

  e.emit("only", true);
  await wait(600);
  const chip = findChip(dom.body);
  assert.equal(chip, undefined);
  tracker.dispose();
});

test("chip hides 1000ms after loaded === total", async () => {
  const dom = installDocStub();
  const e = fakeEmitter();
  const tracker = createProgressTracker({ total: 2, subscribe: e.subscribe });

  e.emit("a", true);
  await wait(550);
  const beforeComplete = findChip(dom.body);
  assert.ok(beforeComplete);

  e.emit("b", true);
  await wait(1100);

  const after = findChip(dom.body);
  assert.ok(
    !after || after.attributes["data-rre-motion-state"] === "hidden",
    "chip should be removed or marked hidden after 1000ms post-completion",
  );
  tracker.dispose();
});

test("dispose unsubscribes from emitter and removes chip", async () => {
  const dom = installDocStub();
  const e = fakeEmitter();
  const tracker = createProgressTracker({ total: 1, subscribe: e.subscribe });
  assert.equal(e.listenerCount(), 1);

  tracker.dispose();

  assert.equal(e.listenerCount(), 0);
  assert.equal(findChip(dom.body), undefined);
});
