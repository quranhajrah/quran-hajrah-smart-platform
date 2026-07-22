import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { loadConfig, type AppConfig } from './config.js';
import { AppError, errorHandler, requestContext } from './http.js';
import { PrismaIdentityStore } from './identity/prisma-store.js';
import { createIdentityRouter } from './identity/routes.js';
import type { IdentityStore } from './identity/store.js';

export type AppDependencies = { store?: IdentityStore; config?: AppConfig };

export const createApp = (dependencies: AppDependencies = {}) => {
  const config = dependencies.config ?? loadConfig();
  const store = dependencies.store ?? new PrismaIdentityStore();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      callback(new AppError(403, 'Origin is not allowed.', 'CORS_REJECTED'));
    },
    credentials: true,
  }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(requestContext);
  app.get('/health', (_request, response) => response.json({ status: 'ok' }));
  app.use('/api', createIdentityRouter(store, config));
  app.use((_request, _response, next) => next(new AppError(404, 'Route not found.', 'NOT_FOUND')));
  app.use(errorHandler(config.nodeEnv));
  return app;
};
