const host = '0.0.0.0';

const serializeError = (error: unknown) => error instanceof Error ? error.message : 'Unknown startup error';

const fatalStartupError = (error: unknown): never => {
  console.error(JSON.stringify({
    level: 'fatal',
    time: new Date().toISOString(),
    event: 'startup_failed',
    error: serializeError(error),
  }));
  process.exit(1);
};

console.log(JSON.stringify({
  level: 'info',
  time: new Date().toISOString(),
  event: 'startup_initializing',
}));

const start = async () => {
  await import('dotenv/config');
  const [databaseModule, appModule, configModule, lifecycleModule, loggerModule] = await Promise.all([
    import('@quran-hajrah/database'),
    import('./app.js'),
    import('./config.js'),
    import('./lifecycle.js'),
    import('./logger.js'),
  ]);

  const config = configModule.loadConfig();
  const logger = loggerModule.createLogger(config.logLevel);
  const app = appModule.createApp({ config, logger });
  const server = app.listen(config.port, host);

  server.once('listening', () => {
    console.log(JSON.stringify({
      level: 'info',
      time: new Date().toISOString(),
      event: 'server_started',
      host,
      port: config.port,
      environment: config.nodeEnv,
    }));
  });
  server.once('error', fatalStartupError);
  lifecycleModule.installProcessHandlers(server, databaseModule.disconnectDatabase, logger);
};

void start().catch(fatalStartupError);
