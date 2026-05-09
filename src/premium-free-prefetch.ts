import type {
  PremiumFreeClientResolveResult,
  RemangaChapterReference,
} from "./premium-free.js";

export type PremiumFreeResolverFn = (
  reference: RemangaChapterReference,
  controller: AbortController,
) => Promise<PremiumFreeClientResolveResult>;

export type PremiumFreePrewarmImageFn = (proxyUrl: string) => Promise<unknown>;

export type PremiumFreePrewarmOptions = {
  prewarmImage?: PremiumFreePrewarmImageFn;
};

let prewarmedKeys = new Set<string>();

export const resetPremiumFreePrefetchDedup = (): void => {
  prewarmedKeys = new Set();
};

const buildKey = (reference: RemangaChapterReference): string => {
  const id =
    typeof reference.chapterId === "number" ? String(reference.chapterId) : "?";
  return `${reference.titleDir}|${id}|${reference.chapter}`;
};

export const prewarmPremiumFreeChapter = async (
  reference: RemangaChapterReference,
  resolve: PremiumFreeResolverFn,
  options?: PremiumFreePrewarmOptions,
): Promise<void> => {
  const key = buildKey(reference);
  if (prewarmedKeys.has(key)) return;
  prewarmedKeys.add(key);

  const controller = new AbortController();
  let result: PremiumFreeClientResolveResult;
  try {
    result = await resolve(reference, controller);
  } catch {
    prewarmedKeys.delete(key);
    return;
  }

  if (result.status !== "success") {
    prewarmedKeys.delete(key);
    return;
  }

  const prewarmImage = options?.prewarmImage;
  if (!prewarmImage) return;

  await Promise.all(
    result.pages.map(async (page) => {
      if (typeof page.proxyUrl !== "string" || !page.proxyUrl) return;
      try {
        await prewarmImage(page.proxyUrl);
      } catch {
        /* swallow individual image-prewarm errors */
      }
    }),
  );
};
