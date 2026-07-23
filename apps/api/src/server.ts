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
  const databaseUrlWasProvidedByProcess = Boolean(process.env.DATABASE_URL?.trim());
  const directUrlWasProvidedByProcess = Boolean(process.env.DIRECT_URL?.trim());
  const databaseEnvironmentModule = await import('./database-environment.js');
  if (databaseEnvironmentModule.shouldLoadDotenv(process.env.NODE_ENV)) await import('dotenv/config');

  console.log(JSON.stringify({
    level: 'info',
    time: new Date().toISOString(),
    event: 'prisma_connection_configuration',
    database: databaseEnvironmentModule.summarizeDatabaseUrl(
      'DATABASE_URL',
      process.env.DATABASE_URL,
      databaseEnvironmentModule.environmentSource(databaseUrlWasProvidedByProcess, process.env.DATABASE_URL),
    ),
    directDatabase: databaseEnvironmentModule.summarizeDatabaseUrl(
      'DIRECT_URL',
      process.env.DIRECT_URL,
      databaseEnvironmentModule.environmentSource(directUrlWasProvidedByProcess, process.env.DIRECT_URL),
    ),
  }));

  const port = Number(process.env.PORT ?? 3000);
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
  const server = app.listen(port, host);

  server.once('listening', () => {
    console.log(JSON.stringify({
      level: 'info',
      time: new Date().toISOString(),
      event: 'server_started',
      host,
      port,
      environment: config.nodeEnv,
    }));
  });
  server.once('error', fatalStartupError);
  lifecycleModule.installProcessHandlers(server, databaseModule.disconnectDatabase, logger);
};

void start().catch(fatalStartupError);
