import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://remanga.org/",
});

(globalThis as unknown as { document: Document }).document = dom.window.document;
(globalThis as unknown as { window: typeof dom.window }).window = dom.window;
(globalThis as unknown as { HTMLElement: typeof HTMLElement }).HTMLElement =
  dom.window.HTMLElement as unknown as typeof HTMLElement;
(globalThis as unknown as { Element: typeof Element }).Element =
  dom.window.Element as unknown as typeof Element;
(globalThis as unknown as { HTMLAnchorElement: typeof HTMLAnchorElement }).HTMLAnchorElement =
  dom.window.HTMLAnchorElement as unknown as typeof HTMLAnchorElement;
