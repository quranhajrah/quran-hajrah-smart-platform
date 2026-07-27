import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { asyncRoute, requireAuth, requirePermission, validate } from '../http.js';
import type { IdentityStore } from '../identity/store.js';
import type { InstitutionalKnowledgeService } from './service.js';

const querySchema = z
  .object({
    query: z.string().trim().min(2).max(600),
    limit: z.number().int().min(1).max(20).optional(),
  })
  .strict();
const idParams = z.object({ id: z.string().uuid() }).strict();

export const createKnowledgeRouter = (
  identityStore: IdentityStore,
  service: InstitutionalKnowledgeService,
  config: AppConfig,
) => {
  const router = Router();
  router.use('/knowledge', requireAuth(identityStore, config));

  router.get(
    '/knowledge/summary',
    requirePermission('knowledge.search'),
    asyncRoute(async (request, response) => {
      response.json(await service.summary(request.identity!));
    }),
  );

  router.post(
    '/knowledge/search',
    requirePermission('knowledge.search'),
    validate(querySchema),
    asyncRoute(async (request, response) => {
      response.json({
        items: await service.search(request.body.query, request.identity!, request.body.limit),
      });
    }),
  );

  router.post(
    '/knowledge/answer',
    requirePermission('knowledge.ask'),
    rateLimit({
      windowMs: 60_000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
    }),
    validate(querySchema.omit({ limit: true })),
    asyncRoute(async (request, response) => {
      response.json(await service.answer(request.body.query, request.identity!));
    }),
  );

  router.post(
    '/knowledge/documents/:id/index',
    requirePermission('knowledge.index'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      response
        .status(202)
        .json(
          await service.indexDocument(
            String(request.params.id),
            request.identity!,
            request.context,
          ),
        );
    }),
  );

  router.post(
    '/knowledge/index/rebuild',
    requirePermission('knowledge.index'),
    asyncRoute(async (request, response) => {
      const result = await service.indexAll();
      await identityStore.createAudit({
        userId: request.identity!.id,
        action: 'KNOWLEDGE_INDEX_REBUILT',
        entityType: 'KnowledgeIndex',
        description: 'Institutional knowledge index rebuilt.',
        metadata: { total: result.total, indexed: result.indexed, failed: result.failed },
        ...request.context,
      });
      response.status(202).json(result);
    }),
  );

  router.get(
    '/knowledge/documents/:id/relations',
    requirePermission('knowledge.relations.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      response.json(await service.listRelations(String(request.params.id), request.identity!));
    }),
  );

  return router;
};
