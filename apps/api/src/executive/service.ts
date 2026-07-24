import { AppError } from '../http.js';
import type { IdentityStore } from '../identity/store.js';
import type { IdentityUser, RequestMeta } from '../identity/types.js';
import {
  allowedConfidentialityLevels,
  canAccessDocument,
  requireDocumentAccess,
} from '../documents/security.js';
import type { DocumentStore } from '../documents/store.js';
import {
  calculateBudgetVariance,
  calculateExecutiveHealth,
  calculateInitiativeStatus,
  calculateKpiStatus,
  calculateMetricAssessment,
  calculateRiskScore,
  financialHealthScore,
  riskHealthScore,
  validateHealthWeights,
} from './calculations.js';
import type { ExecutiveRecord, ExecutiveStore } from './store.js';
import type {
  ExecutiveEntity,
  ExecutiveHealth,
  ExecutiveResponse,
  HealthInputs,
  PageQuery,
} from './types.js';

const associationMetricKeys = [
  'beneficiaries_total',
  'students_male',
  'students_female',
  'teachers_male',
  'teachers_female',
  'circles_in_person',
  'circles_remote',
  'memorized_pages_weekly',
  'memorized_pages_monthly',
  'completed_parts',
  'attendance_rate',
  'retention_rate',
] as const;

const entityLabels: Record<ExecutiveEntity, string> = {
  metrics: 'InstitutionalMetric',
  objectives: 'StrategicObjective',
  kpis: 'StrategicKpi',
  initiatives: 'OperationalInitiative',
  risks: 'InstitutionalRisk',
  reports: 'ExecutiveReport',
};

