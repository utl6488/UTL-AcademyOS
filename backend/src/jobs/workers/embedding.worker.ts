import { Worker } from 'bullmq';

import { logger } from '@/common/logger.js';
import { getPrisma, withTenant } from '@/db/prisma.js';
import { getRedis } from '@/db/redis.js';
import type { EmbeddingJobData } from '@/jobs/embedding.queue.js';
import { QueueName } from '@/jobs/queues.js';
import { pickProvider } from '@/modules/ai/providers/index.js';

/**
 * Compute an embedding and upsert into the `Embedding` table. `vector` is a
 * pgvector column typed `Unsupported` in Prisma, so we go through raw SQL.
 * The `(tenantId, sourceType, sourceId, model)` unique constraint means we can
 * safely `ON CONFLICT` re-write the vector on every run.
 */
export function startEmbeddingWorker(): Worker<EmbeddingJobData> {
  const worker = new Worker<EmbeddingJobData>(
    QueueName.EMBEDDING,
    async (job) => {
      const { tenantId, sourceType, sourceId, text } = job.data;
      if (!text.trim()) {
        logger.debug({ tenantId, sourceType, sourceId }, 'embedding: empty text, skip');
        return;
      }
      const provider = pickProvider();
      const embed = await provider.embed(text);

      // pgvector literal format is `[a,b,c,...]`. No spaces required. Bind as a
      // text parameter and cast with ::vector so we don't have to build the SQL
      // string.
      const literal = `[${embed.vector.join(',')}]`;
      const id = `${sourceType}:${sourceId}:${embed.model}`.slice(0, 30);

      await withTenant({ tenantId, bypass: true }, async () => {
        await getPrisma().$executeRawUnsafe(
          `INSERT INTO "Embedding" ("id", "tenantId", "sourceType", "sourceId", "model", "vector", "createdAt")
           VALUES ($1, $2, $3, $4, $5, $6::vector, NOW())
           ON CONFLICT ("tenantId", "sourceType", "sourceId", "model")
           DO UPDATE SET "vector" = EXCLUDED."vector", "createdAt" = NOW()`,
          id,
          tenantId,
          sourceType,
          sourceId,
          embed.model,
          literal,
        );
      });

      logger.debug(
        { tenantId, sourceType, sourceId, provider: embed.provider, latencyMs: embed.latencyMs },
        'embedding: upserted',
      );
    },
    { connection: getRedis(), concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, jobId: job?.id }, 'embedding job failed');
  });

  return worker;
}
