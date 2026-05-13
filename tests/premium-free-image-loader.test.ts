import assert from "node:assert/strict";
import test from "node:test";

import {
  clearPremiumFreeImageCache,
  fetchPremiumFreeImageBlobUrl,
  isPremiumFreeImageCached,
  subscribePremiumFreeImageLoad,
} from "../src/premium-free-image-loader.js";
import { PROXY_IMAGE_MESSAGE_TYPE } from "../src/parser-server.js";

const ONE_PIXEL_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2w==";

const installChromeResponse = (response: unknown): void => {
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      sendMessage(message: unknown, callback: (response: unknown) => void) {
        assert.deepEqual(message, {
          type: PROXY_IMAGE_MESSAGE_TYPE,
          proxyPath: "/api/images/demo:1:0",
        });
        callback(response);
      },
    },
  };
};

test("fetchPremiumFreeImageBlobUrl caches a successful proxy response and emits success", async () => {
  clearPremiumFreeImageCache();
  const originalCreateObjectURL = URL.createObjectURL;
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: () => "blob:rre-test",
  });
  installChromeResponse({ data: ONE_PIXEL_JPEG });

  const events: Array<{ proxyPath: string; success: boolean }> = [];
  const unsubscribe = subscribePremiumFreeImageLoad((event) => events.push(event));

  const first = await fetchPremiumFreeImageBlobUrl("/api/images/demo:1:0");
  const second = await fetchPremiumFreeImageBlobUrl("/api/images/demo:1:0");

  assert.equal(first, "blob:rre-test");
  assert.equal(second, "blob:rre-test");
  assert.equal(isPremiumFreeImageCached("/api/images/demo:1:0"), true);
  assert.deepEqual(events, [
    { proxyPath: "/api/images/demo:1:0", success: true },
    { proxyPath: "/api/images/demo:1:0", success: true },
  ]);

  unsubscribe();
  clearPremiumFreeImageCache();
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: originalCreateObjectURL,
  });
});

test("fetchPremiumFreeImageBlobUrl emits failure for malformed responses", async () => {
  clearPremiumFreeImageCache();
  installChromeResponse({ data: "not-a-data-url" });
  const events: Array<{ proxyPath: string; success: boolean }> = [];
  const unsubscribe = subscribePremiumFreeImageLoad((event) => events.push(event));

  const result = await fetchPremiumFreeImageBlobUrl("/api/images/demo:1:0");

  assert.equal(result, null);
  assert.deepEqual(events, [{ proxyPath: "/api/images/demo:1:0", success: false }]);

  unsubscribe();
  clearPremiumFreeImageCache();
});
