import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export type LogRecord = Record<string, unknown>;
export type Logger = {
  info(record: LogRecord): void;
  error(record: LogRecord): void;
};

export const createLogger = (level: string): Logger => ({
  info(record) {
    if (level !== 'silent') console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), ...record }));
  },
  error(record) {
    if (level !== 'silent') console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), ...record }));
  },
});

export const requestLogger = (logger: Logger): RequestHandler => (request, response, next) => {
  const startedAt = performance.now();
  request.requestId = request.get('x-request-id')?.slice(0, 100) || randomUUID();
  response.setHeader('X-Request-Id', request.requestId);
  response.on('finish', () => {
    logger.info({
      event: 'http_request',
      requestId: request.requestId,
      method: request.method,
      path: request.originalUrl.split('?')[0],
      status: response.statusCode,
      durationMs: Number((performance.now() - startedAt).toFixed(1)),
      ip: request.ip,
      ...(request.identity ? { userId: request.identity.id } : {}),
    });
  });
  next();
};
