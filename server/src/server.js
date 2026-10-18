import { config, redactSecrets } from './config/env.js';
import { connectDatabase, disconnectDatabase, ensureIndexes } from './config/db.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

// Render sends SIGTERM on every deploy; in-flight requests get this long to finish.
const SHUTDOWN_GRACE_MS = 10_000;

async function main() {
  await connectDatabase(config.mongoUri);
  logger.info(await ensureIndexes(), 'Indexes checked');
  const server = createApp().listen(config.port, () => {
    logger.info(
      { env: config.env, storage: config.storage.driver, trustProxy: config.trustProxy },
      `API listening on port ${config.port}`,
    );
    if (config.proxyDiagnostics) {
      logger.warn(
        'PROXY_DIAGNOSTICS is on: GET /api/v1/health/proxy is public. Turn it off after use.',
      );
    }
  });

  let stopping = false;
  const shutdown = (signal) => {
    if (stopping) return;
    stopping = true;
    logger.info(`${signal} received, shutting down`);
    setTimeout(() => {
      logger.warn('Shutdown grace period over, exiting');
      process.exit(1);
    }, SHUTDOWN_GRACE_MS).unref();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    server.closeIdleConnections?.();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

process.on('unhandledRejection', (reason) => {
  logger.error({ reason: redactSecrets(reason?.stack ?? reason) }, 'Unhandled promise rejection');
});

main().catch((error) => {
  // Connection errors can quote the URI; credentials and secrets are masked.
  logger.fatal({ error: redactSecrets(error?.stack ?? error) }, 'Failed to start server');
  process.exit(1);
});
