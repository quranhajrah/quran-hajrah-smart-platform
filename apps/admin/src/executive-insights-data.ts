import {
  api,
  ApiRequestError,
  type AnalysisJob,
  type ExecutiveRecord,
  type PageResult,
} from './api';
import {
  clearExecutiveDashboardCache,
  loadExecutiveDashboard,
  type ExecutiveDashboardSnapshot,
} from './executive-dashboard-data';

export type RiskHeatMatrixData = {
  scope: 'RESIDUAL';
  criticalThreshold: number;
  likelihoods: string[];
  impacts: string[];
  matrix: number[][];
};

export type ExecutiveAiSource = {
  reference: number;
  documentId: string;
  documentTitle: string;
  versionNumber: number;
  pageNumber?: number;
  section?: string;
  sourceUrl: string;
};

export type ExecutiveAiWritingResponse = {
  version: string;
  status: 'ANSWERED' | 'INSUFFICIENT_EVIDENCE';
  answer: string;
  executiveRecommendation: string;
  sources: ExecutiveAiSource[];
  supportingReferences: Array<{ reference: number; quote: string; relevance: string }>;
  writing: {
    style: string;
    audience: string;
    purpose: string;
    method: 'PROFESSIONAL_REWRITE';
  };
  evidence: {
    chunkCount: number;
    documentCount: number;
    combinedMultipleDocuments: boolean;
  };
  limitations: string[];
};

export type InsightResult<T> =
  | { status: 'success'; value: T; loadedAt: string }
  | { status: 'error'; error: string }
  | { status: 'skipped' };

export type CommandCenterData = {
  dashboard: InsightResult<ExecutiveDashboardSnapshot>;
  deadlines: InsightResult<PageResult>;
  alerts: InsightResult<PageResult>;
  initiatives: InsightResult<PageResult>;
  budgetInitiatives: InsightResult<PageResult>;
  kpis: InsightResult<PageResult>;
  kpiTrends: Record<string, InsightResult<PageResult>>;
  riskMatrix: InsightResult<RiskHeatMatrixData>;
  criticalRisks: InsightResult<PageResult>;
};

export type TodayData = {
  dashboard: InsightResult<ExecutiveDashboardSnapshot>;
  deadlines: InsightResult<PageResult>;
  alerts: InsightResult<PageResult>;
  activity: InsightResult<PageResult>;
  analysisJobs: InsightResult<PageResult<AnalysisJob>>;
};

type CacheEntry = {
  userId: string;
  value: unknown;
  loadedAt: string;
  expiresAt: number;
};

const CACHE_DURATION_MS = 30_000;
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<{ value: unknown; loadedAt: string }>>();

const protectedFailureCodes = new Set(['FORBIDDEN', 'INVALID_SESSION', 'AUTHENTICATION_REQUIRED']);

export function clearExecutiveInsightCache() {
  cache.clear();
  pending.clear();
}

