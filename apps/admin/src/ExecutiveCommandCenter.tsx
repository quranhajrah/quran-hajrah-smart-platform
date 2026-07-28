import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ExecutiveRecord, type PageResult } from './api';
import { useAuth } from './auth';
import {
  loadCommandCenterData,
  mutateExecutiveAlert,
  type CommandCenterData,
  type InsightResult,
} from './executive-insights-data';
import {
  AccessibleBulletChart,
  AccessibleRiskHeatMatrix,
  AlertQueue,
  DeadlineGroup,
  ExecutiveBreadcrumbs,
  ExecutiveQueue,
  ExecutiveWritingPanel,
  ExceptionFilterBar,
  MISSING_VALUE,
  MutationFeedback,
  RecordLinkCard,
  calculateInitiativeVariance,
  daysFromToday,
  formatDate,
  formatMoney,
  formatNumber,
  formatStatus,
  recordNumber,
  recordString,
  relatedName,
  type RiskCellSelection,
} from './ExecutiveInsightsShared';
import {
  CardStateBoundary,
  ExecutiveCard,
  FreshnessBadge,
  PermissionGate,
  SourceBadge,
} from './ExecutiveFoundation';
import { Link } from './router';

const initialQueue = () => new URLSearchParams(window.location.search).get('queue') ?? '';

const resultError = <T,>(result: InsightResult<T>) =>
  result.status === 'error' ? result.error : undefined;

const resultItems = (result: InsightResult<PageResult>) =>
  result.status === 'success' ? result.value.items : [];

const freshness = <T,>(result: InsightResult<T>) =>
  result.status === 'success' ? result.loadedAt : null;

const mergeResult = <T,>(previous: InsightResult<T>, next: InsightResult<T>) =>
  next.status === 'error' && previous.status === 'success' ? previous : next;

const hasFailures = (data: CommandCenterData) =>
  [
    data.dashboard,
    data.deadlines,
    data.alerts,
    data.initiatives,
    data.budgetInitiatives,
    data.kpis,
    data.riskMatrix,
    data.criticalRisks,
    ...Object.values(data.kpiTrends),
  ].some((result) => result.status === 'error');

const mergeData = (previous: CommandCenterData, next: CommandCenterData): CommandCenterData => ({
  dashboard: mergeResult(previous.dashboard, next.dashboard),
  deadlines: mergeResult(previous.deadlines, next.deadlines),
  alerts: mergeResult(previous.alerts, next.alerts),
  initiatives: mergeResult(previous.initiatives, next.initiatives),
  budgetInitiatives: mergeResult(previous.budgetInitiatives, next.budgetInitiatives),
  kpis: mergeResult(previous.kpis, next.kpis),
  riskMatrix: mergeResult(previous.riskMatrix, next.riskMatrix),
  criticalRisks: mergeResult(previous.criticalRisks, next.criticalRisks),
  kpiTrends: Object.fromEntries(
    [...new Set([...Object.keys(previous.kpiTrends), ...Object.keys(next.kpiTrends)])].map(
      (key) => {
        const previousResult = previous.kpiTrends[key];
        const nextResult = next.kpiTrends[key];
        const value =
          previousResult && nextResult
            ? mergeResult(previousResult, nextResult)
            : (nextResult ?? previousResult);
        return [key, value!] as const;
      },
    ),
  ),
});

