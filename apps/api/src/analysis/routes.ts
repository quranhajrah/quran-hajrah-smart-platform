import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { asyncRoute, requireAuth, requirePermission, validate } from '../http.js';
import type { IdentityStore } from '../identity/store.js';
import { createLogger, type Logger } from '../logger.js';
import type { StorageProvider } from '../documents/storage.js';
import type { DocumentStore } from '../documents/store.js';
import { documentTypes } from '../documents/types.js';
import { DocumentAnalysisService } from './service.js';
import { institutionalRuleIds } from './rules.js';
import type { AnalysisStore } from './store.js';
import {
  analysisJobStatuses,
  extractionProposalTypes,
  importTargetTypes,
  proposalDecisions,
} from './types.js';

const idParams = z.object({ id: z.string().uuid() }).strict();
const analyzeQuery = z
  .object({
    force: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .default('false'),
  })
  .strict();
const sourceParams = z
  .object({
    targetType: z.enum(importTargetTypes),
    targetRecordId: z.string().uuid(),
  })
  .strict();
const listJobsSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    documentId: z.string().uuid().optional(),
    status: z.enum(analysisJobStatuses).optional(),
    search: z.string().trim().max(160).optional(),
  })
  .strict();
const proposalListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    decision: z.enum(proposalDecisions).optional(),
    proposalType: z.enum(extractionProposalTypes).optional(),
    pageNumber: z.coerce.number().int().min(1).optional(),
    minimumConfidence: z.coerce.number().min(0).max(1).optional(),
  })
  .strict();
const auditSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
const editedData = z.record(z.string(), z.unknown());
const updateProposalSchema = z
  .object({
    title: z.string().trim().min(2).max(300).optional(),
    editedData: editedData.optional(),
    importTargetType: z.enum(importTargetTypes).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'يجب تحديد حقل واحد على الأقل للتعديل.',
  });
const reviewSchema = z
  .object({
    comment: z.string().trim().max(1000).optional(),
    editedData: editedData.optional(),
  })
  .strict();
const bulkReviewSchema = z
  .object({
    proposalIds: z.array(z.string().uuid()).min(1).max(200),
    decision: z.enum(['APPROVED', 'REJECTED']),
    comment: z.string().trim().max(1000).optional(),
  })
  .strict();
const importSchema = z
  .object({
    decisions: z
      .array(
        z
          .object({
            proposalId: z.string().uuid(),
            action: z.enum(['skip', 'update', 'create', 'merge']),
            selectedFields: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
          })
          .strict(),
      )
      .max(500)
      .default([]),
  })
  .strict();
const configurationSchema = z
  .object({
    isActive: z.boolean().optional(),
    maxFileSizeBytes: z.number().int().min(1024).max(104_857_600).optional(),
    maxPages: z.number().int().min(1).max(2000).optional(),
    maxTables: z.number().int().min(0).max(2000).optional(),
    minimumTextCharacters: z.number().int().min(1).max(100_000).optional(),
    proposalConfidence: z.number().min(0).max(1).optional(),
    reviewSlaHours: z.number().int().min(1).max(8760).optional(),
    enabledDocumentTypes: z.array(z.enum(documentTypes)).max(30).optional(),
    enabledRuleIds: z.array(z.enum(institutionalRuleIds)).max(100).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'يجب تحديد إعداد واحد على الأقل.',
  });

