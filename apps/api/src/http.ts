import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodIssue, ZodTypeAny } from 'zod';
import type { AppConfig } from './config.js';
import type { IdentityStore } from './identity/store.js';
import { permissionCodes } from './identity/types.js';
import { verifyAccessToken } from './identity/security.js';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'REQUEST_FAILED',
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export type ValidationFieldError = {
  field: string;
  label: string;
  code: string;
  message: string;
};

const validationFieldLabels: Record<string, string> = {
  title: 'عنوان المستند',
  description: 'الوصف',
  categoryId: 'التصنيف',
  documentType: 'نوع المستند',
  documentNumber: 'رقم المستند',
  documentDate: 'تاريخ المستند',
  effectiveDate: 'تاريخ السريان',
  expiryDate: 'تاريخ الانتهاء',
  status: 'الحالة',
  confidentialityLevel: 'مستوى السرية',
  owningDepartment: 'الإدارة المالكة',
  keywords: 'الكلمات المفتاحية',
  tags: 'الوسوم',
  file: 'الملف',
};

const fieldErrorMessage = (issue: ZodIssue, label: string) => {
  switch (String(issue.code)) {
    case 'invalid_type':
      return `${label}: القيمة مطلوبة أو نوعها غير صحيح.`;
    case 'invalid_enum_value':
    case 'invalid_value':
      return `${label}: الاختيار غير معتمد.`;
    case 'invalid_string':
    case 'invalid_format':
      return `${label}: التنسيق غير صحيح.`;
    case 'too_small':
      return `${label}: القيمة أقصر أو أقل من الحد المطلوب.`;
    case 'too_big':
      return `${label}: القيمة تتجاوز الحد المسموح.`;
    case 'unrecognized_keys':
      return 'يحتوي الطلب على حقول غير مسموحة.';
    case 'custom':
      return issue.message;
    default:
      return `${label}: القيمة غير صالحة.`;
  }
};

const validationFields = (issues: ZodIssue[]): ValidationFieldError[] =>
  issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : 'request';
    const rootField = String(issue.path[0] ?? 'request');
    const label = validationFieldLabels[rootField] ?? rootField;
    return {
      field,
      label,
      code: String(issue.code),
      message: fieldErrorMessage(issue, label),
    };
  });

export const asyncRoute =
  (
    handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>,
  ): RequestHandler =>
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

export const validate =
  (schema: ZodTypeAny, target: 'body' | 'query' | 'params' = 'body'): RequestHandler =>
  (request, _response, next) => {
    const result = schema.safeParse(request[target]);
    if (!result.success) {
      const fields = validationFields(result.error.issues);
      if (process.env.NODE_ENV !== 'test') {
        console.error(
          JSON.stringify({
            event: 'request_validation_failed',
            method: request.method,
            path: request.originalUrl.split('?')[0],
            target,
            fields,
          }),
        );
      }
      return next(
        new AppError(
          400,
          'تعذر التحقق من بيانات الطلب. راجع الحقول الموضحة.',
          'VALIDATION_ERROR',
          { fields },
        ),
      );
    }
    request[target] = result.data;
    next();
  };

export const requireAuth = (store: IdentityStore, config: AppConfig): RequestHandler =>
  asyncRoute(async (request, _response, next) => {
    const authorization = request.get('authorization');
    if (!authorization?.startsWith('Bearer '))
      throw new AppError(401, 'Authentication required.', 'UNAUTHENTICATED');
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

export const requirePermission =
  (code: string): RequestHandler =>
  (request, _response, next) => {
    if (!request.identity || !permissionCodes(request.identity).includes(code)) {
      return next(new AppError(403, 'Insufficient permission.', 'FORBIDDEN'));
    }
    next();
  };

export const requireAnyPermission =
  (...codes: string[]): RequestHandler =>
  (request, _response, next) => {
    const available = request.identity ? permissionCodes(request.identity) : [];
    if (!codes.some((code) => available.includes(code)))
      return next(new AppError(403, 'Insufficient permission.', 'FORBIDDEN'));
    next();
  };

export const errorHandler =
  (nodeEnv: string): ErrorRequestHandler =>
  (error, _request, response, next) => {
    void next;
    const bodyParserStatus =
      typeof error === 'object' &&
      error !== null &&
      'type' in error &&
      error.type === 'entity.too.large'
        ? 413
        : undefined;
    const status = error instanceof AppError ? error.status : (bodyParserStatus ?? 500);
    const message =
      error instanceof AppError
        ? error.message
        : status === 413
          ? 'The request body is too large.'
          : 'An unexpected error occurred.';
    const code =
      error instanceof AppError
        ? error.code
        : status === 413
          ? 'REQUEST_TOO_LARGE'
          : 'INTERNAL_ERROR';
    const errorBody: Record<string, unknown> = { code, message };
    if (error instanceof AppError && error.details) Object.assign(errorBody, error.details);
    const body: Record<string, unknown> = { error: errorBody };
    if (nodeEnv !== 'production' && error instanceof Error && status === 500)
      body.error = { code, message, stack: error.stack };
    response.status(status).json(body);
  };
