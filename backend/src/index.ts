import { logger } from '@/common/logger.js';
import { startServer } from '@/server.js';

async function main() {
  const { shutdown } = await startServer();

  const bye = (signal: NodeJS.Signals) => () => {
    logger.info({ signal }, 'signal received');
    shutdown()
      .catch((err) => logger.error({ err }, 'shutdown error'))
      .finally(() => process.exit(0));
  };
  process.on('SIGTERM', bye('SIGTERM'));
  process.on('SIGINT', bye('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandledRejection'));
  process.on('uncaughtException', (err) => logger.fatal({ err }, 'uncaughtException'));
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal startup error');
  process.exit(1);
});
