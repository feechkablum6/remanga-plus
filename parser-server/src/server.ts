import Fastify from "fastify";
import {
  DEFAULT_PROVIDER_PRIORITY,
  DEFAULT_TITLE_OVERRIDES,
  type TitleOverride,
} from "./config.js";
import { FileCache } from "./cache/file-cache.js";
import { HttpClient } from "./http/client.js";
import { InkstoryProvider } from "./providers/inkstory.js";
import { MangabuffProvider } from "./providers/mangabuff.js";
import { SenkuroProvider } from "./providers/senkuro.js";
import { TeletypeProvider } from "./providers/teletype.js";
import { ProviderRegistry } from "./providers/registry.js";
import { ResolveSessionStore } from "./resolve-session.js";
import { registerChapterResolveRoute } from "./routes/chapters.js";
import { registerImagesRoute } from "./routes/images.js";

export interface AppConfig {
  cacheDir: string;
  port?: number;
  host?: string;
  fetchImpl?: typeof fetch;
  providerPriority?: string[];
  titleOverrides?: Record<string, TitleOverride>;
}

export function buildApp(config: AppConfig) {
  const app = Fastify({ logger: false });

  app.addHook("onSend", async (request, reply, payload) => {
    if (request.url.startsWith("/api/")) {
      reply.header("Access-Control-Allow-Origin", "*");
      reply.header("Access-Control-Allow-Headers", "Content-Type");
      reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      reply.header("Access-Control-Allow-Private-Network", "true");
    }

    return payload;
  });

  app.options("/api/*", async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Headers", "Content-Type");
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    reply.header("Access-Control-Allow-Private-Network", "true");
    return reply.code(204).send();
  });

  // Image ref map for proxying (maps proxyKey -> { provider, imageRef })
  const imageMap = new Map<string, { provider: string; imageRef: string }>();

  // Setup providers
  const httpClient = new HttpClient({ fetchImpl: config.fetchImpl });
  const registry = new ProviderRegistry();
  registry.register(new MangabuffProvider(httpClient));
  registry.register(new SenkuroProvider(httpClient));
  registry.register(new InkstoryProvider(httpClient));
  registry.register(new TeletypeProvider(httpClient));

  // Setup session store
  const sessionStore = new ResolveSessionStore();

  // Setup cache
  const cache = new FileCache(config.cacheDir);

  // Register routes
  registerChapterResolveRoute(
    app,
    registry,
    imageMap,
    config.providerPriority ?? DEFAULT_PROVIDER_PRIORITY,
    config.titleOverrides ?? DEFAULT_TITLE_OVERRIDES,
    sessionStore,
  );
  registerImagesRoute(app, registry, cache, imageMap);

  setInterval(() => sessionStore.prune(), 30_000);

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
