import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import type { AppConfig } from './config.js';
import type { IdentityStore } from './identity/store.js';
import { permissionCodes } from './identity/types.js';
import { verifyAccessToken } from './identity/security.js';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_FAILED',
  ) {
    super(message);
  }
}

export const asyncRoute =
  (handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (request, response, next) => {
    void handler(request, response, next).catch(next);
  };

export const requestContext: RequestHandler = (request, _response, next) => {
  request.context = {
    ipAddress: request.ip,
    userAgent: request.get('user-agent'),
  };
  next();
};

export const validate = (schema: ZodTypeAny, target: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (request, _response, next) => {
    const result = schema.safeParse(request[target]);
    if (!result.success) return next(new AppError(400, 'Invalid request data.', 'VALIDATION_ERROR'));
    request[target] = result.data;
    next();
  };

export const requireAuth = (store: IdentityStore, config: AppConfig): RequestHandler =>
  asyncRoute(async (request, _response, next) => {
    const authorization = request.get('authorization');
    if (!authorization?.startsWith('Bearer ')) throw new AppError(401, 'Authentication required.', 'UNAUTHENTICATED');
    try {
      const userId = await verifyAccessToken(authorization.slice(7), config);
      const user = await store.findUserById(userId);
      if (!user?.isActive) throw new AppError(401, 'Authentication required.', 'UNAUTHENTICATED');
      request.identity = user;
      next();
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'Authentication required.', 'UNAUTHENTICATED');
    }
  });

export const requirePermission = (code: string): RequestHandler => (request, _response, next) => {
  if (!request.identity || !permissionCodes(request.identity).includes(code)) {
    return next(new AppError(403, 'Insufficient permission.', 'FORBIDDEN'));
  }
  next();
};

export const requireAnyPermission = (...codes: string[]): RequestHandler => (request, _response, next) => {
  const available = request.identity ? permissionCodes(request.identity) : [];
  if (!codes.some((code) => available.includes(code))) return next(new AppError(403, 'Insufficient permission.', 'FORBIDDEN'));
  next();
};

export const errorHandler = (nodeEnv: string): ErrorRequestHandler => (error, _request, response, next) => {
  void next;
  const status = error instanceof AppError ? error.status : 500;
  const message = error instanceof AppError ? error.message : 'An unexpected error occurred.';
  const code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
  const body: Record<string, unknown> = { error: { code, message } };
  if (nodeEnv !== 'production' && error instanceof Error && status === 500) body.error = { code, message, stack: error.stack };
  response.status(status).json(body);
};
