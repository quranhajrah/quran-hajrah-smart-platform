import { useCallback, useEffect, useState } from 'react';
import type { ExecutiveRecord, PageResult } from './api';
import { useAuth } from './auth';
import {
  createExecutiveHealthSnapshot,
  loadLeadershipData,
  loadMetricTrend,
  loadRiskTrend,
  type InsightResult,
  type LeadershipData,
} from './executive-insights-data';
import {
  CardStateBoundary,
  ExecutiveCard,
  ExecutiveEmptyState,
  FreshnessBadge,
  PermissionGate,
  SourceBadge,
} from './ExecutiveFoundation';
import {
  AccessibleRiskHeatMatrix,
  ExecutiveBreadcrumbs,
  ExecutiveQueue,
  ExecutiveWritingPanel,
  MISSING_VALUE,
  MutationFeedback,
  RecordLinkCard,
  formatDate,
  formatNumber,
  formatStatus,
  recordNumber,
  recordString,
  relatedName,
  type RiskCellSelection,
} from './ExecutiveInsightsShared';
import {
  AccessibleStatusDistribution,
  CeoModeSummary,
  ExecutiveReportPipeline,
  HealthComponentBreakdown,
  InitiativePortfolioSummary,
  KnowledgeComplianceSummary,
  MetricProgressComparison,
  ObjectivePortfolio,
  type CeoSummaryItem,
  type StatusDistributionItem,
} from './ExecutiveLeadershipShared';
import { Link } from './router';

const kpiStatuses = ['NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED'] as const;
const initiativeStatuses = [
  'PLANNED',
  'ACTIVE',
  'AT_RISK',
  'DELAYED',
  'COMPLETED',
  'CANCELLED',
  'ON_HOLD',
] as const;

const distributionTone: Record<string, string> = {
  NOT_STARTED: 'neutral',
  PLANNED: 'neutral',
  ACTIVE: 'active',
  ON_TRACK: 'good',
  COMPLETED: 'complete',
  AT_RISK: 'warning',
  OFF_TRACK: 'danger',
  DELAYED: 'danger',
  CANCELLED: 'muted',
  ON_HOLD: 'warning',
};

const resultItems = (result: InsightResult<PageResult>) =>
  result.status === 'success' ? result.value.items : [];
const freshness = <T,>(result: InsightResult<T>) =>
  result.status === 'success' ? result.loadedAt : undefined;
const resultError = <T,>(result: InsightResult<T>) =>
  result.status === 'error' ? result.error : undefined;
const mergeResult = <T,>(previous: InsightResult<T>, next: InsightResult<T>) =>
  next.status === 'error' && previous.status === 'success' ? previous : next;

const mergeLeadershipData = (previous: LeadershipData, next: LeadershipData): LeadershipData => ({
  dashboard: mergeResult(previous.dashboard, next.dashboard),
  health: mergeResult(previous.health, next.health),
  metrics: mergeResult(previous.metrics, next.metrics),
  objectives: mergeResult(previous.objectives, next.objectives),
  kpiSummary: mergeResult(previous.kpiSummary, next.kpiSummary),
  kpis: mergeResult(previous.kpis, next.kpis),
  initiatives: mergeResult(previous.initiatives, next.initiatives),
  risks: mergeResult(previous.risks, next.risks),
  riskMatrix: mergeResult(previous.riskMatrix, next.riskMatrix),
  criticalRisks: mergeResult(previous.criticalRisks, next.criticalRisks),
  knowledge: mergeResult(previous.knowledge, next.knowledge),
  reports: mergeResult(previous.reports, next.reports),
});

const hasFailures = (data: LeadershipData) =>
  Object.values(data).some((result) => result.status === 'error');

const presentationFromUrl = () =>
  new URLSearchParams(window.location.search).get('mode') === 'ceo' ? 'ceo' : 'analysis';

