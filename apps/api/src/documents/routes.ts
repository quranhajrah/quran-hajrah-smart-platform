import express, { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { asyncRoute, requireAuth, requirePermission, validate } from '../http.js';
import type { IdentityStore } from '../identity/store.js';
import { decodeFileNameHeader } from './security.js';
import { DocumentService } from './service.js';
import type { StorageProvider } from './storage.js';
import type { DocumentStore } from './store.js';
import {
  confidentialityLevels,
  documentStatuses,
  documentTypes,
  toPublicDocument,
  toPublicVersion,
} from './types.js';

const idParams = z.object({ id: z.string().uuid() }).strict();
const editableDocumentStatuses = ['DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'EXPIRED'] as const;
const optionalDate = z
  .string()
  .date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .optional();
const tags = z.array(z.string().trim().min(1).max(60)).max(20).default([]);
const documentFields = z
  .object({
    title: z.string().trim().min(2).max(240),
    description: z.string().trim().max(4000).optional(),
    categoryId: z.string().uuid(),
    documentType: z.enum(documentTypes),
    documentNumber: z.string().trim().max(100).optional(),
    documentDate: optionalDate,
    effectiveDate: optionalDate,
    expiryDate: optionalDate,
    status: z.enum(editableDocumentStatuses).default('DRAFT'),
    confidentialityLevel: z.enum(confidentialityLevels).default('INTERNAL'),
    owningDepartment: z.string().trim().min(2).max(160),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    tags,
  })
  .strict()
  .refine(
    (value) =>
      !value.effectiveDate ||
      !value.expiryDate ||
      value.expiryDate.getTime() >= value.effectiveDate.getTime(),
    { message: 'Expiry date must not precede the effective date.' },
  );

const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(2).max(240).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    categoryId: z.string().uuid().optional(),
    documentType: z.enum(documentTypes).optional(),
    documentNumber: z.string().trim().max(100).nullable().optional(),
    documentDate: optionalDate.nullable(),
    effectiveDate: optionalDate.nullable(),
    expiryDate: optionalDate.nullable(),
    status: z.enum(editableDocumentStatuses).optional(),
    confidentialityLevel: z.enum(confidentialityLevels).optional(),
    owningDepartment: z.string().trim().min(2).max(160).optional(),
    keywords: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    tags: tags.optional(),
  })
  .strict();

const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    categoryId: z.string().uuid().optional(),
    documentType: z.enum(documentTypes).optional(),
    status: z.enum(documentStatuses).optional(),
    owningDepartment: z.string().trim().max(160).optional(),
    confidentialityLevel: z.enum(confidentialityLevels).optional(),
    dateFrom: optionalDate,
    dateTo: optionalDate,
    archived: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();

const auditPagination = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

