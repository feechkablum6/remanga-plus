import { PROXY_IMAGE_MESSAGE_TYPE } from "./parser-server.js";

export type PremiumFreeImageLoadEvent = {
  proxyPath: string;
  success: boolean;
};

export type PremiumFreeImageLoadListener = (event: PremiumFreeImageLoadEvent) => void;

const imageBlobCache = new Map<string, string>();
const pendingImageLoads = new Map<string, Promise<string | null>>();
const premiumFreeImageLoadListeners = new Set<PremiumFreeImageLoadListener>();
const IMAGE_LOAD_MAX_ATTEMPTS = 3;

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

const decodeProxyImageResponse = (response: unknown, proxyPath: string): string | null => {
  if (
    !response ||
    typeof response !== "object" ||
    !("data" in response) ||
    typeof (response as { data: unknown }).data !== "string"
  ) {
    return null;
  }

  const dataUrl = (response as { data: string }).data;
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) {
    return null;
  }

  const mimeMatch = dataUrl.substring(0, commaIndex).match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binary = atob(dataUrl.substring(commaIndex + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
  imageBlobCache.set(proxyPath, blobUrl);
  return blobUrl;
};

const requestPremiumFreeImage = (proxyPath: string): Promise<string | null> =>
  new Promise<string | null>((resolve) => {
    chrome.runtime.sendMessage(
      { type: PROXY_IMAGE_MESSAGE_TYPE, proxyPath },
      (response: unknown) => {
        try {
          resolve(decodeProxyImageResponse(response, proxyPath));
        } catch {
          resolve(null);
        }
      },
    );
  });

export const fetchPremiumFreeImageBlobUrl = (proxyPath: string): Promise<string | null> => {
  const cached = imageBlobCache.get(proxyPath);
  if (cached) {
    notifyPremiumFreeImageLoad({ proxyPath, success: true });
    return Promise.resolve(cached);
  }

  const pending = pendingImageLoads.get(proxyPath);
  if (pending) return pending;

  const promise = (async () => {
    for (let attempt = 0; attempt < IMAGE_LOAD_MAX_ATTEMPTS; attempt += 1) {
      const blobUrl = await requestPremiumFreeImage(proxyPath);
      if (blobUrl) {
        pendingImageLoads.delete(proxyPath);
        notifyPremiumFreeImageLoad({ proxyPath, success: true });
        return blobUrl;
      }
    }

    pendingImageLoads.delete(proxyPath);
    notifyPremiumFreeImageLoad({ proxyPath, success: false });
    return null;
  })();

  pendingImageLoads.set(proxyPath, promise);
  return promise;
};
