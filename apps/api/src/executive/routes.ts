import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { asyncRoute, requireAuth, requirePermission, validate } from '../http.js';
import type { IdentityStore } from '../identity/store.js';
import type { DocumentStore } from '../documents/store.js';
import { calculateBudgetVariance } from './calculations.js';
import { ExecutiveService } from './service.js';
import type { ExecutiveStore } from './store.js';
import {
  alertSeverities,
  initiativeStatuses,
  kpiStatuses,
  metricDataTypes,
  metricFrequencies,
  reportStatuses,
  reportTypes,
  riskImpacts,
  riskLikelihoods,
  riskStatuses,
  type ExecutiveEntity,
} from './types.js';

const idParams = z.object({ id: z.string().uuid() }).strict();
const pagination = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(160).optional(),
    status: z.string().trim().max(120).optional(),
    department: z.string().trim().max(160).optional(),
    objectiveId: z.string().uuid().optional(),
  })
  .strict();
const date = z.coerce.date();
const optionalDate = z.coerce.date().optional();
const nullableDate = z.union([z.null(), z.coerce.date()]).optional();
const numeric = z.coerce.number().finite();
const percentage = numeric.min(0).max(100);
const positiveMoney = numeric.min(0).max(1_000_000_000_000);
const optionalText = (maximum = 4000) => z.string().trim().max(maximum).optional();
const nullableText = (maximum = 4000) =>
  z.union([z.string().trim().max(maximum), z.null()]).optional();

const metricCreate = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{2,79}$/),
    nameAr: z.string().trim().min(2).max(160),
    description: optionalText(),
    unit: z.string().trim().max(40).optional(),
    dataType: z.enum(metricDataTypes),
    frequency: z.enum(metricFrequencies),
    responsibleDepartment: z.string().trim().max(160).optional(),
    targetValue: numeric.optional(),
    warningThreshold: numeric.optional(),
    criticalThreshold: numeric.optional(),
    sourceType: z.string().trim().max(80).optional(),
    higherIsBetter: z.boolean().default(true),
    isActive: z.boolean().default(true),
  })
  .strict();
const metricUpdate = metricCreate
  .omit({ key: true })
  .partial()
  .extend({ description: nullableText(), unit: nullableText(40) })
  .strict();
const metricMeasurement = z
  .object({
    numericValue: numeric.optional(),
    textValue: z.string().trim().max(2000).optional(),
    measuredAt: date,
    sourceType: z.string().trim().max(80).optional(),
    sourceDocumentId: z.string().uuid().optional(),
    notes: optionalText(2000),
  })
  .strict()
  .refine((value) => value.numericValue !== undefined || Boolean(value.textValue), {
    message: 'A measurement value is required.',
  });

const objectiveFields = z
  .object({
    code: z.string().trim().min(2).max(60),
    title: z.string().trim().min(2).max(240),
    description: optionalText(),
    strategicAxis: z.string().trim().min(2).max(160),
    baseline: numeric.optional(),
    target: numeric.optional(),
    startDate: date,
    endDate: date,
    ownerId: z.string().uuid().optional(),
    status: z.enum(kpiStatuses).default('NOT_STARTED'),
    weight: percentage.default(0),
    progress: percentage.default(0),
  })
  .strict();