const safeAttachmentHeader = (fileName: string) => {
  const extension =
    fileName
      .split('.')
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, '') ?? 'bin';
  return `attachment; filename="document.${extension}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};

export const createDocumentRouter = (
  identityStore: IdentityStore,
  documentStore: DocumentStore,
  storage: StorageProvider,
  config: AppConfig,
) => {
  const router = Router();
  const authenticated = requireAuth(identityStore, config);
  const service = new DocumentService(documentStore, storage, config.documentMaxFileSizeBytes);
  const uploadBody = express.raw({
    type: () => true,
    limit: config.documentMaxFileSizeBytes,
  });

  router.use(['/documents', '/document-categories'], authenticated);

  router.get(
    '/document-categories',
    requirePermission('documents.view'),
    asyncRoute(async (_request, response) => response.json(await service.listCategories())),
  );

  router.get(
    '/documents/dashboard',
    requirePermission('documents.view'),
    asyncRoute(async (request, response) => {
      const metrics = await service.dashboard(request.identity!);
      response.json({ ...metrics, recent: metrics.recent.map(toPublicDocument) });
    }),
  );

  router.get(
    '/documents',
    requirePermission('documents.view'),
    validate(listSchema, 'query'),
    asyncRoute(async (request, response) => {
      const result = await service.list(request.query as never, request.identity!);
      response.json({ ...result, items: result.items.map(toPublicDocument) });
    }),
  );

  router.post(
    '/documents',
    requirePermission('documents.create'),
    validate(documentFields),
    asyncRoute(async (request, response) => {
      const document = await service.create(request.body, request.identity!, request.context);
      response.status(201).json(toPublicDocument(document));
    }),
  );

  router.put(
    '/documents/:id/file',
    requirePermission('documents.upload'),
    validate(idParams, 'params'),
    uploadBody,
    asyncRoute(async (request, response) => {
      const result = await service.upload(
        String(request.params.id),
        {
          data: request.body,
          originalFileName: decodeFileNameHeader(request.get('x-file-name')),
          mimeType: request.get('content-type') ?? '',
        },
        request.identity!,
        request.context,
      );
      response.status(201).json({
        document: toPublicDocument(result.document),
        version: toPublicVersion(result.version),
      });
    }),
  );

  router.post(
    '/documents/:id/versions',
    requirePermission('documents.upload'),
    validate(idParams, 'params'),
    uploadBody,
    asyncRoute(async (request, response) => {
      const notes = request.get('x-version-notes')?.trim();
      const result = await service.upload(
        String(request.params.id),
        {
          data: request.body,
          originalFileName: decodeFileNameHeader(request.get('x-file-name')),
          mimeType: request.get('content-type') ?? '',
          ...(notes ? { notes: notes.slice(0, 500) } : {}),
        },
        request.identity!,
        request.context,
      );
      response.status(201).json({
        document: toPublicDocument(result.document),
        version: toPublicVersion(result.version),
      });
    }),
  );

  router.get(
    '/documents/:id/download',
    requirePermission('documents.download'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response, next) => {
      const download = await service.download(
        String(request.params.id),
        request.identity!,
        request.context,
      );
      response.setHeader('Content-Type', download.mimeType);
      response.setHeader('Content-Length', String(download.fileSize));
      response.setHeader('Content-Disposition', safeAttachmentHeader(download.fileName));
      response.setHeader('Cache-Control', 'private, no-store');
      download.stream.once('error', next);
      download.stream.pipe(response);
    }),
  );

  router.get(
    '/documents/:id/versions',
    requirePermission('documents.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      response.json(
        (await service.versions(String(request.params.id), request.identity!)).map(toPublicVersion),
      );
    }),
  );

  router.get(
    '/documents/:id/audit',
    requirePermission('documents.audit'),
    validate(idParams, 'params'),
    validate(auditPagination, 'query'),
    asyncRoute(async (request, response) => {
      response.json(
        await service.audit(
          String(request.params.id),
          Number(request.query.page),
          Number(request.query.pageSize),
          request.identity!,
        ),
      );
    }),
  );

  router.get(
    '/documents/:id',
    requirePermission('documents.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      response.json(
        toPublicDocument(
          await service.get(String(request.params.id), request.identity!, request.context),
        ),
      );
    }),
  );

  router.patch(
    '/documents/:id',
    requirePermission('documents.update'),
    validate(idParams, 'params'),
    validate(updateDocumentSchema),
    asyncRoute(async (request, response) => {
      response.json(
        toPublicDocument(
          await service.update(
            String(request.params.id),
            request.body,
            request.identity!,
            request.context,
          ),
        ),
      );
    }),
  );

  router.post(
    '/documents/:id/archive',
    requirePermission('documents.archive'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      response.json(
        toPublicDocument(
          await service.archive(
            String(request.params.id),
            true,
            request.identity!,
            request.context,
          ),
        ),
      );
    }),
  );

  router.post(
    '/documents/:id/restore',
    requirePermission('documents.archive'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      response.json(
        toPublicDocument(
          await service.archive(
            String(request.params.id),
            false,
            request.identity!,
            request.context,
          ),
        ),
      );
    }),
  );

  router.delete(
    '/documents/:id',
    requirePermission('documents.delete'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      await service.softDelete(String(request.params.id), request.identity!, request.context);
      response.status(204).end();
    }),
  );

  return router;
};