export const createDocumentAnalysisRouter = (
  identityStore: IdentityStore,
  documentStore: DocumentStore,
  analysisStore: AnalysisStore,
  storage: StorageProvider,
  config: AppConfig,
  logger: Logger = createLogger(config.logLevel),
) => {
  const router = Router();
  const authenticated = requireAuth(identityStore, config);
  const service = new DocumentAnalysisService(analysisStore, documentStore, storage, logger);
  const analysisLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const importLimiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post(
    '/documents/:id/analyze',
    authenticated,
    requirePermission('document_analysis.run'),
    analysisLimiter,
    validate(idParams, 'params'),
    validate(analyzeQuery, 'query'),
    asyncRoute(async (request, response) => {
      const query = request.query as unknown as { force: boolean };
      const result = await service.start(
        String(request.params.id),
        request.identity!,
        request.context,
        query.force,
      );
      response.status(result.reused ? 200 : 202).json(result);
    }),
  );

  router.use('/document-analysis', authenticated);

  router.get(
    '/document-analysis/summary',
    requirePermission('document_analysis.view'),
    asyncRoute(async (_request, response) => response.json(await service.summary())),
  );
  router.get(
    '/document-analysis/jobs',
    requirePermission('document_analysis.view'),
    validate(listJobsSchema, 'query'),
    asyncRoute(async (request, response) =>
      response.json(await service.list(request.query as never, request.identity!)),
    ),
  );
  router.get(
    '/document-analysis/jobs/:id',
    requirePermission('document_analysis.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(await service.get(String(request.params.id), request.identity!)),
    ),
  );
  router.post(
    '/document-analysis/jobs/:id/cancel',
    requirePermission('document_analysis.run'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(
        await service.cancel(String(request.params.id), request.identity!, request.context),
      ),
    ),
  );
  router.post(
    '/document-analysis/jobs/:id/retry',
    requirePermission('document_analysis.run'),
    analysisLimiter,
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      const job = await service.retry(
        String(request.params.id),
        request.identity!,
        request.context,
      );
      response.status(202).json(job);
    }),
  );
  router.get(
    '/document-analysis/jobs/:id/pages',
    requirePermission('document_analysis.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(await service.pages(String(request.params.id), request.identity!)),
    ),
  );
  router.get(
    '/document-analysis/jobs/:id/tables',
    requirePermission('document_analysis.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(await service.tables(String(request.params.id), request.identity!)),
    ),
  );
  router.get(
    '/document-analysis/jobs/:id/proposals',
    requirePermission('document_analysis.view'),
    validate(idParams, 'params'),
    validate(proposalListSchema, 'query'),
    asyncRoute(async (request, response) =>
      response.json(
        await service.proposals(
          String(request.params.id),
          request.query as never,
          request.identity!,
        ),
      ),
    ),
  );
  router.get(
    '/document-analysis/jobs/:id/audit',
    requirePermission('document_analysis.audit'),
    validate(idParams, 'params'),
    validate(auditSchema, 'query'),
    asyncRoute(async (request, response) => {
      const query = request.query as unknown as { page: number; pageSize: number };
      response.json(
        await service.audit(
          String(request.params.id),
          query.page,
          query.pageSize,
          request.identity!,
        ),
      );
    }),
  );

  router.patch(
    '/document-analysis/proposals/:id',
    requirePermission('document_analysis.review'),
    validate(idParams, 'params'),
    validate(updateProposalSchema),
    asyncRoute(async (request, response) =>
      response.json(
        await service.updateProposal(
          String(request.params.id),
          request.body,
          request.identity!,
          request.context,
        ),
      ),
    ),
  );
  router.post(
    '/document-analysis/proposals/:id/approve',
    requirePermission('document_analysis.approve'),
    validate(idParams, 'params'),
    validate(reviewSchema),
    asyncRoute(async (request, response) =>
      response.json(
        await service.reviewProposal(
          String(request.params.id),
          request.body.editedData ? 'EDITED' : 'APPROVED',
          request.identity!,
          request.context,
          request.body.comment,
          request.body.editedData,
        ),
      ),
    ),
  );
  router.post(
    '/document-analysis/proposals/:id/reject',
    requirePermission('document_analysis.review'),
    validate(idParams, 'params'),
    validate(reviewSchema),
    asyncRoute(async (request, response) =>
      response.json(
        await service.reviewProposal(
          String(request.params.id),
          'REJECTED',
          request.identity!,
          request.context,
          request.body.comment,
        ),
      ),
    ),
  );
  router.post(
    '/document-analysis/proposals/bulk-review',
    requirePermission('document_analysis.review'),
    validate(bulkReviewSchema),
    asyncRoute(async (request, response) => {
      if (
        request.body.decision === 'APPROVED' &&
        !request.identity!.roles.some((role) =>
          role.permissions.includes('document_analysis.approve'),
        )
      ) {
        response.status(403).json({
          error: { code: 'FORBIDDEN', message: 'Insufficient permission.' },
        });
        return;
      }
      response.json(
        await service.bulkReview(
          request.body.proposalIds,
          request.body.decision,
          request.identity!,
          request.context,
          request.body.comment,
        ),
      );
    }),
  );

  router.post(
    '/document-analysis/jobs/:id/import-preview',
    requirePermission('document_analysis.import'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(
        await service.importPreview(String(request.params.id), request.identity!, request.context),
      ),
    ),
  );
  router.post(
    '/document-analysis/jobs/:id/import',
    requirePermission('document_analysis.import'),
    importLimiter,
    validate(idParams, 'params'),
    validate(importSchema),
    asyncRoute(async (request, response) => {
      const batch = await service.import(
        String(request.params.id),
        request.body.decisions,
        request.get('idempotency-key'),
        request.identity!,
        request.context,
      );
      response.status(batch.status === 'IMPORTED' ? 201 : 200).json(batch);
    }),
  );
  router.get(
    '/document-analysis/import-batches/:id',
    requirePermission('document_analysis.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(await service.importBatch(String(request.params.id), request.identity!)),
    ),
  );
  router.get(
    '/document-analysis/sources/:targetType/:targetRecordId',
    requirePermission('document_analysis.view'),
    validate(sourceParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(
        await service.sourceReferences(
          request.params.targetType as never,
          String(request.params.targetRecordId),
          request.identity!,
        ),
      ),
    ),
  );

  router.get(
    '/document-analysis/configuration',
    requirePermission('document_analysis.view'),
    asyncRoute(async (_request, response) => response.json(await service.configuration())),
  );
  router.put(
    '/document-analysis/configuration',
    requirePermission('document_analysis.configure'),
    validate(configurationSchema),
    asyncRoute(async (request, response) =>
      response.json(
        await service.updateConfiguration(request.body, request.identity!, request.context),
      ),
    ),
  );

  return router;
};
