import { createServer, type Server as HttpServer } from 'node:http';

import { createApp } from '@/app.js';
import { logger } from '@/common/logger.js';
import { initSentry } from '@/common/sentry.js';
import { env } from '@/config/env.js';
import { disconnectPrisma, getPrisma } from '@/db/prisma.js';
import { disconnectRedis, getRedis } from '@/db/redis.js';
import { closeAllQueues } from '@/jobs/queues.js';
import { startWorkers, stopWorkers } from '@/jobs/workers/index.js';
import { createSocketServer } from '@/sockets/index.js';

interface Started {
  http: HttpServer;
  shutdown: () => Promise<void>;
}

export async function startServer(): Promise<Started> {
  initSentry();

  // Warm connections early so /ready reflects true state.
  getPrisma();
  getRedis();

  const app = createApp();
  const http = createServer(app);
  createSocketServer(http);

  startWorkers();

  await new Promise<void>((resolve) => {
    http.listen(env.PORT, () => {
      logger.info(
        { port: env.PORT, env: env.NODE_ENV },
        `backend listening on http://localhost:${env.PORT}`,
      );
      resolve();
    });
  });

  const shutdown = async () => {
    logger.info('shutting down…');
    await new Promise<void>((resolve, reject) =>
      http.close((err) => (err ? reject(err) : resolve())),
    );
    await stopWorkers();
    await closeAllQueues();
    await disconnectPrisma();
    await disconnectRedis();
    logger.info('bye');
  };

  return { http, shutdown };
}
