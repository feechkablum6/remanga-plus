import type { FastifyInstance } from "fastify";
import type { TitleOverride } from "../config.js";
import { resolveExternalChapter } from "../resolve-chapter.js";
import type { ProviderRegistry } from "../providers/registry.js";
import type { RemangaChapterReference } from "../providers/provider.interface.js";
import type { ResolveSessionStore } from "../resolve-session.js";

interface ResolveBody {
  remanga?: RemangaChapterReference;
  forcedBranchId?: string;
  disabledProviders?: string[];
}

export function registerChapterResolveRoute(
  app: FastifyInstance,
  registry: ProviderRegistry,
  imageMap: Map<string, { provider: string; imageRef: string }>,
  providerPriority: readonly string[],
  titleOverrides: Record<string, TitleOverride>,
  sessionStore: ResolveSessionStore,
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

    const forcedBranchId =
      typeof request.body?.forcedBranchId === "string" && request.body.forcedBranchId.length > 0
        ? request.body.forcedBranchId
        : undefined;

    const disabledSet = new Set(
      Array.isArray(request.body?.disabledProviders)
        ? request.body.disabledProviders.filter((p): p is string => typeof p === "string")
        : [],
    );

    const activePriority = disabledSet.size > 0
      ? providerPriority.filter((name) => !disabledSet.has(name))
      : providerPriority;

    if (activePriority.length === 0) {
      return reply.code(400).send({ error: "All providers are disabled" });
    }

    const session = sessionStore.create(activePriority);

    resolveExternalChapter({
      remanga,
      providers: registry.getAll(),
      providerPriority: activePriority,
      titleOverrides,
      ...(forcedBranchId ? { forcedBranchId } : {}),
      onProgress: (providerName, status, extra) => {
        sessionStore.updateProviderStatus(session.sessionId, providerName, status, extra);
      },
    }).then((result) => {
      if (result.status === "success") {
        result.pages.forEach((page) => {
          const proxyId = `${result.provider}:${result.matchedChapter.chapterId}:${page.index}`;
          imageMap.set(proxyId, {
            provider: result.provider,
            imageRef: page.imageRef,
          });
        });

        sessionStore.setFinalResult(session.sessionId, {
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
          ...(result.branches ? { branches: result.branches } : {}),
          ...(result.selectedBranchId ? { selectedBranchId: result.selectedBranchId } : {}),
        });
      } else {
        sessionStore.setFinalResult(session.sessionId, result);
      }
    });

    return reply.code(202).send({ sessionId: session.sessionId });
  });

  app.get<{ Params: { sessionId: string } }>(
    "/api/chapters/progress/:sessionId",
    async (request, reply) => {
      const session = sessionStore.get(request.params.sessionId);
      if (!session) {
        return reply.code(404).send({ error: "Session not found" });
      }
      return reply.code(200).send({
        sessionId: session.sessionId,
        providers: session.providers,
        complete: session.finalResult !== null,
      });
    },
  );

  app.get<{ Params: { sessionId: string } }>(
    "/api/chapters/result/:sessionId",
    async (request, reply) => {
      const session = sessionStore.get(request.params.sessionId);
      if (!session) {
        return reply.code(404).send({ error: "Session not found" });
      }
      if (session.finalResult === null) {
        return reply.code(202).send({ status: "pending" });
      }
      return reply.code(200).send(session.finalResult);
    },
  );
}