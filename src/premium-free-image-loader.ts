import { PROXY_IMAGE_MESSAGE_TYPE } from "./parser-server.js";

export type PremiumFreeImageLoadEvent = {
  proxyPath: string;
  success: boolean;
};

export type PremiumFreeImageLoadListener = (event: PremiumFreeImageLoadEvent) => void;

const imageBlobCache = new Map<string, string>();
const pendingImageLoads = new Map<string, Promise<string | null>>();
const premiumFreeImageLoadListeners = new Set<PremiumFreeImageLoadListener>();

export const subscribePremiumFreeImageLoad = (
  listener: PremiumFreeImageLoadListener,
): (() => void) => {
  premiumFreeImageLoadListeners.add(listener);
  return () => {
    premiumFreeImageLoadListeners.delete(listener);
  };
};

const notifyPremiumFreeImageLoad = (event: PremiumFreeImageLoadEvent): void => {
  premiumFreeImageLoadListeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      /* listener errors must not break image loading */
    }
  });
};

export const isPremiumFreeImageCached = (proxyPath: string): boolean =>
  imageBlobCache.has(proxyPath);

export const clearPremiumFreeImageCache = (): void => {
  imageBlobCache.forEach((blobUrl) => {
    URL.revokeObjectURL?.(blobUrl);
  });
  imageBlobCache.clear();
  pendingImageLoads.clear();
};

export const fetchPremiumFreeImageBlobUrl = (proxyPath: string): Promise<string | null> => {
  const cached = imageBlobCache.get(proxyPath);
  if (cached) {
    notifyPremiumFreeImageLoad({ proxyPath, success: true });
    return Promise.resolve(cached);
  }

  const pending = pendingImageLoads.get(proxyPath);
  if (pending) return pending;

  const promise = new Promise<string | null>((resolve) => {
    chrome.runtime.sendMessage(
      { type: PROXY_IMAGE_MESSAGE_TYPE, proxyPath },
      (response: unknown) => {
        pendingImageLoads.delete(proxyPath);
        if (
          !response ||
          typeof response !== "object" ||
          !("data" in response) ||
          typeof (response as { data: unknown }).data !== "string"
        ) {
          resolve(null);
          notifyPremiumFreeImageLoad({ proxyPath, success: false });
          return;
        }

        const dataUrl = (response as { data: string }).data;
        const commaIndex = dataUrl.indexOf(",");
        if (commaIndex === -1) {
          resolve(null);
          notifyPremiumFreeImageLoad({ proxyPath, success: false });
          return;
        }

        try {
          const mimeMatch = dataUrl.substring(0, commaIndex).match(/data:([^;]+)/);
          const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const binary = atob(dataUrl.substring(commaIndex + 1));
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
          imageBlobCache.set(proxyPath, blobUrl);
          resolve(blobUrl);
          notifyPremiumFreeImageLoad({ proxyPath, success: true });
        } catch {
          resolve(null);
          notifyPremiumFreeImageLoad({ proxyPath, success: false });
        }
      },
    );
  });

  pendingImageLoads.set(proxyPath, promise);
  return promise;
};
