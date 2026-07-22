import 'dotenv/config';
import { disconnectDatabase } from '@quran-hajrah/database';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { installProcessHandlers } from './lifecycle.js';
import { createLogger } from './logger.js';

const config = loadConfig();
const logger = createLogger(config.logLevel);
const server = createApp({ config, logger }).listen(config.port, () => {
  logger.info({ event: 'server_started', port: config.port, environment: config.nodeEnv });
});

installProcessHandlers(server, disconnectDatabase, logger);
