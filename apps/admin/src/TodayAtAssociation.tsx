import { useCallback, useEffect, useState } from 'react';
import { type ExecutiveRecord, type PageResult } from './api';
import { useAuth } from './auth';
import {
  loadExecutiveActivityPage,
  loadTodayData,
  mutateExecutiveAlert,
  type InsightResult,
  type TodayData,
} from './executive-insights-data';
import {
  AlertQueue,
  DeadlineGroup,
  DomainCoverageNotice,
  ExecutiveBreadcrumbs,
  ExecutiveQueue,
  ExecutiveWritingPanel,
  MISSING_VALUE,
  MutationFeedback,
  RecordLinkCard,
  daysFromToday,
  formatDate,
  formatStatus,
  recordString,
  sameLocalDay,
} from './ExecutiveInsightsShared';
import {
  CardStateBoundary,
  CoverageNotice,
  ExecutiveCard,
  FreshnessBadge,
  PermissionGate,
  SourceBadge,
} from './ExecutiveFoundation';
import { Link } from './router';

const reviewStatuses = new Set([
  'PROPOSALS_READY',
  'UNDER_REVIEW',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'OCR_REQUIRED',
  'FAILED',
]);

const resultError = <T,>(result: InsightResult<T>) =>
  result.status === 'error' ? result.error : undefined;

const resultItems = <T extends ExecutiveRecord>(result: InsightResult<PageResult<T>>) =>
  result.status === 'success' ? result.value.items : [];

const freshness = <T,>(result: InsightResult<T>) =>
  result.status === 'success' ? result.loadedAt : null;

const mergeResult = <T,>(previous: InsightResult<T>, next: InsightResult<T>) =>
  next.status === 'error' && previous.status === 'success' ? previous : next;

const mergeData = (previous: TodayData, next: TodayData): TodayData => ({
  dashboard: mergeResult(previous.dashboard, next.dashboard),
  deadlines: mergeResult(previous.deadlines, next.deadlines),
  alerts: mergeResult(previous.alerts, next.alerts),
  activity: mergeResult(previous.activity, next.activity),
  analysisJobs: mergeResult(previous.analysisJobs, next.analysisJobs),
});

const hasFailures = (data: TodayData) =>
  [data.dashboard, data.deadlines, data.alerts, data.activity, data.analysisJobs].some(
    (result) => result.status === 'error',
  );

const activityRoute = (activity: ExecutiveRecord) => {
  const id = typeof activity.entityId === 'string' ? activity.entityId : null;
  if (!id) return null;
  const action = recordString(activity, 'action');
  if (action.startsWith('initiatives.')) return `/executive/initiatives/${id}`;
  if (action.startsWith('risks.')) return `/executive/risks/${id}`;
  if (action.startsWith('kpi.')) return `/executive/kpis/${id}`;
  if (action.startsWith('metrics.')) return `/executive/metrics/${id}`;
  if (action.startsWith('objectives.')) return `/executive/objectives/${id}`;
  if (action.startsWith('reports.')) return `/executive/reports/${id}`;
  if (action.startsWith('alerts.')) return '/executive/alerts';
  return null;
};

const sourcePermission: Record<string, string> = {
  initiatives: 'initiatives.view',
  initiative: 'initiatives.view',
  risks: 'risks.view',
  risk: 'risks.view',
  kpi: 'kpi.view',
  metrics: 'metrics.view',
  documents: 'documents.view',
  document_analysis: 'document_analysis.view',
  reports: 'reports.view',
};