function LeadershipLoading() {
  return (
    <section
      className="ex-insight-page ex-leadership-page"
      aria-label="جارٍ تحميل لوحة القيادة القيادية"
      aria-busy="true"
    >
      <div className="ex-page-heading">
        <div>
          <span className="ex-skeleton ex-skeleton-short" />
          <span className="ex-skeleton ex-skeleton-title" />
        </div>
      </div>
      <div className="ex-leadership-grid">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="ex-card ex-grid-six ex-dashboard-skeleton" key={index}>
            <div className="ex-card-loading">
              <span />
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ExecutiveLeadership() {
  const { user, permissions, can } = useAuth();
  const [data, setData] = useState<LeadershipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [presentation, setPresentation] = useState<'analysis' | 'ceo'>(presentationFromUrl);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [riskSelection, setRiskSelection] = useState<RiskCellSelection>(null);
  const [riskTrend, setRiskTrend] = useState<ExecutiveRecord[] | null>(null);
  const [riskTrendError, setRiskTrendError] = useState('');
  const [riskTrendBusy, setRiskTrendBusy] = useState(false);
  const [metricTrends, setMetricTrends] = useState<
    Record<string, { items: ExecutiveRecord[]; error?: string; busy?: boolean }>
  >({});

  const load = useCallback(
    async (force = false) => {
      if (!user) return;
      if (data) setRefreshing(true);
      else setLoading(true);
      setRefreshFailed(false);
      const next = await loadLeadershipData(user.id, permissions, { force });
      if (data && force && hasFailures(next)) {
        setData(mergeLeadershipData(data, next));
        setRefreshFailed(true);
      } else {
        setData(next);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [data, permissions, user],
  );

  useEffect(() => {
    let active = true;
    if (!user) return;
    setLoading(true);
    void loadLeadershipData(user.id, permissions).then((next) => {
      if (!active) return;
      setData(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [permissions, user]);

  const choosePresentation = (next: 'analysis' | 'ceo') => {
    const target = new URL(window.location.href);
    if (next === 'ceo') target.searchParams.set('mode', 'ceo');
    else target.searchParams.delete('mode');
    window.history.replaceState({}, '', `${target.pathname}${target.search}`);
    setPresentation(next);
  };

  const createSnapshot = async () => {
    setSnapshotBusy(true);
    setFeedback(null);
    try {
      await createExecutiveHealthSnapshot();
      setFeedback({ tone: 'success', message: 'تم إنشاء لقطة الصحة المؤسسية وتسجيلها.' });
      await load(true);
    } catch {
      setFeedback({
        tone: 'error',
        message: 'تعذر إنشاء لقطة الصحة. تحقق من الصلاحية وحالة البيانات ثم أعد المحاولة.',
      });
    } finally {
      setSnapshotBusy(false);
    }
  };

  const requestRiskTrend = async () => {
    if (!user) return;
    setRiskTrendBusy(true);
    setRiskTrendError('');
    try {
      setRiskTrend((await loadRiskTrend(user.id)).value);
    } catch {
      setRiskTrendError('تعذر تحميل اتجاه المخاطر. بقيت بقية الصفحة متاحة.');
    } finally {
      setRiskTrendBusy(false);
    }
  };

  const requestMetricTrend = async (metricId: string) => {
    if (!user) return;
    setMetricTrends((current) => ({
      ...current,
      [metricId]: { items: current[metricId]?.items ?? [], busy: true },
    }));
    try {
      const result = await loadMetricTrend(user.id, metricId);
      setMetricTrends((current) => ({
        ...current,
        [metricId]: { items: result.value.items },
      }));
    } catch {
      setMetricTrends((current) => ({
        ...current,
        [metricId]: {
          items: current[metricId]?.items ?? [],
          error: 'تعذر تحميل سجل القياسات.',
        },
      }));
    }
  };

  if (loading && !data) return <LeadershipLoading />;
  if (!data) return null;

  const dashboardSnapshot = data.dashboard.status === 'success' ? data.dashboard.value : null;
  const dashboard = dashboardSnapshot?.value;
  const health = data.health.status === 'success' ? data.health.value : dashboard?.health;
  const objectives = resultItems(data.objectives);
  const kpis = resultItems(data.kpis);
  const initiatives = resultItems(data.initiatives);
  const risks = resultItems(data.risks);
  const criticalRisks = resultItems(data.criticalRisks);
  const reports = resultItems(data.reports);
  const knowledge = data.knowledge.status === 'success' ? data.knowledge.value : null;
  const matrix = data.riskMatrix.status === 'success' ? data.riskMatrix.value : null;
  const kpiSummary = data.kpiSummary.status === 'success' ? data.kpiSummary.value : {};

  const kpiDistribution: StatusDistributionItem[] = kpiStatuses.map((status) => ({
    key: status,
    label: formatStatus(status),
    value: Number(kpiSummary[status] ?? 0),
    tone: distributionTone[status]!,
    to: `/executive/kpis?status=${status}`,
  }));
  const missingKpiValues = kpis.filter((kpi) => recordNumber(kpi, 'currentValue') === null).length;

  const initiativeDistribution: StatusDistributionItem[] = initiativeStatuses.map((status) => ({
    key: status,
    label: formatStatus(status),
    value: initiatives.filter((initiative) => recordString(initiative, 'status') === status).length,
    tone: distributionTone[status]!,
    to: `/executive/initiatives?status=${status}`,
  }));

  const filteredCriticalRisks = riskSelection
    ? criticalRisks.filter(
        (risk) =>
          recordString(risk, 'residualLikelihood') === riskSelection.likelihood &&
          recordString(risk, 'residualImpact') === riskSelection.impact,
      )
    : criticalRisks;

  const strategicMetrics = [
    {
      key: 'strategic_plan_progress',
      label: 'تقدم الخطة الاستراتيجية',
      metric: dashboard?.institutionalMetrics.strategic_plan_progress ?? null,
    },
    {
      key: 'operational_plan_progress',
      label: 'تقدم الخطة التشغيلية',
      metric: dashboard?.institutionalMetrics.operational_plan_progress ?? null,
    },
    {
      key: 'budget_execution_rate',
      label: 'تنفيذ الموازنة المؤسسية',
      metric: dashboard?.institutionalMetrics.budget_execution_rate ?? null,
    },
  ];

  const quranIndicators = dashboard
    ? Object.entries(dashboard.associationIndicators)
        .filter(([, indicator]) => indicator?.value !== null && indicator?.value !== undefined)
        .map(([key, indicator]) => ({ key, indicator: indicator! }))
    : [];

  const problems: CeoSummaryItem[] = [
    ...(can('alerts.view') && dashboard
      ? dashboard.alerts
          .filter((alert) => recordString(alert, 'severity') === 'CRITICAL')
          .map((alert) => ({
            id: `alert-${alert.id}`,
            title: recordString(alert, 'title'),
            detail: formatStatus(recordString(alert, 'status')),
            source: 'سجل التنبيهات التنفيذية',
            to: '/executive/command-center?queue=alerts',
            tone: 'problem' as const,
          }))
      : []),
    ...(can('risks.view')
      ? criticalRisks.map((risk) => ({
          id: `risk-${risk.id}`,
          title: recordString(risk, 'title'),
          detail: `الدرجة المتبقية ${formatNumber(recordNumber(risk, 'residualScore'))}`,
          source: 'سجل المخاطر المتبقية',
          to: `/executive/risks/${risk.id}`,
          tone: 'problem' as const,
        }))
      : []),
    ...(can('initiatives.view')
      ? initiatives
          .filter((item) => ['DELAYED', 'AT_RISK'].includes(recordString(item, 'status')))
          .map((initiative) => ({
            id: `initiative-${initiative.id}`,
            title: recordString(initiative, 'name'),
            detail: `${formatStatus(recordString(initiative, 'status'))} · التقدم ${formatNumber(
              recordNumber(initiative, 'progress'),
              '٪',
            )}`,
            source: 'سجل المبادرات التشغيلية',
            to: `/executive/initiatives/${initiative.id}`,
            tone: 'problem' as const,
          }))
      : []),
    ...(can('kpi.view')
      ? kpis
          .filter((kpi) => recordString(kpi, 'status') === 'OFF_TRACK')
          .map((kpi) => ({
            id: `kpi-${kpi.id}`,
            title: recordString(kpi, 'title'),
            detail: 'خارج المسار وفق الحالة المسجلة',
            source: 'سجل مؤشرات الأداء',
            to: `/executive/kpis/${kpi.id}`,
            tone: 'problem' as const,
          }))
      : []),
    ...(health?.missingData ?? []).map((component) => ({
      id: `coverage-${component}`,
      title: `تغطية غير مكتملة: ${component}`,
      detail: `التغطية الحالية ${health?.coverage.toLocaleString('ar-SA')}٪`,
      source: 'حساب الصحة المؤسسية',
      to: '/executive/health',
      tone: 'problem' as const,
    })),
  ].slice(0, 5);

  const opportunities: CeoSummaryItem[] = [
    ...(can('kpi.view')
      ? kpis
          .filter((kpi) => ['ON_TRACK', 'COMPLETED'].includes(recordString(kpi, 'status')))
          .map((kpi) => ({
            id: `kpi-opportunity-${kpi.id}`,
            title: recordString(kpi, 'title'),
            detail: `أداء ${formatStatus(recordString(kpi, 'status'))} يمكن البناء عليه`,
            source: 'الحالة المعتمدة لمؤشر الأداء',
            to: `/executive/kpis/${kpi.id}`,
            tone: 'opportunity' as const,
          }))
      : []),
    ...(can('initiatives.view')
      ? initiatives
          .filter((initiative) => recordString(initiative, 'status') === 'COMPLETED')
          .map((initiative) => ({
            id: `initiative-opportunity-${initiative.id}`,
            title: recordString(initiative, 'name'),
            detail: 'مبادرة مكتملة يمكن الاستفادة من نتائجها الموثقة',
            source: 'سجل المبادرات التشغيلية',
            to: `/executive/initiatives/${initiative.id}`,
            tone: 'opportunity' as const,
          }))
      : []),
    ...(health?.components ?? [])
      .filter((component) => !component.missing && (component.score ?? 0) >= 80)
      .map((component) => ({
        id: `health-opportunity-${component.key}`,
        title: component.label,
        detail: `درجة معتمدة ${component.score?.toLocaleString('ar-SA')} من 100`,
        source: 'مكونات الصحة المؤسسية',
        to: '/executive/health',
        tone: 'opportunity' as const,
      })),
  ].slice(0, 5);

  const pageFreshness =
    dashboardSnapshot?.loadedAt ??
    [
      freshness(data.health),
      freshness(data.metrics),
      freshness(data.objectives),
      freshness(data.kpis),
    ].find(Boolean);

  return (
    <section className="ex-insight-page ex-leadership-page">
      <ExecutiveBreadcrumbs current="لوحة القيادة القيادية" />
      <div className="ex-page-heading">
        <div>
          <small>المشهد القيادي القابل للدفاع</small>
          <h1>لوحة القيادة التنفيذية القيادية</h1>
          <p>قراءة مفصلة للصحة والتقدم والأثر والمعرفة، محكومة بالمصادر والصلاحيات الفعلية.</p>
        </div>
        <div className="ex-page-actions">
          {pageFreshness && <FreshnessBadge timestamp={pageFreshness} failed={refreshFailed} />}
          <button type="button" disabled={refreshing} onClick={() => void load(true)}>
            {refreshing ? 'جارٍ التحديث…' : 'تحديث اللوحة'}
          </button>
        </div>
      </div>

      <div className="ex-presentation-switch" role="group" aria-label="نمط عرض لوحة القيادة">
        <button
          type="button"
          className={presentation === 'analysis' ? 'is-active' : ''}
          aria-pressed={presentation === 'analysis'}
          onClick={() => choosePresentation('analysis')}
        >
          التحليل التفصيلي
        </button>
        <button
          type="button"
          className={presentation === 'ceo' ? 'is-active' : ''}
          aria-pressed={presentation === 'ceo'}
          onClick={() => choosePresentation('ceo')}
        >
          نمط الرئيس التنفيذي
        </button>
      </div>

      {refreshFailed && (
        <div className="ex-refresh-warning" role="status">
          <strong>تعذر التحديث</strong>
          <span>تستمر اللوحة في عرض آخر قيم ناجحة مع أوقات تحميلها الأصلية.</span>
        </div>
      )}
      {feedback && (
        <MutationFeedback
          tone={feedback.tone}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {presentation === 'ceo' ? (
        <div className="ex-leadership-grid">
          <ExecutiveCard
            title="المشهد المختصر للرئيس التنفيذي"
            description="حتى خمس مشكلات وخمس فرص من السجلات المصرح بها؛ لا تُنشأ استنتاجات دون دليل."
            source="المصادر القيادية المصرح بها في هذه الصفحة"
            freshness={pageFreshness}
            freshnessFailed={refreshFailed}
            className="ex-grid-full"
          >
            <CeoModeSummary
              problems={problems}
              opportunities={opportunities}
              recommendationAction={
                can('executive_ai.recommendations') ? (
                  <ExecutiveWritingPanel mode="recommendations" />
                ) : undefined
              }
            />
          </ExecutiveCard>
        </div>
      ) : (
        <div className="ex-leadership-grid">
          <ExecutiveCard
            title="الصحة والتغطية"
            description="الصيغة والأوزان الحالية من محرك الصحة التنفيذي دون تعديل."
            source="GET /api/executive/health"
            sourceTo="/executive/health"
            freshness={freshness(data.health) ?? dashboardSnapshot?.loadedAt}
            freshnessFailed={refreshFailed}
            action={
              can('dashboard.configure') ? (
                <button
                  className="ex-card-action"
                  type="button"
                  disabled={snapshotBusy}
                  onClick={() => void createSnapshot()}
                >
                  {snapshotBusy ? 'جارٍ إنشاء اللقطة…' : 'إنشاء لقطة صريحة'}
                </button>
              ) : undefined
            }
            className="ex-grid-full"
          >
            <CardStateBoundary
              error={resultError(data.health)}
              empty={!health}
              staleMessage={refreshFailed ? 'تعذر التحديث' : undefined}
              onRetry={() => void load(true)}
              emptyDescription="تعذر بناء الصحة دون تغطية معتمدة."
            >
              {health && (
                <>
                  <HealthComponentBreakdown
                    health={health}
                    loadedAt={freshness(data.health) ?? dashboardSnapshot?.loadedAt}
                  />
                  <div className="ex-health-trend">
                    <h3>اتجاه اللقطات المسجلة</h3>
                    {(health.history ?? []).length === 0 ? (
                      <ExecutiveEmptyState
                        title="لا توجد لقطات مسجلة"
                        description="إنشاء اللقطة إجراء صريح ومقيد بصلاحية تهيئة لوحة القيادة."
                        compact
                      />
                    ) : (
                      <ol>
                        {(health.history ?? []).slice(0, 8).map((snapshot) => (
                          <li key={snapshot.id}>
                            <time>{formatDate(snapshot.createdAt, true)}</time>
                            <strong>{formatNumber(recordNumber(snapshot, 'score'))}</strong>
                            <span>
                              تغطية {formatNumber(recordNumber(snapshot, 'coverage'), '٪')}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </>
              )}
            </CardStateBoundary>
          </ExecutiveCard>

          <PermissionGate permission="metrics.view">
            <ExecutiveCard
              title="التقدم الاستراتيجي والتشغيلي"
              description="ثلاثة قياسات مستقلة: الخطة الاستراتيجية، الخطة التشغيلية، وتنفيذ الموازنة المؤسسية."
              source="سجل المؤشرات المؤسسية المعتمدة"
              sourceTo="/executive/metrics"
              freshness={freshness(data.metrics) ?? dashboardSnapshot?.loadedAt}
              freshnessFailed={refreshFailed}
              className="ex-grid-full"
            >
              <CardStateBoundary
                error={resultError(data.metrics)}
                empty={!dashboard}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد قياسات مؤسسية متاحة."
              >
                <MetricProgressComparison
                  metrics={strategicMetrics}
                  loadedAt={freshness(data.metrics) ?? dashboardSnapshot?.loadedAt}
                />
                <p className="ex-formula-note">
                  تنفيذ الموازنة المؤسسية قياس مستقل ولا يساوي فروق إنفاق المبادرات. لا تُعرض قيمة
                  غير مقاسة على أنها صفر.
                </p>
              </CardStateBoundary>
            </ExecutiveCard>
          </PermissionGate>

          <PermissionGate permission="strategy.view">
            <ExecutiveCard
              title="محفظة الأهداف"
              description="الأهداف الاستراتيجية المصرح بها مع روابط المؤشرات والمبادرات القائمة."
              source="GET /api/executive/objectives"
              sourceTo="/executive/objectives"
              freshness={freshness(data.objectives)}
              freshnessFailed={refreshFailed}
              className="ex-grid-full"
            >
              <CardStateBoundary
                error={resultError(data.objectives)}
                empty={data.objectives.status === 'success' && objectives.length === 0}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد أهداف استراتيجية مصرح بها."
              >
                <ObjectivePortfolio objectives={objectives} />
              </CardStateBoundary>
            </ExecutiveCard>
          </PermissionGate>

          <PermissionGate permission="kpi.view">
            <ExecutiveCard
              title="توزيع مؤشرات الأداء"
              description="مجموع الحالات الظاهرة يساوي الإجمالي المصرح به، والقيم المفقودة لا تعامل كصفر."
              source="GET /api/executive/kpis/summary وGET /api/executive/kpis"
              sourceTo="/executive/kpis"
              freshness={freshness(data.kpiSummary) ?? freshness(data.kpis)}
              freshnessFailed={refreshFailed}
              action={
                can('kpi.measure') ? (
                  <Link className="ex-card-action" to="/executive/kpis">
                    فتح مسار القياس
                  </Link>
                ) : undefined
              }
              className="ex-grid-six"
            >
              <CardStateBoundary
                error={resultError(data.kpiSummary) ?? resultError(data.kpis)}
                empty={data.kpiSummary.status === 'success' && kpis.length === 0}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد مؤشرات أداء مصرح بها."
              >
                <AccessibleStatusDistribution title="توزيع مؤشرات الأداء" items={kpiDistribution} />
                <p className="ex-coverage-line">
                  التغطية القياسية: {(kpis.length - missingKpiValues).toLocaleString('ar-SA')} من{' '}
                  {kpis.length.toLocaleString('ar-SA')} لديها قيمة حالية؛ القيم المفقودة:{' '}
                  {missingKpiValues.toLocaleString('ar-SA')}.
                </p>
              </CardStateBoundary>
            </ExecutiveCard>
          </PermissionGate>

          <PermissionGate permission="initiatives.view">
            <ExecutiveCard
              title="محفظة المبادرات"
              description="الحالات والتقدم وإنفاق المبادرات مع فصل كامل عن الموازنة المؤسسية."
              source="GET /api/executive/initiatives"
              sourceTo="/executive/initiatives"
              freshness={freshness(data.initiatives)}
              freshnessFailed={refreshFailed}
              action={
                can('initiatives.manage') ? (
                  <Link className="ex-card-action" to="/executive/initiatives">
                    فتح مسار التحديث
                  </Link>
                ) : undefined
              }
              className="ex-grid-six"
            >
              <CardStateBoundary
                error={resultError(data.initiatives)}
                empty={data.initiatives.status === 'success' && initiatives.length === 0}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد مبادرات تشغيلية مصرح بها."
              >
                <AccessibleStatusDistribution
                  title="توزيع حالات المبادرات"
                  items={initiativeDistribution}
                />
                <InitiativePortfolioSummary initiatives={initiatives} />
                <div className="ex-initiative-lead-records" role="list">
                  {initiatives
                    .filter((item) => ['DELAYED', 'AT_RISK'].includes(recordString(item, 'status')))
                    .slice(0, 5)
                    .map((initiative) => (
                      <RecordLinkCard
                        key={initiative.id}
                        to={`/executive/initiatives/${initiative.id}`}
                        title={recordString(initiative, 'name')}
                        eyebrow={formatStatus(recordString(initiative, 'status'))}
                        metadata={
                          <>
                            <span>الهدف: {relatedName(initiative, 'objective')}</span>
                            <span>
                              التقدم: {formatNumber(recordNumber(initiative, 'progress'), '٪')}
                            </span>
                            <span>آخر تحديث: {formatDate(initiative.updatedAt, true)}</span>
                          </>
                        }
                      />
                    ))}
                </div>
              </CardStateBoundary>
            </ExecutiveCard>
          </PermissionGate>

          <PermissionGate permission="risks.view">
            <ExecutiveCard
              title="ملف المخاطر"
              description="المخاطر المتبقية حسب تصنيف الخادم؛ الحد الحرج وبدائل الرسم ظاهرة."
              source="واجهات المخاطر التنفيذية القائمة"
              sourceTo="/executive/risks"
              freshness={freshness(data.risks) ?? freshness(data.riskMatrix)}
              freshnessFailed={refreshFailed}
              action={
                <button
                  className="ex-card-action"
                  type="button"
                  disabled={riskTrendBusy}
                  onClick={() => void requestRiskTrend()}
                >
                  {riskTrendBusy ? 'جارٍ تحميل الاتجاه…' : 'تحميل اتجاه المخاطر'}
                </button>
              }
              className="ex-grid-full"
            >
              <CardStateBoundary
                error={
                  resultError(data.risks) ??
                  resultError(data.riskMatrix) ??
                  resultError(data.criticalRisks)
                }
                empty={data.risks.status === 'success' && risks.length === 0}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد مخاطر مصرح بها."
              >
                <div className="ex-risk-profile-summary">
                  <span>السجلات: {risks.length.toLocaleString('ar-SA')}</span>
                  <span>
                    المتوسط المتبقي:{' '}
                    {dashboard
                      ? formatNumber(dashboard.summary.risks.averageResidualScore)
                      : MISSING_VALUE}
                  </span>
                  <span>الحد الحرج: {matrix?.criticalThreshold ?? 15} من 25</span>
                  <span>المقياس: احتمال 1–5 × أثر 1–5</span>
                </div>
                {matrix && (
                  <AccessibleRiskHeatMatrix
                    data={matrix}
                    selection={riskSelection}
                    onSelect={setRiskSelection}
                  />
                )}
                <div className="ex-critical-risk-list">
                  <h3>المخاطر الحرجة</h3>
                  <ExecutiveQueue
                    label="المخاطر الحرجة المصرح بها"
                    empty={filteredCriticalRisks.length === 0}
                    emptyDescription="لا توجد مخاطر حرجة مطابقة للخلية المختارة."
                  >
                    {filteredCriticalRisks.slice(0, 8).map((risk) => (
                      <RecordLinkCard
                        key={risk.id}
                        to={`/executive/risks/${risk.id}`}
                        title={recordString(risk, 'title')}
                        eyebrow={`الدرجة ${formatNumber(recordNumber(risk, 'residualScore'))}`}
                        metadata={
                          <>
                            <span>المالك: {relatedName(risk, 'owner')}</span>
                            <span>
                              المعالجات:{' '}
                              {Array.isArray(risk.treatments) ? risk.treatments.length : 0}
                            </span>
                            <span>المراجعة: {formatDate(risk.reviewDate)}</span>
                          </>
                        }
                      />
                    ))}
                  </ExecutiveQueue>
                </div>
                {riskTrendError && <MutationFeedback tone="error" message={riskTrendError} />}
                {riskTrend && (
                  <div className="ex-risk-trend" aria-label="الاتجاه الرقمي للمخاطر">
                    {riskTrend.map((point) => (
                      <div key={recordString(point, 'month')}>
                        <strong>{recordString(point, 'month')}</strong>
                        <span>الإجمالي {formatNumber(recordNumber(point, 'total'))}</span>
                        <span>المفتوح {formatNumber(recordNumber(point, 'open'))}</span>
                        <span>الحرج {formatNumber(recordNumber(point, 'critical'))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardStateBoundary>
            </ExecutiveCard>
          </PermissionGate>

          <ExecutiveCard
            title="مؤشرات الأثر القرآني"
            description="قياسات مؤسسية معتمدة متاحة حاليًا؛ ليست معاملات تشغيلية مباشرة للحلقات."
            source="المؤشرات المؤسسية المرتبطة بالأثر القرآني"
            sourceTo={can('metrics.view') ? '/executive/metrics' : undefined}
            freshness={dashboardSnapshot?.loadedAt}
            freshnessFailed={refreshFailed}
            className="ex-grid-full"
          >
            <CardStateBoundary
              error={resultError(data.dashboard)}
              empty={Boolean(dashboard && quranIndicators.length === 0)}
              onRetry={() => void load(true)}
              emptyDescription="لا توجد قياسات أثر قرآني معتمدة بقيم حالية."
            >
              <div className="ex-quran-impact-grid" role="list">
                {quranIndicators.map(({ key, indicator }) => {
                  const trend = metricTrends[indicator.id];
                  return (
                    <article role="listitem" key={key}>
                      <small>قياس مؤسسي معتمد</small>
                      <h3>{indicator.nameAr}</h3>
                      <strong>
                        {indicator.value === null
                          ? MISSING_VALUE
                          : `${String(indicator.value)}${indicator.unit ? ` ${indicator.unit}` : ''}`}
                      </strong>
                      <p>تاريخ القياس: {formatDate(indicator.measuredAt)}</p>
                      <SourceBadge label="سجل المؤشرات المؤسسية" to="/executive/metrics" />
                      <FreshnessBadge timestamp={indicator.measuredAt} />
                      {can('metrics.view') && (
                        <button
                          type="button"
                          disabled={trend?.busy}
                          onClick={() => void requestMetricTrend(indicator.id)}
                        >
                          {trend?.busy ? 'جارٍ التحميل…' : 'تحميل سجل الاتجاه'}
                        </button>
                      )}
                      {trend?.error && <span className="ex-inline-error">{trend.error}</span>}
                      {trend && trend.items.length > 0 && (
                        <ol aria-label={`سجل قياسات ${indicator.nameAr}`}>
                          {trend.items.map((measurement) => (
                            <li key={measurement.id}>
                              <time>{formatDate(measurement.measuredAt)}</time>
                              <span>
                                {formatNumber(
                                  recordNumber(measurement, 'numericValue'),
                                  indicator.unit ?? undefined,
                                )}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </article>
                  );
                })}
              </div>
            </CardStateBoundary>
          </ExecutiveCard>

          {(can('documents.view') || can('document_analysis.view') || can('knowledge.search')) && (
            <ExecutiveCard
              title="امتثال المعرفة والوثائق"
              description="الأعداد والعناوين ضمن نطاق السرية والصلاحيات الحالية فقط."
              source="لوحة الوثائق، تحليل المستندات، وملخص الفهرس المعرفي"
              sourceTo={can('documents.view') ? '/documents' : '/knowledge-intelligence'}
              freshness={dashboardSnapshot?.loadedAt ?? freshness(data.knowledge)}
              freshnessFailed={refreshFailed}
              className="ex-grid-full"
            >
              <CardStateBoundary
                error={resultError(data.dashboard) ?? resultError(data.knowledge)}
                empty={!dashboard}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد بيانات امتثال معرفي مصرح بها."
              >
                {dashboard && (
                  <>
                    <KnowledgeComplianceSummary
                      documents={can('documents.view') ? dashboard.summary.documents : null}
                      analysis={can('document_analysis.view') ? dashboard.documentAnalysis : null}
                      knowledge={can('knowledge.search') ? knowledge : null}
                    />
                    {can('documents.view') && (
                      <div className="ex-recent-compliance-documents" role="list">
                        {dashboard.recentDocuments.slice(0, 5).map((document) => (
                          <RecordLinkCard
                            key={document.id}
                            to={`/documents/${document.id}`}
                            title={document.title}
                            eyebrow={document.status}
                            metadata={
                              <>
                                <span>{document.owningDepartment || MISSING_VALUE}</span>
                                <span>السرية: {document.confidentialityLevel}</span>
                                <span>التحديث: {formatDate(document.updatedAt)}</span>
                              </>
                            }
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardStateBoundary>
            </ExecutiveCard>
          )}

          <PermissionGate permission="reports.view">
            <ExecutiveCard
              title="مسار التقارير التنفيذية"
              description="الحالات الفعلية للتقارير والوجهات المتاحة وفق صلاحيات العمل القائمة."
              source="GET /api/executive/reports"
              sourceTo="/executive/reports"
              freshness={freshness(data.reports)}
              freshnessFailed={refreshFailed}
              className="ex-grid-full"
            >
              <CardStateBoundary
                error={resultError(data.reports)}
                empty={data.reports.status === 'success' && reports.length === 0}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد تقارير تنفيذية مصرح بها."
              >
                <ExecutiveReportPipeline reports={reports} can={can} />
              </CardStateBoundary>
            </ExecutiveCard>
          </PermissionGate>
        </div>
      )}

      <footer className="ex-insight-footer">
        <SourceBadge label="واجهات Enterprise 22–26.1 القائمة" />
        <span>لا تُنفذ استعلامات معرفة أو ذكاء اصطناعي تلقائيًا عند فتح اللوحة.</span>
        <Link to="/executive/command-center">العودة إلى مركز القيادة</Link>
      </footer>
    </section>
  );
}
