import type { Logger } from './logger.js';

type ClosableServer = { close(callback: (error?: Error) => void): unknown };

export const gracefulShutdown = async (
  server: ClosableServer,
  disconnect: () => Promise<void>,
  logger: Logger,
  signal: string,
) => {
  logger.info({ event: 'shutdown_started', signal });
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await disconnect();
  logger.info({ event: 'shutdown_completed', signal });
};

export const installProcessHandlers = (
  server: ClosableServer,
  disconnect: () => Promise<void>,
  logger: Logger,
) => {
  let shuttingDown = false;
  const shutdown = (signal: string, exitCode: number) => {
    if (shuttingDown) return;
    shuttingDown = true;
    void gracefulShutdown(server, disconnect, logger, signal)
      .then(() => { process.exitCode = exitCode; })
      .catch((error: unknown) => {
        logger.error({ event: 'shutdown_failed', signal, error: error instanceof Error ? error.message : 'Unknown error' });
        process.exitCode = 1;
      });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM', 0));
  process.once('SIGINT', () => shutdown('SIGINT', 0));
  process.once('uncaughtException', (error) => {
    logger.error({ event: 'uncaught_exception', error: error.message });
    shutdown('uncaughtException', 1);
  });
  process.once('unhandledRejection', (reason) => {
    logger.error({ event: 'unhandled_rejection', error: reason instanceof Error ? reason.message : 'Unhandled rejection' });
    shutdown('unhandledRejection', 1);
  });
};
