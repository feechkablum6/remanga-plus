import type { FastifyInstance } from 'fastify';
import type { ProviderRegistry } from '../providers/registry.js';
import type { FileCache } from '../cache/file-cache.js';

interface ImageParams {
  id: string;
}

export function registerImagesRoute(
  app: FastifyInstance,
  registry: ProviderRegistry,
  cache: FileCache,
  imageMap: Map<string, { provider: string; imageRef: string }>
): void {
  app.get<{ Params: ImageParams }>('/api/images/:id', async (request, reply) => {
    const { id } = request.params;

    // Try cache first
    const cached = await cache.get(id);
    if (cached) {
      return reply.type('image/jpeg').send(cached);
    }

    // Look up image reference
    const ref = imageMap.get(id);
    if (!ref) {
      return reply.code(404).send({ error: 'Image not found. Parse the chapter first.' });
    }

    // Find provider and fetch
    const provider = registry.getByName(ref.provider);
    if (!provider) {
      return reply.code(500).send({ error: `Provider ${ref.provider} not found` });
    }

    try {
      const data = await provider.fetchImage(ref.imageRef);
      await cache.set(id, data);
      return reply.type('image/jpeg').send(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.code(502).send({ error: `Failed to fetch image: ${message}` });
    }
  });
}