const objectiveCreate = objectiveFields.refine((value) => value.endDate >= value.startDate, {
  message: 'End date must not precede start date.',
});
const objectiveUpdate = objectiveFields
  .omit({ code: true, startDate: true, endDate: true })
  .partial()
  .extend({
    description: nullableText(),
    baseline: numeric.nullable().optional(),
    target: numeric.nullable().optional(),
    ownerId: z.string().uuid().nullable().optional(),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .strict();

const kpiCreate = z
  .object({
    objectiveId: z.string().uuid(),
    code: z.string().trim().min(2).max(60),
    title: z.string().trim().min(2).max(240),
    description: optionalText(),
    formula: optionalText(1000),
    baseline: numeric.optional(),
    target: numeric,
    unit: z.string().trim().max(40).optional(),
    frequency: z.enum(metricFrequencies),
    ownerId: z.string().uuid().optional(),
    dataSource: z.string().trim().max(240).optional(),
    status: z.enum(kpiStatuses).default('NOT_STARTED'),
    weight: percentage.default(0),
  })
  .strict();
const kpiUpdate = kpiCreate
  .omit({ code: true })
  .partial()
  .extend({
    description: nullableText(),
    formula: nullableText(1000),
    baseline: numeric.nullable().optional(),
    ownerId: z.string().uuid().nullable().optional(),
    dataSource: nullableText(240),
  })
  .strict();
const kpiMeasurement = z
  .object({
    value: numeric,
    measuredAt: date,
    notes: optionalText(2000),
    sourceDocumentId: z.string().uuid().optional(),
  })
  .strict();

const initiativeFields = z
  .object({
    code: z.string().trim().min(2).max(60),
    name: z.string().trim().min(2).max(240),
    description: optionalText(),
    objectiveId: z.string().uuid().optional(),
    department: z.string().trim().min(2).max(160),
    ownerId: z.string().uuid().optional(),
    startDate: date,
    endDate: date,
    budget: positiveMoney.default(0),
    actualSpending: positiveMoney.default(0),
    progress: percentage.default(0),
    status: z.enum(initiativeStatuses).default('PLANNED'),
  })
  .strict();
const initiativeCreate = initiativeFields.refine((value) => value.endDate >= value.startDate, {
  message: 'End date must not precede start date.',
});
const initiativeUpdate = initiativeFields
  .omit({ code: true, startDate: true, endDate: true })
  .partial()
  .extend({
    description: nullableText(),
    objectiveId: z.string().uuid().nullable().optional(),
    ownerId: z.string().uuid().nullable().optional(),
    startDate: optionalDate,
    endDate: optionalDate,
  })
  .strict();
const milestoneCreate = z
  .object({
    title: z.string().trim().min(2).max(240),
    description: optionalText(2000),
    dueDate: date,
    completedAt: optionalDate,
    progress: percentage.default(0),
    status: z.enum(kpiStatuses).default('NOT_STARTED'),
  })
  .strict();
const initiativeProgressUpdate = z
  .object({
    summary: z.string().trim().min(2).max(4000),
    progress: percentage,
    status: z.enum(initiativeStatuses).optional(),
    actualSpending: positiveMoney.optional(),
    updateDate: date,
  })
  .strict();

const riskCreate = z
  .object({
    code: z.string().trim().min(2).max(60),
    title: z.string().trim().min(2).max(240),
    description: optionalText(),
    category: z.string().trim().min(2).max(160),
    cause: optionalText(2000),
    consequence: optionalText(2000),
    likelihood: z.enum(riskLikelihoods),
    impact: z.enum(riskImpacts),
    existingControls: optionalText(4000),
    residualLikelihood: z.enum(riskLikelihoods),
    residualImpact: z.enum(riskImpacts),
    ownerId: z.string().uuid().optional(),
    status: z.enum(riskStatuses).default('OPEN'),
    dueDate: optionalDate,
    reviewDate: optionalDate,
    objectiveId: z.string().uuid().optional(),
    initiativeId: z.string().uuid().optional(),
  })
  .strict();
const riskUpdate = riskCreate
  .omit({ code: true })
  .partial()
  .extend({
    description: nullableText(),
    cause: nullableText(2000),
    consequence: nullableText(2000),
    existingControls: nullableText(),
    ownerId: z.string().uuid().nullable().optional(),
    dueDate: nullableDate,
    reviewDate: nullableDate,
    objectiveId: z.string().uuid().nullable().optional(),
    initiativeId: z.string().uuid().nullable().optional(),
  })
  .strict();
const treatmentCreate = z
  .object({
    title: z.string().trim().min(2).max(240),
    description: optionalText(2000),
    ownerId: z.string().uuid().optional(),
    dueDate: date,
    completedAt: optionalDate,
    progress: percentage.default(0),
    status: z.enum(kpiStatuses).default('NOT_STARTED'),
  })
  .strict();
const evidenceCreate = z.object({ documentId: z.string().uuid() }).strict();

const alertCreate = z
  .object({
    severity: z.enum(alertSeverities),
    title: z.string().trim().min(2).max(240),
    description: z.string().trim().min(2).max(4000),
    sourceModule: z.string().trim().min(2).max(80),
    sourceRecordId: z.string().trim().max(120).optional(),
    dueDate: optionalDate,
    assignedUserId: z.string().uuid().optional(),
  })
  .strict();

const reportFields = z
  .object({
    title: z.string().trim().min(2).max(240),
    reportType: z.enum(reportTypes),
    status: z.enum(reportStatuses).default('DRAFT'),
    periodStart: optionalDate,
    periodEnd: optionalDate,
    preparedById: z.string().uuid().optional(),
  })
  .strict();
const reportCreate = reportFields.refine(
  (value) => !value.periodStart || !value.periodEnd || value.periodEnd >= value.periodStart,
  { message: 'Report period end must not precede start.' },
);
const reportUpdate = reportFields
  .omit({ status: true })
  .partial()
  .extend({ periodStart: nullableDate, periodEnd: nullableDate })
  .strict();
const reportSectionsUpdate = z
  .object({
    sections: z
      .array(
        z
          .object({
            title: z.string().trim().min(2).max(240),
            content: z.union([z.record(z.unknown()), z.array(z.unknown()), z.string().max(20_000)]),
            sortOrder: z.number().int().min(0).max(1000),
            sourceReferences: z.array(z.record(z.unknown())).max(100).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();

const weights = z
  .object({
    governance: percentage,
    strategic: percentage,
    operational: percentage,
    financial: percentage,
    risk: percentage,
    knowledge: percentage,
  })
  .strict()
  .refine(
    (value) =>
      Math.abs(Object.values(value).reduce((total, current) => total + current, 0) - 100) < 0.001,
    { message: 'Health weights must total 100.' },
  );
const preferenceUpdate = z
  .object({
    healthWeights: weights,
    layout: z.record(z.unknown()).optional(),
    quickActions: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  })
  .strict();
const executiveQuery = z.object({ text: z.string().trim().min(3).max(500) }).strict();

const escapeHtml = (value: unknown) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export const createExecutiveRouter = (
  identityStore: IdentityStore,
  documentStore: DocumentStore,
  executiveStore: ExecutiveStore,
  config: AppConfig,
) => {
  const router = Router();
  const authenticated = requireAuth(identityStore, config);
  const service = new ExecutiveService(executiveStore, identityStore, documentStore);
  const queryLimiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: Math.min(config.rateLimitMax, 30),
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.use('/executive', authenticated);

  router.get(
    '/executive/dashboard',
    requirePermission('dashboard.view'),
    asyncRoute(async (request, response) =>
      response.json(await service.dashboard(request.identity!)),
    ),
  );
  router.get(
    '/executive/health',
    requirePermission('dashboard.view'),
    asyncRoute(async (request, response) => {
      response.json({
        ...(await service.health(request.identity!)),
        history: await executiveStore.healthHistory(24),
      });
    }),
  );
  router.post(
    '/executive/health/snapshots',
    requirePermission('dashboard.configure'),
    asyncRoute(async (request, response) => {
      response.status(201).json(await service.snapshot(request.identity!, request.context));
    }),
  );
  router.get(
    '/executive/activity',
    requirePermission('dashboard.view'),
    validate(pagination, 'query'),
    asyncRoute(async (request, response) =>
      response.json(await executiveStore.activity(request.query as never)),
    ),
  );
  router.post(
    '/executive/query',
    queryLimiter,
    requirePermission('executive.query'),
    validate(executiveQuery),
    asyncRoute(async (request, response) => {
      const result = await service.structuredQuery(request.body.text, request.identity!);
      await identityStore.createAudit({
        userId: request.identity!.id,
        action: 'executive.query',
        entityType: 'ExecutiveQuery',
        description: 'Structured executive data query executed.',
        metadata: { responseTitle: result.title },
        ...request.context,
      });
      response.json(result);
    }),
  );
  router.get(
    '/executive/preferences',
    requirePermission('dashboard.view'),
    asyncRoute(async (request, response) =>
      response.json({ healthWeights: await executiveStore.getHealthWeights(request.identity!.id) }),
    ),
  );
  router.patch(
    '/executive/preferences',
    requirePermission('dashboard.configure'),
    validate(preferenceUpdate),
    asyncRoute(async (request, response) =>
      response.json(
        await service.updatePreferences(request.body, request.identity!, request.context),
      ),
    ),
  );

  const registerCrud = (
    entity: ExecutiveEntity,
    schema: z.ZodTypeAny,
    updateSchema: z.ZodTypeAny,
    permissions: { view: string; manage: string; create?: string },
  ) => {
    router.get(
      `/executive/${entity}`,
      requirePermission(permissions.view),
      validate(pagination, 'query'),
      asyncRoute(async (request, response) =>
        response.json(await service.list(entity, request.query as never)),
      ),
    );
    router.post(
      `/executive/${entity}`,
      requirePermission(permissions.create ?? permissions.manage),
      validate(schema),
      asyncRoute(async (request, response) =>
        response
          .status(201)
          .json(await service.create(entity, request.body, request.identity!, request.context)),
      ),
    );
    router.get(
      `/executive/${entity}/:id`,
      requirePermission(permissions.view),
      validate(idParams, 'params'),
      asyncRoute(async (request, response) =>
        response.json(await service.get(entity, String(request.params.id))),
      ),
    );
    router.patch(
      `/executive/${entity}/:id`,
      requirePermission(permissions.manage),
      validate(idParams, 'params'),
      validate(updateSchema),
      asyncRoute(async (request, response) =>
        response.json(
          await service.update(
            entity,
            String(request.params.id),
            request.body,
            request.identity!,
            request.context,
          ),
        ),
      ),
    );
    router.delete(
      `/executive/${entity}/:id`,
      requirePermission(permissions.manage),
      validate(idParams, 'params'),
      asyncRoute(async (request, response) => {
        await service.remove(entity, String(request.params.id), request.identity!, request.context);
        response.status(204).end();
      }),
    );
  };

  registerCrud('metrics', metricCreate, metricUpdate, {
    view: 'metrics.view',
    manage: 'metrics.manage',
  });
  router.post(
    '/executive/metrics/:id/measurements',
    requirePermission('metrics.measure'),
    validate(idParams, 'params'),
    validate(metricMeasurement),
    asyncRoute(async (request, response) =>
      response
        .status(201)
        .json(
          await service.recordMetric(
            String(request.params.id),
            request.body,
            request.identity!,
            request.context,
          ),
        ),
    ),
  );
  const metricHistoryHandler = asyncRoute(async (request, response) =>
    response.json(
      await service.metricHistory(
        String(request.params.id),
        request.query as never,
        request.identity!,
      ),
    ),
  );
  router.get(
    '/executive/metrics/:id/history',
    requirePermission('metrics.view'),
    validate(idParams, 'params'),
    validate(pagination, 'query'),
    metricHistoryHandler,
  );
  router.get(
    '/executive/metrics/:id/trend',
    requirePermission('metrics.view'),
    validate(idParams, 'params'),
    validate(pagination, 'query'),
    metricHistoryHandler,
  );

  registerCrud('objectives', objectiveCreate, objectiveUpdate, {
    view: 'strategy.view',
    manage: 'strategy.manage',
  });
  router.get(
    '/executive/objectives/:id/progress',
    requirePermission('strategy.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      const objective = await service.get('objectives', String(request.params.id));
      response.json({
        id: objective.id,
        progress: objective.progress,
        status: objective.status,
        kpis: objective.kpis,
        initiatives: objective.initiatives,
      });
    }),
  );
  router.post(
    '/executive/objectives/:id/kpis',
    requirePermission('kpi.manage'),
    validate(idParams, 'params'),
    validate(kpiCreate.omit({ objectiveId: true })),
    asyncRoute(async (request, response) =>
      response
        .status(201)
        .json(
          await service.create(
            'kpis',
            { ...request.body, objectiveId: String(request.params.id) },
            request.identity!,
            request.context,
          ),
        ),
    ),
  );

  router.get(
    '/executive/kpis/summary',
    requirePermission('kpi.view'),
    asyncRoute(async (_request, response) => {
      const items = await service.list('kpis', { page: 1, pageSize: 100 });
      response.json(
        Object.fromEntries(
          kpiStatuses.map((status) => [
            status,
            items.items.filter((item) => item.status === status).length,
          ]),
        ),
      );
    }),
  );
  registerCrud('kpis', kpiCreate, kpiUpdate, {
    view: 'kpi.view',
    manage: 'kpi.manage',
  });
  router.post(
    '/executive/kpis/:id/measurements',
    requirePermission('kpi.measure'),
    validate(idParams, 'params'),
    validate(kpiMeasurement),
    asyncRoute(async (request, response) =>
      response
        .status(201)
        .json(
          await service.recordKpi(
            String(request.params.id),
            request.body,
            request.identity!,
            request.context,
          ),
        ),
    ),
  );
  router.get(
    '/executive/kpis/:id/trend',
    requirePermission('kpi.view'),
    validate(idParams, 'params'),
    validate(pagination, 'query'),
    asyncRoute(async (request, response) =>
      response.json(
        await service.kpiHistory(
          String(request.params.id),
          request.query as never,
          request.identity!,
        ),
      ),
    ),
  );

  registerCrud('initiatives', initiativeCreate, initiativeUpdate, {
    view: 'initiatives.view',
    manage: 'initiatives.manage',
  });
  router.post(
    '/executive/initiatives/:id/milestones',
    requirePermission('initiatives.manage'),
    validate(idParams, 'params'),
    validate(milestoneCreate),
    asyncRoute(async (request, response) =>
      response
        .status(201)
        .json(
          await service.addMilestone(
            String(request.params.id),
            request.body,
            request.identity!,
            request.context,
          ),
        ),
    ),
  );
  router.post(
    '/executive/initiatives/:id/updates',
    requirePermission('initiatives.manage'),
    validate(idParams, 'params'),
    validate(initiativeProgressUpdate),
    asyncRoute(async (request, response) =>
      response
        .status(201)
        .json(
          await service.addInitiativeUpdate(
            String(request.params.id),
            request.body,
            request.identity!,
            request.context,
          ),
        ),
    ),
  );
  router.post(
    '/executive/initiatives/:id/evidence',
    requirePermission('initiatives.manage'),
    validate(idParams, 'params'),
    validate(evidenceCreate),
    asyncRoute(async (request, response) => {
      await service.linkEvidence(
        'initiative',
        String(request.params.id),
        request.body.documentId,
        request.identity!,
        request.context,
      );
      response.status(204).end();
    }),
  );
  router.get(
    '/executive/initiatives/:id/budget',
    requirePermission('initiatives.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      const initiative = await service.get('initiatives', String(request.params.id));
      response.json({
        budget: initiative.budget,
        actualSpending: initiative.actualSpending,
        variance: calculateBudgetVariance(
          Number(initiative.budget),
          Number(initiative.actualSpending),
        ),
      });
    }),
  );

  router.get(
    '/executive/risks/heat-matrix',
    requirePermission('risks.view'),
    asyncRoute(async (_request, response) => {
      const risks = await service.list('risks', { page: 1, pageSize: 100 });
      const matrix = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => 0));
      const likelihoodIndex = Object.fromEntries(
        riskLikelihoods.map((value, index) => [value, index]),
      );
      const impactIndex = Object.fromEntries(riskImpacts.map((value, index) => [value, index]));
      for (const riskItem of risks.items) {
        const risk = riskItem as Record<string, unknown>;
        matrix[Number(likelihoodIndex[String(risk.likelihood)])]![
          Number(impactIndex[String(risk.impact)])
        ]! += 1;
      }
      response.json({ likelihoods: riskLikelihoods, impacts: riskImpacts, matrix });
    }),
  );
  router.get(
    '/executive/risks/critical',
    requirePermission('risks.view'),
    asyncRoute(async (_request, response) =>
      response.json(await service.list('risks', { page: 1, pageSize: 100, status: 'critical' })),
    ),
  );
  router.get(
    '/executive/risks/trend',
    requirePermission('risks.view'),
    asyncRoute(async (_request, response) => {
      const risks = await service.list('risks', { page: 1, pageSize: 100 });
      const months = new Map<string, { total: number; open: number; critical: number }>();
      for (const riskItem of risks.items) {
        const risk = riskItem as Record<string, unknown>;
        const month = new Date(String(risk.createdAt)).toISOString().slice(0, 7);
        const current = months.get(month) ?? { total: 0, open: 0, critical: 0 };
        current.total += 1;
        if (risk.status !== 'CLOSED') current.open += 1;
        if (Number(risk.residualScore) >= 15) current.critical += 1;
        months.set(month, current);
      }
      response.json(
        [...months.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([month, values]) => ({ month, ...values })),
      );
    }),
  );
  registerCrud('risks', riskCreate, riskUpdate, {
    view: 'risks.view',
    manage: 'risks.manage',
  });
  router.post(
    '/executive/risks/:id/treatments',
    requirePermission('risks.manage'),
    validate(idParams, 'params'),
    validate(treatmentCreate),
    asyncRoute(async (request, response) =>
      response
        .status(201)
        .json(
          await service.addTreatment(
            String(request.params.id),
            request.body,
            request.identity!,
            request.context,
          ),
        ),
    ),
  );
  router.post(
    '/executive/risks/:id/evidence',
    requirePermission('risks.manage'),
    validate(idParams, 'params'),
    validate(evidenceCreate),
    asyncRoute(async (request, response) => {
      await service.linkEvidence(
        'risk',
        String(request.params.id),
        request.body.documentId,
        request.identity!,
        request.context,
      );
      response.status(204).end();
    }),
  );

  router.get(
    '/executive/alerts',
    requirePermission('alerts.view'),
    validate(pagination, 'query'),
    asyncRoute(async (request, response) =>
      response.json(await executiveStore.listAlerts(request.query as never)),
    ),
  );
  router.post(
    '/executive/alerts',
    requirePermission('alerts.manage'),
    validate(alertCreate),
    asyncRoute(async (request, response) =>
      response
        .status(201)
        .json(await service.createAlert(request.body, request.identity!, request.context)),
    ),
  );
  router.post(
    '/executive/alerts/generate',
    requirePermission('alerts.manage'),
    asyncRoute(async (request, response) =>
      response.json(await service.generateAlerts(request.identity!, request.context)),
    ),
  );
  for (const action of ['acknowledge', 'resolve', 'dismiss'] as const) {
    router.post(
      `/executive/alerts/:id/${action}`,
      requirePermission('alerts.manage'),
      validate(idParams, 'params'),
      asyncRoute(async (request, response) =>
        response.json(
          await service.alertAction(
            String(request.params.id),
            action,
            request.identity!,
            request.context,
          ),
        ),
      ),
    );
  }

  registerCrud('reports', reportCreate, reportUpdate, {
    view: 'reports.view',
    manage: 'reports.create',
    create: 'reports.create',
  });
  router.post(
    '/executive/reports/:id/generate',
    requirePermission('reports.create'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(
        await service.generateReport(String(request.params.id), request.identity!, request.context),
      ),
    ),
  );
  router.patch(
    '/executive/reports/:id/sections',
    requirePermission('reports.create'),
    validate(idParams, 'params'),
    validate(reportSectionsUpdate),
    asyncRoute(async (request, response) =>
      response.json(
        await service.updateReportSections(
          String(request.params.id),
          request.body.sections,
          request.identity!,
          request.context,
        ),
      ),
    ),
  );
  router.post(
    '/executive/reports/:id/approve',
    requirePermission('reports.approve'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(
        await service.reportTransition(
          String(request.params.id),
          'APPROVED',
          request.identity!,
          request.context,
        ),
      ),
    ),
  );
  router.post(
    '/executive/reports/:id/archive',
    requirePermission('reports.approve'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) =>
      response.json(
        await service.reportTransition(
          String(request.params.id),
          'ARCHIVED',
          request.identity!,
          request.context,
        ),
      ),
    ),
  );
  router.get(
    '/executive/reports/:id/print',
    requirePermission('reports.view'),
    validate(idParams, 'params'),
    asyncRoute(async (request, response) => {
      const report = await service.get('reports', String(request.params.id));
      const sections = Array.isArray(report.sections) ? report.sections : [];
      const body = sections
        .map((section) => {
          const value = section as Record<string, unknown>;
          return `<section><h2>${escapeHtml(value.title)}</h2><pre>${escapeHtml(
            JSON.stringify(value.content, null, 2),
          )}</pre></section>`;
        })
        .join('');
      response.setHeader('Cache-Control', 'private, no-store');
      response
        .type('html')
        .send(
          `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(
            report.title,
          )}</title></head><body><main><h1>${escapeHtml(report.title)}</h1><p>تاريخ التوليد: ${escapeHtml(
            report.generatedAt ?? 'غير مولد',
          )}</p>${body}</main></body></html>`,
        );
    }),
  );

  return router;
};