export function invalidateExecutiveInsightQueries(prefix: string) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${prefix}:`)) cache.delete(key);
  }
  for (const key of pending.keys()) {
    if (key.startsWith(`${prefix}:`)) pending.delete(key);
  }
}

async function loadQuery<T>(
  userId: string,
  key: string,
  path: string,
  force = false,
): Promise<{ value: T; loadedAt: string }> {
  const cacheKey = `${key}:${userId}`;
  const cached = cache.get(cacheKey);
  if (!force && cached?.userId === userId && cached.expiresAt > Date.now()) {
    return { value: cached.value as T, loadedAt: cached.loadedAt };
  }

  const inFlight = pending.get(cacheKey);
  if (!force && inFlight) return inFlight as Promise<{ value: T; loadedAt: string }>;

  const request = api<T>(path)
    .then((value) => {
      const loadedAt = new Date().toISOString();
      cache.set(cacheKey, {
        userId,
        value,
        loadedAt,
        expiresAt: Date.now() + CACHE_DURATION_MS,
      });
      return { value, loadedAt };
    })
    .catch((error: unknown) => {
      if (error instanceof ApiRequestError && protectedFailureCodes.has(error.code ?? '')) {
        clearExecutiveInsightCache();
        clearExecutiveDashboardCache();
      }
      throw error;
    })
    .finally(() => {
      if (pending.get(cacheKey) === request) pending.delete(cacheKey);
    });

  pending.set(cacheKey, request as Promise<{ value: unknown; loadedAt: string }>);
  return request;
}

async function loadAllPages<T extends ExecutiveRecord>(
  userId: string,
  key: string,
  path: string,
  force = false,
): Promise<{ value: PageResult<T>; loadedAt: string }> {
  const pagePath = (page: number) =>
    `${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=100`;
  const first = await loadQuery<PageResult<T>>(userId, `${key}-page-1`, pagePath(1), force);
  const pageCount = Math.ceil(first.value.total / first.value.pageSize);
  if (pageCount <= 1) return first;

  const remaining = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => {
      const page = index + 2;
      return loadQuery<PageResult<T>>(userId, `${key}-page-${page}`, pagePath(page), force);
    }),
  );
  return {
    value: {
      ...first.value,
      items: [first.value.items, ...remaining.map((result) => result.value.items)].flat(),
    },
    loadedAt: first.loadedAt,
  };
}

const errorMessage = (label: string, error: unknown) =>
  error instanceof ApiRequestError && error.message
    ? error.message
    : `تعذر تحميل ${label}. حاول مرة أخرى.`;

async function safeLoad<T>(
  allowed: boolean,
  label: string,
  loader: () => Promise<{ value: T; loadedAt: string }>,
): Promise<InsightResult<T>> {
  if (!allowed) return { status: 'skipped' };
  try {
    const result = await loader();
    return { status: 'success', ...result };
  } catch (error) {
    return { status: 'error', error: errorMessage(label, error) };
  }
}

const has = (permissions: string[], permission: string) => permissions.includes(permission);

const loadDashboardResult = (
  userId: string,
  force: boolean,
): Promise<InsightResult<ExecutiveDashboardSnapshot>> =>
  safeLoad(true, 'الملخص التنفيذي', async () => {
    const value = await loadExecutiveDashboard(userId, { force });
    return { value, loadedAt: value.loadedAt };
  });

const loadAlertsResult = (userId: string, allowed: boolean, force: boolean, criticalOnly = false) =>
  safeLoad(allowed, 'التنبيهات التنفيذية', () =>
    loadAllPages(
      userId,
      criticalOnly ? 'alerts-critical' : 'alerts-open',
      `/executive/alerts?status=OPEN%2CACKNOWLEDGED${criticalOnly ? '&severity=CRITICAL' : ''}`,
      force,
    ),
  );

export async function loadCommandCenterData(
  userId: string,
  permissions: string[],
  options: { force?: boolean } = {},
): Promise<CommandCenterData> {
  const force = Boolean(options.force);
  const [
    dashboard,
    deadlines,
    alerts,
    initiatives,
    budgetInitiatives,
    kpis,
    riskMatrix,
    criticalRisks,
  ] = await Promise.all([
    loadDashboardResult(userId, force),
    safeLoad(
      has(permissions, 'initiatives.view') || has(permissions, 'risks.view'),
      'لوحة الاستحقاقات',
      () => loadAllPages(userId, 'executive-deadlines', '/executive/deadlines?days=30', force),
    ),
    loadAlertsResult(userId, has(permissions, 'alerts.view'), force, true),
    safeLoad(has(permissions, 'initiatives.view'), 'استثناءات المبادرات', () =>
      loadAllPages(
        userId,
        'initiative-exceptions',
        '/executive/initiatives?status=DELAYED%2CAT_RISK',
        force,
      ),
    ),
    safeLoad(has(permissions, 'initiatives.view'), 'استثناءات إنفاق المبادرات', () =>
      loadAllPages(userId, 'initiative-budget-exceptions', '/executive/initiatives', force),
    ),
    safeLoad(has(permissions, 'kpi.view'), 'استثناءات مؤشرات الأداء', () =>
      loadAllPages(userId, 'kpi-exceptions', '/executive/kpis?status=AT_RISK%2COFF_TRACK', force),
    ),
    safeLoad(has(permissions, 'risks.view'), 'مصفوفة المخاطر', () =>
      loadQuery<RiskHeatMatrixData>(
        userId,
        'risk-heat-matrix',
        '/executive/risks/heat-matrix',
        force,
      ),
    ),
    safeLoad(has(permissions, 'risks.view'), 'المخاطر الحرجة', () =>
      loadAllPages(userId, 'critical-risks', '/executive/risks/critical', force),
    ),
  ]);

  const kpiTrends: Record<string, InsightResult<PageResult>> = {};
  if (kpis.status === 'success') {
    await Promise.all(
      kpis.value.items.map(async (kpi) => {
        kpiTrends[kpi.id] = await safeLoad(true, 'اتجاه مؤشر الأداء', () =>
          loadQuery<PageResult>(
            userId,
            `kpi-trend-${kpi.id}`,
            `/executive/kpis/${kpi.id}/trend?page=1&pageSize=2`,
            force,
          ),
        );
      }),
    );
  }

  return {
    dashboard,
    deadlines,
    alerts,
    initiatives,
    budgetInitiatives,
    kpis,
    kpiTrends,
    riskMatrix,
    criticalRisks,
  };
}

export async function loadTodayData(
  userId: string,
  permissions: string[],
  options: { force?: boolean } = {},
): Promise<TodayData> {
  const force = Boolean(options.force);
  const [dashboard, deadlines, alerts, activity, analysisJobs] = await Promise.all([
    loadDashboardResult(userId, force),
    safeLoad(
      has(permissions, 'initiatives.view') || has(permissions, 'risks.view'),
      'الاستحقاقات القادمة',
      () => loadAllPages(userId, 'executive-deadlines', '/executive/deadlines?days=30', force),
    ),
    loadAlertsResult(userId, has(permissions, 'alerts.view'), force),
    safeLoad(has(permissions, 'dashboard.view'), 'النشاط المؤسسي', () =>
      loadQuery<PageResult>(
        userId,
        'activity-page-1',
        '/executive/activity?page=1&pageSize=10',
        force,
      ),
    ),
    safeLoad(has(permissions, 'document_analysis.view'), 'قائمة المراجعة والاعتماد', () =>
      loadQuery<PageResult<AnalysisJob>>(
        userId,
        'analysis-review-queue',
        '/document-analysis/jobs?page=1&pageSize=100',
        force,
      ),
    ),
  ]);
  return { dashboard, deadlines, alerts, activity, analysisJobs };
}

export function loadExecutiveActivityPage(userId: string, page: number, force = false) {
  return loadQuery<PageResult>(
    userId,
    `activity-page-${page}`,
    `/executive/activity?page=${page}&pageSize=10`,
    force,
  );
}

export async function mutateExecutiveAlert(
  id: string,
  action: 'acknowledge' | 'resolve' | 'dismiss',
) {
  const updated = await api<ExecutiveRecord>(`/executive/alerts/${id}/${action}`, {
    method: 'POST',
  });
  invalidateExecutiveInsightQueries('alerts-open');
  invalidateExecutiveInsightQueries('alerts-critical');
  clearExecutiveDashboardCache();
  return updated;
}

export function generateExecutiveWriting(
  endpoint: '/executive-ai/recommendations' | '/executive-ai/executive-report',
  question: string,
) {
  return api<ExecutiveAiWritingResponse>(endpoint, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