const recordId = (record: ExecutiveRecord) => record.id;
const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export class ExecutiveService {
  constructor(
    private readonly store: ExecutiveStore,
    private readonly identityStore: IdentityStore,
    private readonly documentStore: DocumentStore,
  ) {}

  async list(entity: ExecutiveEntity, query: PageQuery) {
    const result = await this.store.list(entity, query);
    if (entity !== 'metrics') return result;
    return {
      ...result,
      items: result.items.map((metric) => ({
        ...metric,
        assessment: calculateMetricAssessment(
          numeric(metric.currentNumericValue),
          numeric(metric.targetValue),
          numeric(metric.warningThreshold),
          numeric(metric.criticalThreshold),
          metric.higherIsBetter !== false,
        ),
      })),
    };
  }

  async get(entity: ExecutiveEntity, id: string) {
    const record = await this.store.find(entity, id);
    if (!record) throw new AppError(404, 'Executive record not found.', 'NOT_FOUND');
    return record;
  }

  async create(
    entity: ExecutiveEntity,
    input: Record<string, unknown>,
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const prepared = this.prepare(entity, input);
    const record = await this.store.create(entity, prepared, user.id);
    await this.audit(`${entity}.create`, entityLabels[entity], recordId(record), user, context, {
      fields: Object.keys(prepared),
    });
    return record;
  }

  async update(
    entity: ExecutiveEntity,
    id: string,
    input: Record<string, unknown>,
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const current = await this.get(entity, id);
    const prepared = this.prepare(entity, input, current);
    const record = await this.store.update(entity, id, prepared, user.id);
    await this.audit(`${entity}.update`, entityLabels[entity], id, user, context, {
      fields: Object.keys(prepared),
    });
    return record;
  }

  async remove(entity: ExecutiveEntity, id: string, user: IdentityUser, context: RequestMeta) {
    await this.get(entity, id);
    await this.store.softDelete(entity, id, user.id);
    await this.audit(`${entity}.delete`, entityLabels[entity], id, user, context);
  }

  async recordMetric(
    id: string,
    input: Parameters<ExecutiveStore['recordMetric']>[1],
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const metric = await this.get('metrics', id);
    const dataType = String(metric.dataType);
    if (dataType === 'TEXT' && !input.textValue) {
      throw new AppError(400, 'A text value is required for this metric.', 'VALIDATION_ERROR');
    }
    if (dataType !== 'TEXT' && input.numericValue === undefined) {
      throw new AppError(400, 'A numeric value is required for this metric.', 'VALIDATION_ERROR');
    }
    await this.requireSourceDocument(input.sourceDocumentId, user);
    const value = await this.store.recordMetric(id, input, user.id);
    await this.audit('metrics.measure', 'InstitutionalMetric', id, user, context, {
      measurementId: value.id,
      measuredAt: input.measuredAt.toISOString(),
      sourceDocumentId: input.sourceDocumentId,
    });
    return value;
  }

  async metricHistory(id: string, query: PageQuery, user: IdentityUser) {
    return this.sanitizeSourceReferences(await this.store.metricHistory(id, query), user);
  }

  async recordKpi(
    id: string,
    input: Parameters<ExecutiveStore['recordKpi']>[1],
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const kpi = await this.get('kpis', id);
    await this.requireSourceDocument(input.sourceDocumentId, user);
    const status = calculateKpiStatus(input.value, Number(kpi.target), numeric(kpi.baseline));
    const measurement = await this.store.recordKpi(id, input, status, user.id);
    await this.audit('kpi.measure', 'StrategicKpi', id, user, context, {
      measurementId: measurement.id,
      measuredAt: input.measuredAt.toISOString(),
      status,
    });
    return measurement;
  }

  async kpiHistory(id: string, query: PageQuery, user: IdentityUser) {
    return this.sanitizeSourceReferences(await this.store.kpiHistory(id, query), user);
  }

  async addMilestone(
    initiativeId: string,
    input: Record<string, unknown>,
    user: IdentityUser,
    context: RequestMeta,
  ) {
    await this.get('initiatives', initiativeId);
    const record = await this.store.addMilestone(initiativeId, input, user.id);
    await this.audit(
      'initiatives.milestone',
      'OperationalInitiative',
      initiativeId,
      user,
      context,
      {
        milestoneId: record.id,
      },
    );
    return record;
  }

  async addInitiativeUpdate(
    initiativeId: string,
    input: Record<string, unknown>,
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const initiative = await this.get('initiatives', initiativeId);
    const progress = Number(input.progress);
    const status =
      input.status ??
      calculateInitiativeStatus(progress, new Date(String(initiative.endDate)), new Date());
    const record = await this.store.addInitiativeUpdate(
      initiativeId,
      { ...input, status },
      user.id,
    );
    await this.audit(
      'initiatives.update_progress',
      'OperationalInitiative',
      initiativeId,
      user,
      context,
      {
        updateId: record.id,
        progress,
        status,
      },
    );
    return record;
  }

  async addTreatment(
    riskId: string,
    input: Record<string, unknown>,
    user: IdentityUser,
    context: RequestMeta,
  ) {
    await this.get('risks', riskId);
    const record = await this.store.addRiskTreatment(riskId, input, user.id);
    await this.audit('risks.treatment', 'InstitutionalRisk', riskId, user, context, {
      treatmentId: record.id,
    });
    return record;
  }

  async linkEvidence(
    entity: 'initiative' | 'risk',
    entityId: string,
    documentId: string,
    user: IdentityUser,
    context: RequestMeta,
  ) {
    await this.get(entity === 'initiative' ? 'initiatives' : 'risks', entityId);
    const document = await this.documentStore.findDocument(documentId);
    if (!document) throw new AppError(404, 'Evidence document not found.', 'NOT_FOUND');
    await requireDocumentAccess(this.documentStore, document, user, 'view');
    await this.store.linkEvidence(entity, entityId, documentId, user.id);
    await this.audit(`${entity}.evidence`, entity, entityId, user, context, { documentId });
  }

  async dashboard(user: IdentityUser) {
    const [base, documents, health] = await Promise.all([
      this.store.dashboardBase(),
      this.documentStore.dashboard({
        userId: user.id,
        roleIds: user.roles.map((role) => role.id),
        allowedLevels: [...allowedConfidentialityLevels(user)],
      }),
      this.health(user),
    ]);
    const metrics = Object.fromEntries(
      base.metrics.map((metric) => [
        metric.key,
        {
          id: metric.id,
          nameAr: metric.nameAr,
          value: metric.currentNumericValue ?? metric.currentTextValue ?? null,
          unit: metric.unit ?? null,
          measuredAt: metric.currentMeasuredAt ?? null,
        },
      ]),
    );
    return {
      summary: {
        documents: {
          total: documents.total,
          active: documents.active,
          underReview: documents.underReview,
          expiring: documents.expiring,
          archived: documents.archived,
        },
        activeUsers: base.activeUsers,
        recentSystemActivity: base.recentActivity.length,
        objectives: base.objectives,
        kpis: base.kpis,
        initiatives: {
          ...base.initiatives,
          budgetVariance: calculateBudgetVariance(
            base.initiatives.plannedBudget,
            base.initiatives.actualSpending,
          ),
        },
        risks: base.risks,
      },
      associationIndicators: Object.fromEntries(
        associationMetricKeys.map((key) => [key, metrics[key] ?? null]),
      ),
      institutionalMetrics: metrics,
      health,
      recentDocuments: documents.recent,
      recentActivities: base.recentActivity,
      alerts: base.alerts,
      upcomingDeadlines: base.upcomingDeadlines,
      quickActions: [
        'upload_document',
        'add_kpi',
        'add_initiative',
        'add_risk',
        'add_alert',
        'create_report',
        'knowledge_center',
        'manage_users',
      ],
    };
  }

  async health(user: IdentityUser): Promise<ExecutiveHealth> {
    const [base, documents, weights] = await Promise.all([
      this.store.dashboardBase(),
      this.documentStore.dashboard({
        userId: user.id,
        roleIds: user.roles.map((role) => role.id),
        allowedLevels: [...allowedConfidentialityLevels(user)],
      }),
      this.store.getHealthWeights(user.id),
    ]);
    const metricValues = Object.fromEntries(
      base.metrics.map((metric) => [metric.key, metric.currentNumericValue ?? null]),
    );
    const inputs: HealthInputs = {
      governance: numeric(metricValues.governance_score),
      strategic: numeric(metricValues.strategic_plan_progress),
      operational: numeric(metricValues.operational_plan_progress),
      financial: financialHealthScore(numeric(metricValues.budget_execution_rate)),
      risk: riskHealthScore(base.risks.averageResidualScore),
      knowledge:
        documents.total === 0
          ? null
          : Math.round((documents.active / documents.total) * 10_000) / 100,
    };
    return calculateExecutiveHealth(inputs, weights);
  }

  async snapshot(user: IdentityUser, context: RequestMeta) {
    const health = await this.health(user);
    const snapshot = await this.store.createHealthSnapshot(health, user.id);
    await this.audit(
      'dashboard.health_snapshot',
      'ExecutiveHealthSnapshot',
      snapshot.id,
      user,
      context,
      {
        coverage: health.coverage,
        missingData: health.missingData,
      },
    );
    return snapshot;
  }

  async updatePreferences(
    input: Parameters<ExecutiveStore['updatePreferences']>[1],
    user: IdentityUser,
    context: RequestMeta,
  ) {
    if (!validateHealthWeights(input.healthWeights)) {
      throw new AppError(400, 'Health weights must total 100.', 'VALIDATION_ERROR');
    }
    const preference = await this.store.updatePreferences(user.id, input);
    await this.audit(
      'dashboard.configure',
      'ExecutiveDashboardPreference',
      preference.id,
      user,
      context,
      {
        fields: Object.keys(input),
      },
    );
    return preference;
  }

  async generateAlerts(user: IdentityUser | null, context: RequestMeta = {}) {
    const candidates = await this.store.alertCandidates(new Date());
    const generated = [];
    for (const candidate of candidates) {
      generated.push(await this.store.upsertGeneratedAlert(candidate));
    }
    await this.identityStore.createAudit({
      userId: user?.id,
      action: 'alerts.generate',
      entityType: 'ExecutiveAlert',
      description: 'Executive alerts generated from structured platform data.',
      metadata: { candidateCount: candidates.length },
      ...context,
    });
    return { generated: generated.length };
  }

  async createAlert(input: Record<string, unknown>, user: IdentityUser, context: RequestMeta) {
    const alert = await this.store.createAlert(input, user.id);
    await this.audit('alerts.create', 'ExecutiveAlert', alert.id, user, context, {
      severity: input.severity,
      sourceModule: input.sourceModule,
    });
    return alert;
  }

  async alertAction(
    id: string,
    action: 'acknowledge' | 'resolve' | 'dismiss',
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const alert = await this.store.actionAlert(id, action, user.id);
    await this.audit(`alerts.${action}`, 'ExecutiveAlert', id, user, context);
    return alert;
  }

  async generateReport(id: string, user: IdentityUser, context: RequestMeta) {
    const report = await this.get('reports', id);
    if (String(report.status) === 'APPROVED' || String(report.status) === 'ARCHIVED') {
      throw new AppError(
        409,
        'Approved or archived reports cannot be regenerated.',
        'INVALID_STATE',
      );
    }
    const [dashboard, health] = await Promise.all([this.dashboard(user), this.health(user)]);
    const generated = await this.store.replaceReportSections(
      id,
      [
        {
          title: 'الملخص التنفيذي',
          content: {
            healthScore: health.score,
            healthRating: health.rating,
            coverage: health.coverage,
            missingData: health.missingData,
          },
          sortOrder: 0,
          sourceReferences: [{ module: 'executive-health', generatedAt: new Date().toISOString() }],
        },
        {
          title: 'مؤشرات الأداء المؤسسي',
          content: dashboard.summary,
          sortOrder: 1,
          sourceReferences: [
            { module: 'executive-dashboard', generatedAt: new Date().toISOString() },
          ],
        },
        {
          title: 'التنبيهات والمواعيد',
          content: { alerts: dashboard.alerts, deadlines: dashboard.upcomingDeadlines },
          sortOrder: 2,
          sourceReferences: [{ module: 'executive-alerts', generatedAt: new Date().toISOString() }],
        },
      ],
      user.id,
    );
    await this.audit('reports.generate', 'ExecutiveReport', id, user, context, {
      sections: 3,
      missingData: health.missingData,
    });
    return generated;
  }

  async updateReportSections(
    id: string,
    sections: Parameters<ExecutiveStore['replaceReportSections']>[1],
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const report = await this.get('reports', id);
    if (!['DRAFT', 'GENERATED'].includes(String(report.status))) {
      throw new AppError(
        409,
        'Approved or archived report sections cannot be changed.',
        'INVALID_STATE',
      );
    }
    const updated = await this.store.replaceReportSections(id, sections, user.id);
    await this.audit('reports.sections_update', 'ExecutiveReport', id, user, context, {
      sectionCount: sections.length,
    });
    return updated;
  }

  async reportTransition(
    id: string,
    status: 'APPROVED' | 'ARCHIVED',
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const report = await this.get('reports', id);
    if (status === 'APPROVED' && String(report.status) !== 'GENERATED') {
      throw new AppError(409, 'Only generated reports can be approved.', 'INVALID_STATE');
    }
    if (status === 'ARCHIVED' && String(report.status) !== 'APPROVED') {
      throw new AppError(409, 'Only approved reports can be archived.', 'INVALID_STATE');
    }
    const transitioned = await this.store.transitionReport(id, status, user.id);
    await this.audit(`reports.${status.toLowerCase()}`, 'ExecutiveReport', id, user, context);
    return transitioned;
  }

  async structuredQuery(text: string, user: IdentityUser): Promise<ExecutiveResponse> {
    const normalized = text.normalize('NFC').trim();
    if (/متعثر|مؤشرات الأداء/.test(normalized)) {
      const result = await this.store.list('kpis', {
        page: 1,
        pageSize: 20,
        status: 'AT_RISK,OFF_TRACK',
      });
      return this.response('مؤشرات الأداء المتعثرة', result.items, 'kpi', '/executive/kpis');
    }
    if (/المبادرات المتأخرة|متأخر/.test(normalized)) {
      const result = await this.store.list('initiatives', {
        page: 1,
        pageSize: 20,
        status: 'DELAYED',
      });
      return this.response(
        'المبادرات المتأخرة',
        result.items,
        'initiatives',
        '/executive/initiatives',
      );
    }
    if (/المخاطر الحرجة|حرج/.test(normalized)) {
      const result = await this.store.list('risks', {
        page: 1,
        pageSize: 20,
        status: 'critical',
      });
      return this.response('المخاطر الحرجة', result.items, 'risks', '/executive/risks');
    }
    if (/الوثائق.*ستنتهي|تنتهي/.test(normalized)) {
      const documents = await this.documentStore.dashboard({
        userId: user.id,
        roleIds: user.roles.map((role) => role.id),
        allowedLevels: [...allowedConfidentialityLevels(user)],
      });
      return {
        mode: 'structured-data',
        title: 'الوثائق القريبة من الانتهاء',
        summary: `عدد الوثائق القريبة من الانتهاء: ${documents.expiring}.`,
        data: { count: documents.expiring },
        missingData: [],
        sources: [{ module: 'knowledge-center', label: 'مركز المعرفة', route: '/documents' }],
        suggestedActions: [
          { label: 'فتح مركز المعرفة', route: '/documents', permission: 'documents.view' },
        ],
      };
    }
    if (/نسبة تنفيذ الخطة|تنفيذ الخطة/.test(normalized)) {
      const metrics = await this.store.metricSummaries();
      const selected = metrics.filter((metric) =>
        ['strategic_plan_progress', 'operational_plan_progress'].includes(metric.key),
      );
      return this.response(
        'نسب تنفيذ الخطط',
        selected as unknown as ExecutiveRecord[],
        'metrics',
        '/executive/metrics',
      );
    }
    if (/ملخص.*تنفيذي|ملخصًا تنفيذيًا/.test(normalized)) {
      const dashboard = await this.dashboard(user);
      return {
        mode: 'structured-data',
        title: 'الملخص التنفيذي',
        summary: 'ملخص مبني على البيانات المؤسسية المسجلة حاليًا.',
        data: { summary: dashboard.summary, health: dashboard.health },
        missingData: dashboard.health.missingData,
        sources: [{ module: 'executive-dashboard', label: 'لوحة القيادة التنفيذية', route: '/' }],
        suggestedActions: [
          {
            label: 'إنشاء تقرير تنفيذي',
            route: '/executive/reports',
            permission: 'reports.create',
          },
        ],
      };
    }
    throw new AppError(
      400,
      'هذا السؤال غير مدعوم في إصدار البيانات المؤسسية.',
      'UNSUPPORTED_EXECUTIVE_QUERY',
    );
  }

  private prepare(
    entity: ExecutiveEntity,
    input: Record<string, unknown>,
    current?: ExecutiveRecord,
  ) {
    if (entity === 'risks') {
      const likelihood = input.likelihood ?? current?.likelihood;
      const impact = input.impact ?? current?.impact;
      const residualLikelihood = input.residualLikelihood ?? current?.residualLikelihood;
      const residualImpact = input.residualImpact ?? current?.residualImpact;
      return {
        ...input,
        inherentScore: calculateRiskScore(likelihood as never, impact as never),
        residualScore: calculateRiskScore(residualLikelihood as never, residualImpact as never),
      };
    }
    return input;
  }

  private response(
    title: string,
    items: ExecutiveRecord[],
    module: string,
    route: string,
  ): ExecutiveResponse {
    return {
      mode: 'structured-data',
      title,
      summary:
        items.length === 0
          ? 'لا توجد سجلات مطابقة في البيانات الحالية.'
          : `تم العثور على ${items.length} سجلًا.`,
      data: items,
      missingData: [],
      sources: items.slice(0, 20).map((item) => ({
        module,
        recordId: item.id,
        label: String(item.title ?? item.name ?? item.nameAr ?? item.code ?? item.id),
        route,
      })),
      suggestedActions: [{ label: `فتح ${title}`, route }],
    };
  }

  private async requireSourceDocument(documentId: string | undefined, user: IdentityUser) {
    if (!documentId) return;
    const document = await this.documentStore.findDocument(documentId);
    if (!document) throw new AppError(404, 'Source document not found.', 'NOT_FOUND');
    await requireDocumentAccess(this.documentStore, document, user, 'view');
  }

  private async sanitizeSourceReferences(
    result: Awaited<ReturnType<ExecutiveStore['metricHistory']>>,
    user: IdentityUser,
  ) {
    const items = await Promise.all(
      result.items.map(async (item) => {
        const sourceDocumentId =
          typeof item.sourceDocumentId === 'string' ? item.sourceDocumentId : null;
        if (!sourceDocumentId) return item;
        const document = await this.documentStore.findDocument(sourceDocumentId);
        if (document && (await canAccessDocument(this.documentStore, document, user, 'view'))) {
          return item;
        }
        const { sourceDocumentId: _restricted, ...safe } = item;
        void _restricted;
        return { ...safe, sourceDocumentRestricted: true };
      }),
    );
    return { ...result, items };
  }

  private audit(
    action: string,
    entityType: string,
    entityId: string,
    user: IdentityUser,
    context: RequestMeta,
    metadata?: Record<string, unknown>,
  ) {
    return this.identityStore.createAudit({
      userId: user.id,
      action,
      entityType,
      entityId,
      description: `${entityType} operation recorded.`,
      metadata,
      ...context,
    });
  }
}