function TodayLoading() {
  return (
    <section className="ex-insight-page" aria-label="جارٍ تحميل اليوم في الجمعية" aria-busy="true">
      <div className="ex-page-heading">
        <div>
          <span className="ex-skeleton ex-skeleton-short" />
          <span className="ex-skeleton ex-skeleton-title" />
        </div>
      </div>
      <div className="ex-today-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="ex-card ex-dashboard-skeleton" key={index}>
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

export function TodayAtAssociation() {
  const { user, permissions, can } = useAuth();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [busyAlert, setBusyAlert] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [additionalActivity, setAdditionalActivity] = useState<ExecutiveRecord[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!user) return;
      if (data) setRefreshing(true);
      else setLoading(true);
      setRefreshFailed(false);
      const next = await loadTodayData(user.id, permissions, { force });
      if (data && force && hasFailures(next)) {
        setData(mergeData(data, next));
        setRefreshFailed(true);
      } else {
        setData(next);
      }
      setAdditionalActivity([]);
      setActivityPage(1);
      setLoading(false);
      setRefreshing(false);
    },
    [data, permissions, user],
  );

  useEffect(() => {
    let active = true;
    if (!user) return;
    setLoading(true);
    void loadTodayData(user.id, permissions).then((next) => {
      if (!active) return;
      setData(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [permissions, user]);

  if (loading && !data) return <TodayLoading />;
  if (!data) return null;

  const dashboardSnapshot = data.dashboard.status === 'success' ? data.dashboard.value : null;
  const dashboard = dashboardSnapshot?.value;
  const alerts = resultItems(data.alerts);
  const analysisJobs = resultItems(data.analysisJobs).filter((job) =>
    reviewStatuses.has(job.status),
  );
  const initialActivity = resultItems(data.activity);
  const activity = [...initialActivity, ...additionalActivity];
  const activityTotal = data.activity.status === 'success' ? data.activity.value.total : 0;
  const deadlines = resultItems(data.deadlines);
  const dueToday = deadlines.filter((item) => sameLocalDay(item.endDate ?? item.dueDate));
  const nextSeven = deadlines.filter((item) => {
    const days = daysFromToday(item.endDate ?? item.dueDate);
    return days !== null && days >= 0 && days <= 7;
  });
  const dailyAlerts = alerts.filter((alert) => {
    const dueDays = daysFromToday(alert.dueDate);
    return (
      sameLocalDay(alert.createdAt) ||
      dueDays === 0 ||
      (dueDays !== null && dueDays < 0 && ['OPEN', 'ACKNOWLEDGED'].includes(String(alert.status)))
    );
  });
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'CRITICAL').length;

  const attentionItems = [
    ...(can('alerts.view') && data.alerts.status === 'success'
      ? [
          {
            label: 'التنبيهات الحرجة',
            value: criticalAlerts,
            to: '/executive/command-center?queue=alerts',
          },
        ]
      : []),
    ...(can('risks.view') && dashboard
      ? [
          {
            label: 'المخاطر الحرجة',
            value: dashboard.summary.risks.critical,
            to: '/executive/command-center?queue=risks',
          },
        ]
      : []),
    ...(can('initiatives.view') && dashboard
      ? [
          {
            label: 'المبادرات المتأخرة',
            value: dashboard.summary.initiatives.delayed,
            to: '/executive/command-center?queue=initiatives',
          },
          {
            label: 'المبادرات المعرضة للخطر',
            value: dashboard.summary.initiatives.atRisk,
            to: '/executive/command-center?queue=initiatives',
          },
        ]
      : []),
    ...((can('initiatives.view') || can('risks.view')) && data.deadlines.status === 'success'
      ? [
          {
            label: 'استحقاقات اليوم',
            value: dueToday.length,
            to: '/executive/command-center?queue=deadlines',
          },
        ]
      : []),
    ...(can('document_analysis.view') && data.analysisJobs.status === 'success'
      ? [
          {
            label: 'بانتظار المراجعة أو الاعتماد',
            value: analysisJobs.length,
            to: '/document-analysis',
          },
        ]
      : []),
  ];

  const actionAlert = async (
    alert: ExecutiveRecord,
    action: 'acknowledge' | 'resolve' | 'dismiss',
  ) => {
    if (!user) return;
    setBusyAlert(alert.id);
    setFeedback(null);
    try {
      const updated = await mutateExecutiveAlert(alert.id, action);
      const current = resultItems(data.alerts);
      const keep = ['OPEN', 'ACKNOWLEDGED'].includes(String(updated.status));
      const items = keep
        ? current.map((item) => (item.id === updated.id ? updated : item))
        : current.filter((item) => item.id !== updated.id);
      setData({
        ...data,
        alerts: {
          status: 'success',
          value: {
            ...(data.alerts.status === 'success'
              ? data.alerts.value
              : { page: 1, pageSize: 100, total: 0 }),
            items,
            total: items.length,
          },
          loadedAt: new Date().toISOString(),
        },
      });
      setFeedback({ tone: 'success', message: 'تم تحديث التنبيه وتسجيل الإجراء بنجاح.' });
      const refreshed = await loadTodayData(user.id, permissions);
      if (refreshed.dashboard.status === 'success') {
        setData((currentData) =>
          currentData ? { ...currentData, dashboard: refreshed.dashboard } : currentData,
        );
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تعذر تحديث التنبيه. بقيت القائمة بحالتها السابقة.',
      });
    } finally {
      setBusyAlert(null);
    }
  };

  const loadMoreActivity = async () => {
    if (!user) return;
    const nextPage = activityPage + 1;
    setActivityLoading(true);
    try {
      const next = await loadExecutiveActivityPage(user.id, nextPage);
      setAdditionalActivity((items) => [...items, ...next.value.items]);
      setActivityPage(nextPage);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'تعذر تحميل نشاط إضافي.',
      });
    } finally {
      setActivityLoading(false);
    }
  };

  const pageFreshness =
    dashboardSnapshot?.loadedAt ??
    [
      freshness(data.deadlines),
      freshness(data.alerts),
      freshness(data.activity),
      freshness(data.analysisJobs),
    ].find(Boolean) ??
    null;

  return (
    <section className="ex-insight-page">
      <ExecutiveBreadcrumbs current="اليوم في الجمعية" />
      <div className="ex-page-heading">
        <div>
          <small>
            {new Intl.DateTimeFormat('ar-SA', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(new Date())}
          </small>
          <h1>اليوم في الجمعية</h1>
          <p>موجز يومي واقعي، مبني على الوحدات المتاحة والبيانات المصرح بها فقط.</p>
        </div>
        <div className="ex-page-actions">
          <Link className="ex-secondary-link" to="/executive/command-center">
            مركز القيادة
          </Link>
          <Link className="ex-secondary-link" to="/executive/leadership">
            اللوحة القيادية
          </Link>
          {pageFreshness && <FreshnessBadge timestamp={pageFreshness} failed={refreshFailed} />}
          <button type="button" disabled={refreshing} onClick={() => void load(true)}>
            {refreshing ? 'جارٍ التحديث…' : 'تحديث موجز اليوم'}
          </button>
        </div>
      </div>

      {refreshFailed && (
        <div className="ex-refresh-warning" role="status">
          <strong>تعذر التحديث</strong>
          <span>تستمر الصفحة في عرض آخر قيم ناجحة مع أوقاتها الأصلية.</span>
        </div>
      )}
      {feedback && (
        <MutationFeedback
          tone={feedback.tone}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <div className="ex-today-grid">
        <ExecutiveCard
          title="حالة اليوم"
          description="الصحة المؤسسية والتغطية وفق آخر تجميع ناجح."
          source="GET /api/executive/dashboard"
          sourceTo="/executive/health"
          freshness={dashboardSnapshot?.loadedAt}
          freshnessFailed={refreshFailed}
          action={
            <Link className="ex-card-action" to="/executive/health">
              شرح الصحة
            </Link>
          }
          className="ex-grid-full ex-daily-status"
        >
          <CardStateBoundary
            error={resultError(data.dashboard)}
            empty={!dashboard}
            onRetry={() => void load(true)}
            emptyDescription="لا تتوفر قراءة مؤسسية معتمدة الآن."
          >
            {dashboard && (
              <div className="ex-daily-health">
                <div>
                  <span>درجة الصحة المؤسسية</span>
                  <strong>
                    {dashboard.health.score === null
                      ? MISSING_VALUE
                      : dashboard.health.score.toLocaleString('ar-SA')}
                  </strong>
                  <small>{dashboard.health.rating ?? 'التقييم غير متاح'}</small>
                </div>
                <CoverageNotice
                  coverage={dashboard.health.coverage}
                  missing={dashboard.health.missingData}
                />
                <Link to="/executive/command-center">فتح مركز القيادة</Link>
              </div>
            )}
          </CardStateBoundary>
        </ExecutiveCard>

        <ExecutiveCard
          title="ما يتطلب الانتباه اليوم"
          description="ملخص الاستثناءات المصرح بها، دون كشف مجاميع الوحدات المحجوبة."
          source="التجميع التنفيذي والقوائم المصرح بها"
          freshness={pageFreshness}
          freshnessFailed={refreshFailed}
          className="ex-grid-full"
        >
          <div className="ex-attention-grid">
            {attentionItems.map((item) => (
              <Link key={item.label} to={item.to}>
                <span>{item.label}</span>
                <strong>{item.value.toLocaleString('ar-SA')}</strong>
                <small>فتح القائمة المصفاة</small>
              </Link>
            ))}
            {attentionItems.length === 0 && <p>لا توجد وحدات متابعة مصرح بها ضمن حسابك الحالي.</p>}
          </div>
        </ExecutiveCard>

        <PermissionGate permission="alerts.view">
          <ExecutiveCard
            title="تنبيهات اليوم"
            description="المنشأة اليوم، أو المستحقة اليوم، أو المتأخرة وما زالت مفتوحة."
            source="GET /api/executive/alerts"
            sourceTo="/executive/alerts"
            freshness={freshness(data.alerts)}
            freshnessFailed={refreshFailed}
            className="ex-grid-full"
          >
            <CardStateBoundary
              error={resultError(data.alerts)}
              empty={data.alerts.status === 'success' && dailyAlerts.length === 0}
              onRetry={() => void load(true)}
              emptyDescription="لا توجد تنبيهات يومية ضمن الحدود الزمنية الحالية."
            >
              <AlertQueue
                items={dailyAlerts}
                canManage={can('alerts.manage')}
                busyId={busyAlert}
                onAction={(alert, action) => void actionAlert(alert, action)}
                canOpenSource={(alert) => {
                  const permission = sourcePermission[recordString(alert, 'sourceModule')];
                  return !permission || can(permission);
                }}
                emptyDescription="لا توجد تنبيهات يومية."
              />
            </CardStateBoundary>
          </ExecutiveCard>
        </PermissionGate>

        {(can('initiatives.view') || can('risks.view')) && (
          <ExecutiveCard
            title="الأيام السبعة القادمة"
            description="مبادرات تشغيلية ومعالجات مخاطر فقط، دون توسيع نطاق التغطية."
            source="GET /api/executive/deadlines?days=30"
            freshness={freshness(data.deadlines)}
            freshnessFailed={refreshFailed}
            className="ex-grid-six"
          >
            <CardStateBoundary
              error={resultError(data.deadlines)}
              empty={data.deadlines.status === 'success' && nextSeven.length === 0}
              onRetry={() => void load(true)}
              emptyDescription="لا توجد استحقاقات مبادرات أو معالجات مخاطر خلال الأيام السبعة القادمة."
            >
              <DeadlineGroup title="الاستحقاقات القادمة" items={nextSeven} />
            </CardStateBoundary>
          </ExecutiveCard>
        )}

        <PermissionGate permission="document_analysis.view">
          <ExecutiveCard
            title="قائمة المراجعة والاعتماد"
            description="حالات التحليل الفعلية التي تتطلب مراجعة أو اعتمادًا أو استيرادًا أو معالجة."
            source="GET /api/document-analysis/jobs"
            sourceTo="/document-analysis"
            freshness={freshness(data.analysisJobs)}
            freshnessFailed={refreshFailed}
            className="ex-grid-six"
          >
            <CardStateBoundary
              error={resultError(data.analysisJobs)}
              empty={data.analysisJobs.status === 'success' && analysisJobs.length === 0}
              onRetry={() => void load(true)}
              emptyDescription="لا توجد عمليات تحليل في حالات تتطلب متابعة."
            >
              <ExecutiveQueue
                label="قائمة مراجعة تحليل المستندات"
                empty={analysisJobs.length === 0}
                emptyDescription="لا توجد عمليات تحليل تتطلب متابعة."
              >
                {analysisJobs.map((job) => (
                  <RecordLinkCard
                    key={job.id}
                    to={`/document-analysis/jobs/${job.id}`}
                    title={job.document?.title ?? MISSING_VALUE}
                    eyebrow={formatStatus(job.status)}
                    metadata={
                      <>
                        <span>آخر تحديث: {formatDate(job.updatedAt, true)}</span>
                        <span>المقترحات: {job.proposalCount.toLocaleString('ar-SA')}</span>
                        {job.reviewDueAt && (
                          <span>استحقاق المراجعة: {formatDate(job.reviewDueAt)}</span>
                        )}
                      </>
                    }
                  />
                ))}
              </ExecutiveQueue>
            </CardStateBoundary>
          </ExecutiveCard>
        </PermissionGate>

        <ExecutiveCard
          title="النشاط المؤسسي المهم"
          description="أنشطة الوحدات المصرح بها فقط؛ يظهر الفاعل لمن يملك صلاحية التدقيق."
          source="GET /api/executive/activity"
          freshness={freshness(data.activity)}
          freshnessFailed={refreshFailed}
          className="ex-grid-seven"
        >
          <CardStateBoundary
            error={resultError(data.activity)}
            empty={data.activity.status === 'success' && activity.length === 0}
            onRetry={() => void load(true)}
            emptyDescription="لا يوجد نشاط مؤسسي مصرح بعرضه."
          >
            <ExecutiveQueue
              label="النشاط المؤسسي"
              empty={activity.length === 0}
              emptyDescription="لا يوجد نشاط مؤسسي."
            >
              {activity.map((item) => {
                const route = activityRoute(item);
                const actor =
                  item.user && typeof item.user === 'object'
                    ? recordString(item.user as ExecutiveRecord, 'fullName')
                    : null;
                const content = (
                  <>
                    <div>
                      <small>{recordString(item, 'action')}</small>
                      <strong>{recordString(item, 'description')}</strong>
                    </div>
                    <span>{actor ? `بواسطة ${actor}` : 'الفاعل محجوب وفق الصلاحية'}</span>
                    <time>{formatDate(item.createdAt, true)}</time>
                  </>
                );
                return route ? (
                  <Link className="ex-activity-row" role="listitem" key={item.id} to={route}>
                    {content}
                  </Link>
                ) : (
                  <article className="ex-activity-row" role="listitem" key={item.id}>
                    {content}
                  </article>
                );
              })}
            </ExecutiveQueue>
            {activity.length < activityTotal && (
              <button
                type="button"
                className="ex-load-more"
                disabled={activityLoading}
                onClick={() => void loadMoreActivity()}
              >
                {activityLoading ? 'جارٍ التحميل…' : 'تحميل نشاط إضافي'}
              </button>
            )}
          </CardStateBoundary>
        </ExecutiveCard>

        <PermissionGate permission="documents.view">
          <ExecutiveCard
            title="وثائق أتيحت حديثًا"
            description="العناوين التي أعادها مصدر الوثائق بعد تطبيق السرية وصلاحيات الوصول."
            source="بيانات الوثائق المفلترة في لوحة القيادة"
            sourceTo="/documents"
            freshness={dashboardSnapshot?.loadedAt}
            freshnessFailed={refreshFailed}
            className="ex-grid-five"
          >
            <CardStateBoundary
              error={resultError(data.dashboard)}
              empty={Boolean(dashboard && dashboard.recentDocuments.length === 0)}
              onRetry={() => void load(true)}
              emptyDescription="لا توجد وثائق حديثة مرئية ضمن نطاق وصولك."
            >
              <ExecutiveQueue
                label="الوثائق المتاحة حديثًا"
                empty={!dashboard || dashboard.recentDocuments.length === 0}
                emptyDescription="لا توجد وثائق حديثة."
              >
                {(dashboard?.recentDocuments ?? []).map((document) => (
                  <RecordLinkCard
                    key={document.id}
                    to={`/documents/${document.id}`}
                    title={document.title}
                    eyebrow={document.category?.name ?? document.documentType}
                    metadata={
                      <>
                        <span>{document.owningDepartment || MISSING_VALUE}</span>
                        <span>السرية: {document.confidentialityLevel}</span>
                        <span>أتيح/حُدّث: {formatDate(document.updatedAt)}</span>
                      </>
                    }
                  />
                ))}
              </ExecutiveQueue>
            </CardStateBoundary>
          </ExecutiveCard>
        </PermissionGate>

        <PermissionGate permission="executive_ai.reports">
          <ExecutiveCard
            title="الموجز التنفيذي اليومي"
            description="صياغة مهنية عند الطلب، مبنية على الأدلة المؤسسية المصرح بها."
            source="POST /api/executive-ai/executive-report"
            sourceTo="/executive-assistant"
            className="ex-grid-full"
          >
            <ExecutiveWritingPanel mode="executive-report" />
          </ExecutiveCard>
        </PermissionGate>

        <div className="ex-grid-full">
          <DomainCoverageNotice />
        </div>
      </div>

      <footer className="ex-insight-footer">
        <SourceBadge label="مصادر مؤسسية مصرح بها فقط" />
        <span>تُستخدم حدود اليوم المحلية نفسها المستخدمة في التطبيق، دون نظام زمني موازٍ.</span>
      </footer>
    </section>
  );
}
