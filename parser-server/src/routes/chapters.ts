import type { FastifyInstance } from "fastify";
import type { TitleOverride } from "../config.js";
import { resolveExternalChapter } from "../resolve-chapter.js";
import type { ProviderRegistry } from "../providers/registry.js";
import type { RemangaChapterReference } from "../providers/provider.interface.js";

interface ResolveBody {
  remanga?: RemangaChapterReference;
}

const getStatusCode = (reason: string): number => {
  if (reason === "provider_error") {
    return 502;
  }

  return 404;
};

export function registerChapterResolveRoute(
  app: FastifyInstance,
  registry: ProviderRegistry,
  imageMap: Map<string, { provider: string; imageRef: string }>,
  providerPriority: readonly string[],
  titleOverrides: Record<string, TitleOverride>,
): void {
  app.post<{ Body: ResolveBody }>("/api/chapters/resolve", async (request, reply) => {
    const remanga = request.body?.remanga;
    if (
      !remanga ||
      typeof remanga.titleDir !== "string" ||
      typeof remanga.titleName !== "string" ||
      typeof remanga.chapter !== "string" ||
      typeof remanga.chapterUrl !== "string" ||
      !Array.isArray(remanga.aliases)
    ) {
      return reply.code(400).send({ error: "Missing required field: remanga" });
    }

    const result = await resolveExternalChapter({
      remanga,
      providers: registry.getAll(),
      providerPriority,
      titleOverrides,
    });

    if (result.status === "failure") {
      return reply.code(getStatusCode(result.reason)).send(result);
    }

    result.pages.forEach((page) => {
      const proxyId = `${result.provider}:${result.matchedChapter.chapterId}:${page.index}`;
      imageMap.set(proxyId, {
        provider: result.provider,
        imageRef: page.imageRef,
      });
    });

    return reply.code(200).send({
      status: "success",
      provider: result.provider,
      matchedTitle: result.matchedTitle,
      matchedChapter: result.matchedChapter,
      manualUrl: result.manualUrl,
      nextChapter: result.nextChapter,
      totalPages: result.totalPages,
      pages: result.pages.map((page) => ({
        index: page.index,
        proxyUrl: `/api/images/${result.provider}:${result.matchedChapter.chapterId}:${page.index}`,
      })),
    });
  });
}
