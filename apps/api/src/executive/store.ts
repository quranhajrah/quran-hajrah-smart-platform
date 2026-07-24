import type {
  AlertCandidate,
  AlertStatus,
  ExecutiveDashboardBase,
  ExecutiveEntity,
  HealthWeights,
  MetricSummary,
  PageQuery,
  PageResult,
} from './types.js';

export type ExecutiveRecord = Record<string, unknown> & { id: string };

export interface ExecutiveStore {
  list(entity: ExecutiveEntity, query: PageQuery): Promise<PageResult<ExecutiveRecord>>;
  find(entity: ExecutiveEntity, id: string): Promise<ExecutiveRecord | null>;
  create(
    entity: ExecutiveEntity,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutiveRecord>;
  update(
    entity: ExecutiveEntity,
    id: string,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutiveRecord>;
  softDelete(entity: ExecutiveEntity, id: string, userId: string): Promise<void>;

  recordMetric(
    metricId: string,
    input: {
      numericValue?: number;
      textValue?: string;
      measuredAt: Date;
      sourceType?: string;
      sourceDocumentId?: string;
      notes?: string;
    },
    userId: string,
  ): Promise<ExecutiveRecord>;
  metricHistory(metricId: string, query: PageQuery): Promise<PageResult<ExecutiveRecord>>;
  metricSummaries(): Promise<MetricSummary[]>;

  recordKpi(
    kpiId: string,
    input: { value: number; measuredAt: Date; notes?: string; sourceDocumentId?: string },
    status: string,
    userId: string,
  ): Promise<ExecutiveRecord>;
  kpiHistory(kpiId: string, query: PageQuery): Promise<PageResult<ExecutiveRecord>>;

  addMilestone(
    initiativeId: string,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutiveRecord>;
  addInitiativeUpdate(
    initiativeId: string,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutiveRecord>;
  addRiskTreatment(
    riskId: string,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutiveRecord>;
  linkEvidence(
    entity: 'initiative' | 'risk',
    entityId: string,
    documentId: string,
    userId: string,
  ): Promise<void>;

  dashboardBase(): Promise<ExecutiveDashboardBase>;
  getHealthWeights(userId: string): Promise<HealthWeights>;
  updatePreferences(
    userId: string,
    input: { healthWeights: HealthWeights; layout?: unknown; quickActions?: string[] },
  ): Promise<ExecutiveRecord>;
  createHealthSnapshot(
    input: {
      score: number | null;
      coverage: number;
      rating: string | null;
      components: unknown;
      missingData: string[];
      explanation: string;
    },
    userId: string,
  ): Promise<ExecutiveRecord>;
  healthHistory(limit: number): Promise<ExecutiveRecord[]>;

  listAlerts(query: PageQuery): Promise<PageResult<ExecutiveRecord>>;
  createAlert(input: Record<string, unknown>, userId: string): Promise<ExecutiveRecord>;
  actionAlert(
    id: string,
    action: 'acknowledge' | 'resolve' | 'dismiss',
    userId: string,
  ): Promise<ExecutiveRecord>;
  alertCandidates(now: Date): Promise<AlertCandidate[]>;
  upsertGeneratedAlert(candidate: AlertCandidate): Promise<ExecutiveRecord>;

  replaceReportSections(
    reportId: string,
    sections: Array<{
      title: string;
      content: unknown;
      sortOrder: number;
      sourceReferences?: unknown;
    }>,
    userId: string,
  ): Promise<ExecutiveRecord>;
  transitionReport(
    reportId: string,
    status: 'GENERATED' | 'APPROVED' | 'ARCHIVED',
    userId: string,
  ): Promise<ExecutiveRecord>;

  activity(query: PageQuery): Promise<PageResult<ExecutiveRecord>>;
  countAlerts(status?: AlertStatus): Promise<number>;
}
