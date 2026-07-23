import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  checkDatabaseConnection,
  checkPendingMigrations,
  initializePrisma,
} from '@quran-hajrah/database';
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
import { createLogger, requestLogger, type Logger } from './logger.js';
import { PrismaDocumentStore } from './documents/prisma-store.js';
import { createDocumentRouter } from './documents/routes.js';
import { LocalStorageProvider, type StorageProvider } from './documents/storage.js';
import type { DocumentStore } from './documents/store.js';

export type AppDependencies = {
  store?: IdentityStore;
  config?: AppConfig;
  readinessChecks?: ReadinessChecks;
  logger?: Logger;
  documentStore?: DocumentStore;
  storage?: StorageProvider;
};

export type ReadinessChecks = {
  prisma: () => Promise<void>;
  database: () => Promise<void>;
  migrations: () => Promise<void>;
};

type ReadinessCheckName = keyof ReadinessChecks;
type ReadinessStatus = 'ok' | 'failed';

const safeErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://[redacted]@');
};

const setStaticHeaders = (response: express.Response, filePath: string) => {
  if (path.basename(filePath) === 'index.html') {
    response.setHeader('Cache-Control', 'no-store');
  } else if (/-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2?|png|svg|webp)$/.test(path.basename(filePath))) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
};

export const createApp = (dependencies: AppDependencies = {}) => {
  const config = dependencies.config ?? loadConfig();
  const store = dependencies.store ?? new PrismaIdentityStore();
  const readinessChecks = dependencies.readinessChecks ?? {
    prisma: initializePrisma,
    database: checkDatabaseConnection,
    migrations: checkPendingMigrations,
  };
  const logger = dependencies.logger ?? createLogger(config.logLevel);
  const documentStore = dependencies.documentStore ?? new PrismaDocumentStore();
  const storage = dependencies.storage ?? new LocalStorageProvider(config.documentStorageRoot);
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", ...config.corsOrigins],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        callback(new AppError(403, 'Origin is not allowed.', 'CORS_REJECTED'));
      },
      credentials: true,
    }),
  );
  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      limit: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(requestContext);
  app.use(requestLogger(logger));

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));
  app.get('/ready', async (request, response) => {
    const checks: Record<ReadinessCheckName, ReadinessStatus> = {
      prisma: 'failed',
      database: 'failed',
      migrations: 'failed',
    };
    logger.info({ event: 'readiness_check_started', requestId: request.requestId });
    for (const check of ['prisma', 'database', 'migrations'] as const) {
      logger.info({
        event: 'readiness_check_step',
        requestId: request.requestId,
        check,
        status: 'started',
      });
      try {
        await readinessChecks[check]();
        checks[check] = 'ok';
        logger.info({
          event: 'readiness_check_step',
          requestId: request.requestId,
          check,
          status: 'ok',
        });
      } catch (error) {
        const reason = safeErrorMessage(error);
        logger.error({
          event: 'readiness_check_failed',
          requestId: request.requestId,
          check,
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: reason,
        });
        return response
          .status(503)
          .json({ status: 'not_ready', checks, reason: `${check}: ${reason}` });
      }
    }
    logger.info({ event: 'readiness_check_completed', requestId: request.requestId, checks });
    return response.json({ status: 'ready', checks });
  });

  app.use('/api', createDocumentRouter(store, documentStore, storage, config));
  app.use('/api', createIdentityRouter(store, config));
  app.use('/api', (_request, _response, next) =>
    next(new AppError(404, 'API route not found.', 'NOT_FOUND')),
  );

  if (existsSync(config.portalDistPath)) {
    app.use('/portal', (request, response, next) => {
      if (request.originalUrl.split('?')[0] === '/portal')
        return response.redirect(308, '/portal/');
      next();
    });
    app.use(
      '/portal',
      express.static(config.portalDistPath, {
        index: false,
        redirect: false,
        setHeaders: setStaticHeaders,
      }),
    );
    app.get('/portal/*', (_request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      response.sendFile(path.join(config.portalDistPath, 'index.html'));
    });
  }

  if (existsSync(config.adminDistPath)) {
    app.use(express.static(config.adminDistPath, { index: false, setHeaders: setStaticHeaders }));
    app.get('*', (_request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      response.sendFile(path.join(config.adminDistPath, 'index.html'));
    });
  } else {
    app.use((_request, _response, next) =>
      next(new AppError(404, 'Route not found.', 'NOT_FOUND')),
    );
  }

  app.use(errorHandler(config.nodeEnv));
  return app;
};