const entityPermission: Record<string, string> = {
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

function CommandLoading() {
  return (
    <section className="ex-insight-page" aria-label="جارٍ تحميل مركز القيادة" aria-busy="true">
      <div className="ex-page-heading">
        <div>
          <span className="ex-skeleton ex-skeleton-short" />
          <span className="ex-skeleton ex-skeleton-title" />
        </div>
      </div>
      <div className="ex-command-grid">
        {Array.from({ length: 9 }, (_, index) => (
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

export function ExecutiveCommandCenter() {
  const { user, permissions, can } = useAuth();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [activeQueue] = useState(initialQueue);
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  const [busyAlert, setBusyAlert] = useState<string | null>(null);
  const [riskSelection, setRiskSelection] = useState<RiskCellSelection>(null);
  const [initiativeSearch, setInitiativeSearch] = useState('');
  const [initiativeStatus, setInitiativeStatus] = useState('');
  const [initiativeOwner, setInitiativeOwner] = useState('');
  const [initiativeSort, setInitiativeSort] = useState('severity');
  const [kpiSearch, setKpiSearch] = useState('');
  const [kpiStatus, setKpiStatus] = useState('');
  const [kpiOwner, setKpiOwner] = useState('');
  const [kpiObjective, setKpiObjective] = useState('');
  const [kpiSort, setKpiSort] = useState('severity');
  const initialQueueHandled = useRef(false);

  const load = useCallback(
    async (force = false) => {
      if (!user) return;
      if (data) setRefreshing(true);
      else setLoading(true);
      setRefreshFailed(false);
      const next = await loadCommandCenterData(user.id, permissions, { force });
      if (data && force && hasFailures(next)) {
        setData(mergeData(data, next));
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
    void loadCommandCenterData(user.id, permissions).then((next) => {
      if (!active) return;
      setData(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [permissions, user]);

  useEffect(() => {
    if (!data || !activeQueue || initialQueueHandled.current) return;
    const targetId: Record<string, string> = {
      alerts: 'critical-alerts',
      initiatives: 'initiative-exceptions',
      kpis: 'kpi-exceptions',
      risks: 'critical-risks',
      deadlines: 'deadline-board',
    };
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId[activeQueue] ?? '');
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
      initialQueueHandled.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeQueue, data]);

  const dashboardSnapshot = data?.dashboard.status === 'success' ? data.dashboard.value : null;
  const dashboard = dashboardSnapshot?.value;
  const alerts = useMemo(() => (data ? resultItems(data.alerts) : []), [data]);
  const initiatives = useMemo(() => (data ? resultItems(data.initiatives) : []), [data]);
  const kpis = useMemo(() => (data ? resultItems(data.kpis) : []), [data]);
  const criticalRisks = useMemo(() => (data ? resultItems(data.criticalRisks) : []), [data]);
  const deadlines = useMemo(() => (data ? resultItems(data.deadlines) : []), [data]);

  const initiativeOwners = useMemo(
    () =>
      [...new Set(initiatives.map((item) => relatedName(item, 'owner')))]
        .filter((value) => value !== MISSING_VALUE)
        .sort(),
    [initiatives],
  );
  const filteredInitiatives = useMemo(() => {
    const query = initiativeSearch.trim().toLocaleLowerCase('ar');
    const items = initiatives.filter((item) => {
      const owner = relatedName(item, 'owner');
      return (
        (!query ||
          [recordString(item, 'name', 'title'), recordString(item, 'code'), owner].some((value) =>
            value.toLocaleLowerCase('ar').includes(query),
          )) &&
        (!initiativeStatus || item.status === initiativeStatus) &&
        (!initiativeOwner || owner === initiativeOwner)
      );
    });
    return [...items].sort((left, right) => {
      if (initiativeSort === 'endDate') {
        return new Date(String(left.endDate)).getTime() - new Date(String(right.endDate)).getTime();
      }
      if (initiativeSort === 'progress') {
        return (
          (recordNumber(left, 'progress') ?? Number.POSITIVE_INFINITY) -
          (recordNumber(right, 'progress') ?? Number.POSITIVE_INFINITY)
        );
      }
      const severity = { DELAYED: 0, AT_RISK: 1 };
      const difference =
        (severity[String(left.status) as keyof typeof severity] ?? 2) -
        (severity[String(right.status) as keyof typeof severity] ?? 2);
      return (
        difference ||
        recordString(left, 'name', 'title').localeCompare(
          recordString(right, 'name', 'title'),
          'ar',
        )
      );
    });
  }, [initiativeOwner, initiativeSearch, initiativeSort, initiativeStatus, initiatives]);

  const kpiOwners = useMemo(
    () =>
      [...new Set(kpis.map((item) => relatedName(item, 'owner')))]
        .filter((value) => value !== MISSING_VALUE)
        .sort(),
    [kpis],
  );
  const kpiObjectives = useMemo(
    () =>
      [...new Set(kpis.map((item) => relatedName(item, 'objective')))]
        .filter((value) => value !== MISSING_VALUE)
        .sort(),
    [kpis],
  );
  const filteredKpis = useMemo(() => {
    const query = kpiSearch.trim().toLocaleLowerCase('ar');
    const items = kpis.filter((item) => {
      const owner = relatedName(item, 'owner');
      const objective = relatedName(item, 'objective');
      return (
        (!query ||
          [recordString(item, 'title', 'name'), recordString(item, 'code'), owner].some((value) =>
            value.toLocaleLowerCase('ar').includes(query),
          )) &&
        (!kpiStatus || item.status === kpiStatus) &&
        (!kpiOwner || owner === kpiOwner) &&
        (!kpiObjective || objective === kpiObjective)
      );
    });
    return [...items].sort((left, right) => {
      if (kpiSort === 'measurement') {
        return (
          new Date(String(right.lastMeasuredAt ?? 0)).getTime() -
          new Date(String(left.lastMeasuredAt ?? 0)).getTime()
        );
      }
      const severity = { OFF_TRACK: 0, AT_RISK: 1 };
      const difference =
        (severity[String(left.status) as keyof typeof severity] ?? 2) -
        (severity[String(right.status) as keyof typeof severity] ?? 2);
      return (
        difference ||
        recordString(left, 'title', 'name').localeCompare(
          recordString(right, 'title', 'name'),
          'ar',
        )
      );
    });
  }, [kpiObjective, kpiOwner, kpiSearch, kpiSort, kpiStatus, kpis]);

  const filteredCriticalRisks = useMemo(
    () =>
      riskSelection
        ? criticalRisks.filter(
            (risk) =>
              risk.residualLikelihood === riskSelection.likelihood &&
              risk.residualImpact === riskSelection.impact,
          )
        : criticalRisks,
    [criticalRisks, riskSelection],
  );

  const budgetExceptions = useMemo(() => {
    const source = data ? resultItems(data.budgetInitiatives) : [];
    return source
      .map((initiative) => {
        const planned = recordNumber(initiative, 'budget');
        const actual = recordNumber(initiative, 'actualSpending');
        const { amount, percentage } = calculateInitiativeVariance(planned, actual);
        return { initiative, planned, actual, amount, percentage };
      })
      .filter(({ amount }) => amount !== null && amount !== 0)
      .sort((left, right) => (left.amount ?? 0) - (right.amount ?? 0));
  }, [data]);

  const todayDeadlines = deadlines.filter(
    (item) => daysFromToday(item.endDate ?? item.dueDate) === 0,
  );
  const nextSeven = deadlines.filter((item) => {
    const days = daysFromToday(item.endDate ?? item.dueDate);
    return days !== null && days > 0 && days <= 7;
  });
  const nextThirty = deadlines.filter((item) => {
    const days = daysFromToday(item.endDate ?? item.dueDate);
    return days !== null && days > 7 && days <= 30;
  });

  const actionAlert = async (
    alert: ExecutiveRecord,
    action: 'acknowledge' | 'resolve' | 'dismiss',
  ) => {
    if (!user || !data) return;
    setBusyAlert(alert.id);
    setFeedback(null);
    try {
      const updated = await mutateExecutiveAlert(alert.id, action);
      const currentAlerts = resultItems(data.alerts);
      const keep = ['OPEN', 'ACKNOWLEDGED'].includes(String(updated.status));
      const nextAlerts = keep
        ? currentAlerts.map((item) => (item.id === updated.id ? updated : item))
        : currentAlerts.filter((item) => item.id !== updated.id);
      const loadedAt = new Date().toISOString();
      setData({
        ...data,
        alerts: {
          status: 'success',
          value: {
            ...(data.alerts.status === 'success'
              ? data.alerts.value
              : { page: 1, pageSize: 100, total: 0 }),
            items: nextAlerts,
            total: nextAlerts.length,
          },
          loadedAt,
        },
      });
      setFeedback({ tone: 'success', message: 'تم تحديث التنبيه وتسجيل الإجراء بنجاح.' });
      const refreshed = await loadCommandCenterData(user.id, permissions);
      if (refreshed.dashboard.status === 'success') {
        setData((current) => (current ? { ...current, dashboard: refreshed.dashboard } : current));
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'تعذر تحديث التنبيه. تحقق من حالته وصلاحيتك ثم أعد المحاولة.',
      });
    } finally {
      setBusyAlert(null);
    }
  };

  if (loading && !data) return <CommandLoading />;
  if (!data) return null;

  const loadedAt =
    dashboardSnapshot?.loadedAt ??
    [
      freshness(data.alerts),
      freshness(data.deadlines),
      freshness(data.initiatives),
      freshness(data.kpis),
      freshness(data.riskMatrix),
    ].find(Boolean) ??
    null;

  const exceptionItems = [
    ...(can('risks.view') && dashboard
      ? [
          {
            label: 'مخاطر حرجة مفتوحة',
            value: dashboard.summary.risks.critical,
            href: '#critical-risks',
            source: 'ملخص المخاطر المتبقية',
          },
        ]
      : []),
    ...(can('initiatives.view') && dashboard
      ? [
          {
            label: 'مبادرات متأخرة',
            value: dashboard.summary.initiatives.delayed,
            href: '#initiative-exceptions',
            source: 'سجل المبادرات',
          },
          {
            label: 'مبادرات معرضة للخطر',
            value: dashboard.summary.initiatives.atRisk,
            href: '#initiative-exceptions',
            source: 'سجل المبادرات',
          },
        ]
      : []),
    ...(can('kpi.view') && dashboard
      ? [
          {
            label: 'مؤشرات خارج المسار',
            value: dashboard.summary.kpis.OFF_TRACK ?? 0,
            href: '#kpi-exceptions',
            source: 'سجل مؤشرات الأداء',
          },
          {
            label: 'مؤشرات معرضة للخطر',
            value: dashboard.summary.kpis.AT_RISK ?? 0,
            href: '#kpi-exceptions',
            source: 'سجل مؤشرات الأداء',
          },
        ]
      : []),
    ...(can('alerts.view') && data.alerts.status === 'success'
      ? [
          {
            label: 'تنبيهات حرجة',
            value: data.alerts.value.total,
            href: '#critical-alerts',
            source: 'مركز التنبيهات',
          },
        ]
      : []),
    ...((can('initiatives.view') || can('risks.view')) && data.deadlines.status === 'success'
      ? [
          {
            label: 'استحقاقات عاجلة',
            value: todayDeadlines.length + nextSeven.length,
            href: '#deadline-board',
            source: 'مواعيد المبادرات ومعالجات المخاطر',
          },
        ]
      : []),
  ];

  return (
    <section className="ex-insight-page">
      <ExecutiveBreadcrumbs current="مركز القيادة التنفيذي" />
      <div className="ex-page-heading">
        <div>
          <small>الاستثناءات والأولويات</small>
          <h1>مركز القيادة التنفيذي</h1>
          <p>يعرض فقط ما يتطلب تدخل القيادة، وفق السجلات والصلاحيات المعتمدة.</p>
        </div>
        <div className="ex-page-actions">
          {loadedAt && <FreshnessBadge timestamp={loadedAt} failed={refreshFailed} />}
          <button type="button" disabled={refreshing} onClick={() => void load(true)}>
            {refreshing ? 'جارٍ التحديث…' : 'تحديث المركز'}
          </button>
        </div>
      </div>

      {refreshFailed && (
        <div className="ex-refresh-warning" role="status">
          <strong>تعذر التحديث</strong>
          <span>تم الاحتفاظ بآخر قيم ناجحة مع أوقاتها الأصلية.</span>
        </div>
      )}
      {feedback && (
        <MutationFeedback
          tone={feedback.tone}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <section className="ex-exception-strip" aria-label="ملخص الاستثناءات التنفيذية">
        {exceptionItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className={activeQueue && item.href.includes(activeQueue) ? 'is-active' : ''}
          >
            <span>{item.label}</span>
            <strong>{item.value.toLocaleString('ar-SA')}</strong>
            <small>المصدر: {item.source}</small>
            {loadedAt && <time>{new Date(loadedAt).toLocaleString('ar-SA')}</time>}
          </a>
        ))}
        {exceptionItems.length === 0 && (
          <p>لا توجد وحدات استثناء مصرح بعرضها ضمن صلاحياتك الحالية.</p>
        )}
      </section>

      <div className="ex-command-grid">
        <PermissionGate permission="alerts.view">
          <ExecutiveCard
            title="قائمة التنبيهات الحرجة"
            description="مرتبة حسب الشدة، ثم الاستحقاق، ثم تاريخ الإنشاء."
            source="GET /api/executive/alerts?severity=CRITICAL"
            sourceTo="/executive/alerts"
            freshness={freshness(data.alerts)}
            freshnessFailed={refreshFailed}
            className="ex-grid-full"
          >
            <div id="critical-alerts" tabIndex={-1}>
              <CardStateBoundary
                error={resultError(data.alerts)}
                empty={data.alerts.status === 'success' && alerts.length === 0}
                onRetry={() => void load(true)}
                staleMessage={refreshFailed ? 'تعذر التحديث' : undefined}
                emptyDescription="لا توجد تنبيهات حرجة مفتوحة أو مثبتة الاطلاع."
              >
                <AlertQueue
                  items={alerts}
                  canManage={can('alerts.manage')}
                  busyId={busyAlert}
                  onAction={(alert, action) => void actionAlert(alert, action)}
                  canOpenSource={(alert) => {
                    const permission = entityPermission[recordString(alert, 'sourceModule')];
                    return !permission || can(permission);
                  }}
                  emptyDescription="لا توجد تنبيهات حرجة مفتوحة أو مثبتة الاطلاع."
                />
              </CardStateBoundary>
            </div>
          </ExecutiveCard>
        </PermissionGate>

        <PermissionGate permission="initiatives.view">
          <ExecutiveCard
            title="استثناءات المبادرات"
            description="المبادرات المتأخرة أو المعرضة للخطر فقط."
            source="GET /api/executive/initiatives"
            sourceTo="/executive/initiatives"
            freshness={freshness(data.initiatives)}
            freshnessFailed={refreshFailed}
            className="ex-grid-full"
          >
            <div id="initiative-exceptions" tabIndex={-1}>
              <ExceptionFilterBar
                search={initiativeSearch}
                onSearch={setInitiativeSearch}
                status={initiativeStatus}
                onStatus={setInitiativeStatus}
                statusOptions={[
                  { value: 'DELAYED', label: 'متأخرة' },
                  { value: 'AT_RISK', label: 'معرضة للخطر' },
                ]}
                owner={initiativeOwner}
                onOwner={setInitiativeOwner}
                ownerOptions={initiativeOwners}
                sort={initiativeSort}
                onSort={setInitiativeSort}
                sortOptions={[
                  { value: 'severity', label: 'الأشد أولًا' },
                  { value: 'endDate', label: 'الأقرب استحقاقًا' },
                  { value: 'progress', label: 'الأقل إنجازًا' },
                ]}
              />
              <CardStateBoundary
                error={resultError(data.initiatives)}
                empty={data.initiatives.status === 'success' && filteredInitiatives.length === 0}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد مبادرات مطابقة للاستثناءات والتصفية الحالية."
              >
                <ExecutiveQueue
                  label="استثناءات المبادرات"
                  empty={filteredInitiatives.length === 0}
                  emptyDescription="لا توجد مبادرات مطابقة."
                >
                  {filteredInitiatives.map((initiative) => {
                    const planned = recordNumber(initiative, 'budget');
                    const actual = recordNumber(initiative, 'actualSpending');
                    const progress = recordNumber(initiative, 'progress');
                    const variance = planned === null || actual === null ? null : planned - actual;
                    const lastUpdate = Array.isArray(initiative.updates)
                      ? ((initiative.updates[0] as ExecutiveRecord | undefined)?.updateDate ??
                        initiative.updatedAt)
                      : initiative.updatedAt;
                    return (
                      <article className="ex-initiative-row" role="listitem" key={initiative.id}>
                        <header>
                          <span
                            className={`ex-status-pill is-${String(initiative.status).toLowerCase()}`}
                          >
                            {formatStatus(initiative.status)}
                          </span>
                          <div>
                            <h3>{recordString(initiative, 'name', 'title')}</h3>
                            <p>
                              {recordString(initiative, 'code')} · المسؤول:{' '}
                              {relatedName(initiative, 'owner')}
                            </p>
                          </div>
                        </header>
                        <div className="ex-progress-detail">
                          <span>الإنجاز: {formatNumber(progress, '٪')}</span>
                          {progress !== null && (
                            <div
                              role="progressbar"
                              aria-label={`إنجاز ${recordString(initiative, 'name')}`}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={progress}
                            >
                              <span
                                style={{
                                  width: `${Math.min(100, Math.max(0, progress))}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <dl>
                          <div>
                            <dt>الفترة</dt>
                            <dd>
                              {formatDate(initiative.startDate)} — {formatDate(initiative.endDate)}
                            </dd>
                          </div>
                          <div>
                            <dt>الموازنة المخططة</dt>
                            <dd>{formatMoney(planned)}</dd>
                          </div>
                          <div>
                            <dt>الإنفاق الفعلي</dt>
                            <dd>{formatMoney(actual)}</dd>
                          </div>
                          <div>
                            <dt>الفرق</dt>
                            <dd>{formatMoney(variance)}</dd>
                          </div>
                          <div>
                            <dt>الهدف المرتبط</dt>
                            <dd>{relatedName(initiative, 'objective')}</dd>
                          </div>
                          <div>
                            <dt>آخر تحديث</dt>
                            <dd>{formatDate(lastUpdate, true)}</dd>
                          </div>
                        </dl>
                        <div className="ex-row-actions">
                          <Link to={`/executive/initiatives/${initiative.id}`}>فتح التفاصيل</Link>
                          {can('initiatives.manage') && (
                            <Link to={`/executive/initiatives/${initiative.id}#progress`}>
                              تحديث التقدم
                            </Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </ExecutiveQueue>
              </CardStateBoundary>
            </div>
          </ExecutiveCard>
        </PermissionGate>

        <PermissionGate permission="kpi.view">
          <ExecutiveCard
            title="استثناءات مؤشرات الأداء"
            description="المؤشرات المعرضة للخطر أو الخارجة عن المسار دون افتراض قيم مفقودة."
            source="GET /api/executive/kpis مع واجهة الاتجاه القائمة"
            sourceTo="/executive/kpis"
            freshness={freshness(data.kpis)}
            freshnessFailed={refreshFailed}
            className="ex-grid-full"
          >
            <div id="kpi-exceptions" tabIndex={-1}>
              <ExceptionFilterBar
                search={kpiSearch}
                onSearch={setKpiSearch}
                status={kpiStatus}
                onStatus={setKpiStatus}
                statusOptions={[
                  { value: 'OFF_TRACK', label: 'خارج المسار' },
                  { value: 'AT_RISK', label: 'معرض للخطر' },
                ]}
                owner={kpiOwner}
                onOwner={setKpiOwner}
                ownerOptions={kpiOwners}
                objective={kpiObjective}
                onObjective={setKpiObjective}
                objectiveOptions={kpiObjectives}
                sort={kpiSort}
                onSort={setKpiSort}
                sortOptions={[
                  { value: 'severity', label: 'الأشد أولًا' },
                  { value: 'measurement', label: 'آخر قياس' },
                ]}
              />
              <CardStateBoundary
                error={resultError(data.kpis)}
                empty={data.kpis.status === 'success' && filteredKpis.length === 0}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد مؤشرات مطابقة للاستثناءات والتصفية الحالية."
              >
                <ExecutiveQueue
                  label="استثناءات مؤشرات الأداء"
                  empty={filteredKpis.length === 0}
                  emptyDescription="لا توجد مؤشرات مطابقة."
                >
                  {filteredKpis.map((kpi) => {
                    const trend = data.kpiTrends[kpi.id];
                    const trendItems = trend?.status === 'success' ? trend.value.items : [];
                    const current = recordNumber(kpi, 'currentValue');
                    const target = recordNumber(kpi, 'target');
                    let trendLabel = MISSING_VALUE;
                    if (trendItems.length >= 2) {
                      const latest = recordNumber(trendItems[0]!, 'value');
                      const previous = recordNumber(trendItems[1]!, 'value');
                      if (latest !== null && previous !== null) {
                        trendLabel =
                          latest === previous ? 'مستقر' : latest > previous ? 'صاعد' : 'هابط';
                      }
                    }
                    return (
                      <article className="ex-kpi-exception-row" role="listitem" key={kpi.id}>
                        <header>
                          <span className={`ex-status-pill is-${String(kpi.status).toLowerCase()}`}>
                            {formatStatus(kpi.status)}
                          </span>
                          <div>
                            <h3>{recordString(kpi, 'title', 'name')}</h3>
                            <p>
                              المسؤول: {relatedName(kpi, 'owner')} · الهدف:{' '}
                              {relatedName(kpi, 'objective')}
                            </p>
                          </div>
                        </header>
                        <AccessibleBulletChart
                          label={recordString(kpi, 'title', 'name')}
                          current={current}
                          target={target}
                          unit={
                            recordString(kpi, 'unit') === MISSING_VALUE
                              ? undefined
                              : recordString(kpi, 'unit')
                          }
                        />
                        <dl>
                          <div>
                            <dt>آخر قياس</dt>
                            <dd>{formatDate(kpi.lastMeasuredAt)}</dd>
                          </div>
                          <div>
                            <dt>الاتجاه</dt>
                            <dd>{trendLabel}</dd>
                          </div>
                          <div>
                            <dt>مصدر القياس</dt>
                            <dd>{recordString(kpi, 'dataSource')}</dd>
                          </div>
                        </dl>
                        <div className="ex-row-actions">
                          <Link to={`/executive/kpis/${kpi.id}`}>فتح التفاصيل</Link>
                          {can('kpi.measure') && (
                            <Link to={`/executive/kpis/${kpi.id}#measurement`}>تسجيل قياس</Link>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </ExecutiveQueue>
              </CardStateBoundary>
            </div>
          </ExecutiveCard>
        </PermissionGate>

        <PermissionGate permission="risks.view">
          <ExecutiveCard
            title="مصفوفة المخاطر المتبقية"
            description="اختيار خلية يرشح قائمة المخاطر الحرجة أدناه."
            source="GET /api/executive/risks/heat-matrix"
            sourceTo="/executive/risks/heat-matrix"
            freshness={freshness(data.riskMatrix)}
            freshnessFailed={refreshFailed}
            className="ex-grid-seven"
          >
            <CardStateBoundary
              error={resultError(data.riskMatrix)}
              empty={false}
              onRetry={() => void load(true)}
            >
              {data.riskMatrix.status === 'success' && (
                <AccessibleRiskHeatMatrix
                  data={data.riskMatrix.value}
                  selection={riskSelection}
                  onSelect={setRiskSelection}
                />
              )}
            </CardStateBoundary>
          </ExecutiveCard>

          <ExecutiveCard
            title="المخاطر الحرجة"
            description="المخاطر المفتوحة بدرجة متبقية 15 فأعلى."
            source="GET /api/executive/risks/critical"
            sourceTo="/executive/risks"
            freshness={freshness(data.criticalRisks)}
            freshnessFailed={refreshFailed}
            className="ex-grid-five"
          >
            <div id="critical-risks" tabIndex={-1}>
              <CardStateBoundary
                error={resultError(data.criticalRisks)}
                empty={
                  data.criticalRisks.status === 'success' && filteredCriticalRisks.length === 0
                }
                onRetry={() => void load(true)}
                emptyDescription="لا توجد مخاطر حرجة ضمن الخلية المحددة."
              >
                <ExecutiveQueue
                  label="قائمة المخاطر الحرجة"
                  empty={filteredCriticalRisks.length === 0}
                  emptyDescription="لا توجد مخاطر حرجة."
                >
                  {filteredCriticalRisks.map((risk) => (
                    <RecordLinkCard
                      key={risk.id}
                      to={`/executive/risks/${risk.id}`}
                      title={recordString(risk, 'title')}
                      eyebrow={`${recordString(risk, 'code')} · ${formatStatus(risk.status)}`}
                      metadata={
                        <>
                          <span>
                            الدرجة المتبقية: {formatNumber(recordNumber(risk, 'residualScore'))}
                          </span>
                          <span>المسؤول: {relatedName(risk, 'owner')}</span>
                          <span>المراجعة: {formatDate(risk.reviewDate)}</span>
                        </>
                      }
                    />
                  ))}
                </ExecutiveQueue>
              </CardStateBoundary>
            </div>
          </ExecutiveCard>
        </PermissionGate>

        {(can('initiatives.view') || can('risks.view')) && (
          <ExecutiveCard
            title="لوحة الاستحقاقات"
            description="التغطية المعتمدة محصورة في المبادرات التشغيلية ومعالجات المخاطر."
            source="GET /api/executive/deadlines?days=30"
            sourceTo="/executive/command-center?queue=deadlines"
            freshness={freshness(data.deadlines)}
            freshnessFailed={refreshFailed}
            className="ex-grid-full"
          >
            <div id="deadline-board" className="ex-deadline-board" tabIndex={-1}>
              <CardStateBoundary
                error={resultError(data.deadlines)}
                empty={data.deadlines.status === 'success' && deadlines.length === 0}
                onRetry={() => void load(true)}
                emptyDescription="لا توجد استحقاقات مبادرات أو معالجات مخاطر خلال الثلاثين يومًا القادمة."
              >
                <DeadlineGroup title="اليوم" items={todayDeadlines} />
                <DeadlineGroup title="خلال 7 أيام" items={nextSeven} />
                <DeadlineGroup title="خلال 30 يومًا" items={nextThirty} />
              </CardStateBoundary>
            </div>
          </ExecutiveCard>
        )}

        <PermissionGate permission="initiatives.view">
          <ExecutiveCard
            title="استثناء إنفاق المبادرات"
            description="إنفاق المبادرات فقط؛ لا يمثل تنفيذ الموازنة المؤسسية."
            source="سجل المبادرات: الموازنة المخططة والإنفاق الفعلي"
            sourceTo="/executive/initiatives"
            freshness={freshness(data.budgetInitiatives)}
            freshnessFailed={refreshFailed}
            action={
              <Link className="ex-card-action" to="/executive/initiatives?sort=variance">
                السجل مرتبًا حسب الفرق
              </Link>
            }
            className="ex-grid-full"
          >
            <p className="ex-formula-note">
              الصيغة: الفرق = الموازنة المخططة − الإنفاق الفعلي. النسبة = الفرق ÷ الموازنة المخططة،
              ولا تُحسب عندما يساوي المقام صفرًا.
            </p>
            <CardStateBoundary
              error={resultError(data.budgetInitiatives)}
              empty={data.budgetInitiatives.status === 'success' && budgetExceptions.length === 0}
              onRetry={() => void load(true)}
              emptyDescription="لا توجد فروق إنفاق مسجلة بين المخطط والفعلي."
            >
              <div className="ex-budget-exceptions" role="list">
                {budgetExceptions.map(({ initiative, planned, actual, amount, percentage }) => (
                  <RecordLinkCard
                    key={initiative.id}
                    to={`/executive/initiatives/${initiative.id}`}
                    title={recordString(initiative, 'name', 'title')}
                    eyebrow={amount !== null && amount < 0 ? 'تجاوز في الإنفاق' : 'فرق متبقٍ'}
                    metadata={
                      <>
                        <span>المخطط: {formatMoney(planned)}</span>
                        <span>الفعلي: {formatMoney(actual)}</span>
                        <span>الفرق: {formatMoney(amount)}</span>
                        <span>
                          النسبة:{' '}
                          {percentage === null
                            ? MISSING_VALUE
                            : `${percentage.toLocaleString('ar-SA')}٪`}
                        </span>
                      </>
                    }
                  />
                ))}
              </div>
            </CardStateBoundary>
          </ExecutiveCard>
        </PermissionGate>

        <PermissionGate permission="executive_ai.recommendations">
          <ExecutiveCard
            title="التوصيات التنفيذية"
            description="إنشاء عند الطلب فقط، من الأدلة المؤسسية المصرح بها."
            source="POST /api/executive-ai/recommendations"
            sourceTo="/executive-assistant"
            className="ex-grid-full"
          >
            <ExecutiveWritingPanel mode="recommendations" />
          </ExecutiveCard>
        </PermissionGate>
      </div>

      <footer className="ex-insight-footer">
        <SourceBadge label="محركات Enterprise 22–26.1 القائمة" />
        <span>لا تنفذ هذه الصفحة أي تصنيف أو استدلال تلقائي عند الفتح.</span>
      </footer>
    </section>
  );
}
