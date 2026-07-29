import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { type ExecutiveDashboard, type ExecutiveRecord } from './api';
import { useAuth } from './auth';
import {
  CardStateBoundary,
  CoverageNotice,
  ExecutiveCard,
  ExecutiveEmptyState,
  ExecutiveErrorState,
  ExecutiveKpiCard,
  FreshnessBadge,
  PermissionGate,
  SourceBadge,
  StatusSummaryStrip,
} from './ExecutiveFoundation';
import { Link } from './router';
import {
  loadExecutiveDashboard,
  type ExecutiveDashboardSnapshot,
} from './executive-dashboard-data';

const MISSING_VALUE = 'لا توجد بيانات معتمدة';

const analysisFallback: ExecutiveDashboard['documentAnalysis'] = {
  analyzed: 0,
  awaitingReview: 0,
  awaitingApproval: 0,
  imported: 0,
  failed: 0,
  ocrRequired: 0,
  budget: { records: 0, lines: 0, totalPlanned: 0 },
};

const quranMetrics = [
  { key: 'beneficiaries_total', fallback: 'إجمالي المستفيدين' },
  { key: 'circles_in_person', fallback: 'الحلقات الحضورية' },
  { key: 'circles_remote', fallback: 'الحلقات عن بُعد' },
  { key: 'memorized_pages_monthly', fallback: 'الصفحات المحفوظة شهريًا' },
  { key: 'completed_parts', fallback: 'الأجزاء المكتملة' },
  { key: 'attendance_rate', fallback: 'نسبة الحضور' },
] as const;

const quickActionDefinitions: Record<
  string,
  { label: string; to: string; permission?: string; description: string }
> = {
  upload_document: {
    label: 'إضافة مستند',
    to: '/documents',
    permission: 'documents.create',
    description: 'فتح مركز الملفات المؤسسية',
  },
  add_kpi: {
    label: 'تحديث مؤشر أداء',
    to: '/executive/kpis',
    permission: 'kpi.manage',
    description: 'فتح سجل مؤشرات الأداء',
  },
  add_initiative: {
    label: 'إدارة المبادرات',
    to: '/executive/initiatives',
    permission: 'initiatives.manage',
    description: 'فتح سجل المبادرات',
  },
  add_risk: {
    label: 'إدارة المخاطر',
    to: '/executive/risks',
    permission: 'risks.manage',
    description: 'فتح سجل المخاطر',
  },
  add_alert: {
    label: 'إدارة التنبيهات',
    to: '/executive/alerts',
    permission: 'alerts.manage',
    description: 'فتح مركز التنبيهات',
  },
  create_report: {
    label: 'إعداد تقرير تنفيذي',
    to: '/executive/reports',
    permission: 'reports.create',
    description: 'فتح التقارير التنفيذية',
  },
  knowledge_center: {
    label: 'البحث في المعرفة',
    to: '/knowledge-intelligence',
    permission: 'knowledge.search',
    description: 'فتح الذكاء المعرفي',
  },
  manage_users: {
    label: 'إدارة المستخدمين',
    to: '/users',
    permission: 'users.view',
    description: 'فتح سجل المستخدمين',
  },
};

const recordText = (record: ExecutiveRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return MISSING_VALUE;
};

const recordDate = (record: ExecutiveRecord, ...keys: string[]) => {
  const value = recordText(record, ...keys);
  if (value === MISSING_VALUE) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ar-SA');
};

const formatPercent = (value: number | null | undefined) =>
  value === null || value === undefined ? MISSING_VALUE : `${value.toLocaleString('ar-SA')}٪`;

function DashboardLoading() {
  return (
    <section className="ex-home" aria-label="جارٍ تحميل لوحة القيادة" aria-busy="true">
      <div className="ex-page-heading">
        <div>
          <span className="ex-skeleton ex-skeleton-short" />
          <span className="ex-skeleton ex-skeleton-title" />
        </div>
      </div>
      <div className="ex-home-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            className={`ex-card ex-dashboard-skeleton ${index === 0 ? 'ex-grid-full' : ''}`}
            key={index}
          >
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

function List({
  items,
  render,
  emptyTitle,
  emptyDescription,
}: {
  items: ExecutiveRecord[];
  render(item: ExecutiveRecord): ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (items.length === 0) {
    return <ExecutiveEmptyState title={emptyTitle} description={emptyDescription} compact />;
  }
  return <div className="ex-record-list">{items.map(render)}</div>;
}

function HealthHero({
  dashboard,
  loadedAt,
  refreshFailed,
}: {
  dashboard: ExecutiveDashboard;
  loadedAt: string;
  refreshFailed: boolean;
}) {
  const health = dashboard.health;
  const score = health.score;
  const scoreTone =
    score === null ? 'unknown' : score >= 80 ? 'good' : score >= 60 ? 'warn' : 'danger';

  return (
    <section className={`ex-health-hero ex-grid-full is-${scoreTone}`}>
      <div className="ex-health-primary">
        <div>
          <span>الصحة المؤسسية</span>
          <strong>{score === null ? MISSING_VALUE : score.toLocaleString('ar-SA')}</strong>
          <small>{health.rating ?? 'التقييم غير متاح'}</small>
        </div>
        <div
          className="ex-score-ring"
          style={{ '--score': score ?? 0 } as CSSProperties}
          role="img"
          aria-label={score === null ? MISSING_VALUE : `درجة الصحة المؤسسية ${score} من 100`}
        >
          <span>{score === null ? '—' : score.toLocaleString('ar-SA')}</span>
          <small>من ١٠٠</small>
        </div>
      </div>
      <div className="ex-health-context">
        <p>{health.explanation}</p>
        <CoverageNotice coverage={health.coverage} missing={health.missingData} />
        <div className="ex-health-meta">
          <SourceBadge label="محرك الصحة المؤسسية" to="/executive/health" />
          <FreshnessBadge timestamp={loadedAt} failed={refreshFailed} />
        </div>
      </div>
      <Link className="ex-primary-link" to="/executive/health">
        عرض تفاصيل التقييم
      </Link>
    </section>
  );
}

export function HomeDashboard() {
  const { user, can } = useAuth();
  const [snapshot, setSnapshot] = useState<ExecutiveDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshFailed, setRefreshFailed] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!user) return;
      if (snapshot) setRefreshing(true);
      else setLoading(true);
      setError('');
      setRefreshFailed(false);
      try {
        setSnapshot(await loadExecutiveDashboard(user.id, { force }));
      } catch {
        if (snapshot) setRefreshFailed(true);
        else setError('تعذر تحميل المشهد التنفيذي. تحقق من الاتصال ثم أعد المحاولة.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [snapshot, user],
  );

  useEffect(() => {
    void load();
    // The first load is intentionally keyed to the authenticated identity only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const quickActions = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.value.quickActions
      .map((code) => quickActionDefinitions[code])
      .filter(
        (
          action,
        ): action is {
          label: string;
          to: string;
          permission?: string;
          description: string;
        } => Boolean(action),
      )
      .filter((action) => !action.permission || can(action.permission));
  }, [can, snapshot]);

  if (loading && !snapshot) return <DashboardLoading />;
  if (!snapshot) {
    return (
      <section className="ex-home">
        <ExecutiveErrorState description={error} onRetry={() => void load(true)} />
      </section>
    );
  }

  const data = snapshot.value;
  const analysis = data.documentAnalysis ?? analysisFallback;
  const canViewStrategy = can('strategy.view');
  const canViewKpis = can('kpi.view');
  const canViewInitiatives = can('initiatives.view');
  const canViewRisks = can('risks.view');
  const canViewAnalysis = can('document_analysis.view');
  const canViewDocuments = can('documents.view');
  const authorizedDeadlines = data.upcomingDeadlines.filter((deadline) => {
    const module = recordText(deadline, 'module');
    return module === 'risks' ? canViewRisks : canViewInitiatives;
  });
  const todayItems: Array<{
    label: string;
    value: number;
    tone: 'good' | 'warn' | 'danger';
    to: string;
  }> = [
    ...(canViewInitiatives
      ? [
          {
            label: 'مبادرات متأخرة',
            value: data.summary.initiatives.delayed,
            tone: data.summary.initiatives.delayed ? ('danger' as const) : ('good' as const),
            to: '/executive/command-center?queue=initiatives',
          },
        ]
      : []),
    ...(canViewRisks
      ? [
          {
            label: 'مخاطر حرجة',
            value: data.summary.risks.critical,
            tone: data.summary.risks.critical ? ('danger' as const) : ('good' as const),
            to: '/executive/command-center?queue=risks',
          },
        ]
      : []),
    ...(canViewInitiatives || canViewRisks
      ? [
          {
            label: 'مواعيد قادمة',
            value: authorizedDeadlines.length,
            tone: authorizedDeadlines.length ? ('warn' as const) : ('good' as const),
            to: '/executive/command-center?queue=deadlines',
          },
        ]
      : []),
    ...(canViewAnalysis
      ? [
          {
            label: 'بانتظار المراجعة',
            value: analysis.awaitingReview + analysis.awaitingApproval,
            tone:
              analysis.awaitingReview + analysis.awaitingApproval
                ? ('warn' as const)
                : ('good' as const),
            to: '/document-analysis',
          },
        ]
      : []),
  ];
  const todayCount = todayItems.reduce((total, item) => total + item.value, 0);
  const strategicItems = [
    ...(canViewStrategy
      ? [
          {
            label: 'الأهداف',
            value: data.summary.objectives.total,
            to: '/executive/objectives',
          },
        ]
      : []),
    ...(canViewInitiatives
      ? [
          {
            label: 'مبادرات نشطة',
            value: data.summary.initiatives.active,
            tone: 'good' as const,
            to: '/executive/initiatives',
          },
          {
            label: 'متأخرة',
            value: data.summary.initiatives.delayed,
            tone: data.summary.initiatives.delayed ? ('danger' as const) : ('good' as const),
            to: '/executive/initiatives',
          },
          {
            label: 'معرضة للخطر',
            value: data.summary.initiatives.atRisk,
            tone: data.summary.initiatives.atRisk ? ('warn' as const) : ('good' as const),
            to: '/executive/initiatives',
          },
        ]
      : []),
  ];
  const strategicDestination = canViewStrategy
    ? '/executive/objectives'
    : canViewInitiatives
      ? '/executive/initiatives'
      : '/executive/kpis';
  const strategicActionLabel = canViewStrategy
    ? 'فتح الاستراتيجية'
    : canViewInitiatives
      ? 'فتح المبادرات'
      : 'فتح مؤشرات الأداء';
  const readinessItems = [
    ...(canViewDocuments
      ? [
          {
            label: 'ملفات نشطة',
            value: data.summary.documents.active,
            tone: 'good' as const,
            to: '/documents',
          },
          {
            label: 'قيد المراجعة',
            value: data.summary.documents.underReview,
            tone: data.summary.documents.underReview ? ('warn' as const) : ('good' as const),
            to: '/documents',
          },
        ]
      : []),
    ...(canViewAnalysis
      ? [
          {
            label: 'تم تحليلها',
            value: analysis.analyzed,
            to: '/document-analysis',
          },
          {
            label: 'تعذر تحليلها',
            value: analysis.failed,
            tone: analysis.failed ? ('danger' as const) : ('good' as const),
            to: '/document-analysis',
          },
        ]
      : []),
  ];

  return (
    <section className="ex-home">
      <div className="ex-page-heading">
        <div>
          <small>المشهد التنفيذي الموحد</small>
          <h1>لوحة القيادة التنفيذية</h1>
          <p>قراءة مركزة للحالة المؤسسية والأولويات والمواعيد وفق البيانات المعتمدة.</p>
        </div>
        <div className="ex-page-actions">
          <Link className="ex-secondary-link" to="/executive/leadership">
            اللوحة القيادية
          </Link>
          <FreshnessBadge timestamp={snapshot.loadedAt} failed={refreshFailed} />
          <button type="button" disabled={refreshing} onClick={() => void load(true)}>
            {refreshing ? 'جارٍ التحديث…' : 'تحديث البيانات'}
          </button>
        </div>
      </div>

      {refreshFailed && (
        <div className="ex-refresh-warning" role="status">
          <strong>تعذر التحديث</strong>
          <span>
            تستمر اللوحة في عرض آخر بيانات ناجحة بتاريخ{' '}
            {new Date(snapshot.loadedAt).toLocaleString('ar-SA')}.
          </span>
        </div>
      )}

      <div className="ex-home-grid">
        <HealthHero dashboard={data} loadedAt={snapshot.loadedAt} refreshFailed={refreshFailed} />

        {todayItems.length > 0 && (
          <ExecutiveCard
            title="اليوم في الجمعية"
            description="الأعمال التي تتطلب انتباه القيادة في النطاق الحالي."
            source="لوحة القيادة التنفيذية"
            freshness={snapshot.loadedAt}
            freshnessFailed={refreshFailed}
            action={
              <Link className="ex-card-action" to="/executive/today">
                فتح موجز اليوم
              </Link>
            }
            className="ex-grid-eight"
          >
            <StatusSummaryStrip items={todayItems} />
            {todayCount === 0 && (
              <ExecutiveEmptyState
                title="لا توجد أولويات مسجلة لليوم"
                description="لم تسجل البيانات الحالية عناصر متأخرة أو حرجة أو قريبة الاستحقاق."
                compact
              />
            )}
          </ExecutiveCard>
        )}

        <ExecutiveCard
          title="الإجراءات السريعة"
          description="وجهات مصرح بها من إعداد لوحة القيادة؛ لا تنفذ تغييرًا مباشرًا."
          source="إعدادات لوحة القيادة والصلاحيات"
          freshness={snapshot.loadedAt}
          freshnessFailed={refreshFailed}
          className="ex-grid-four"
        >
          <CardStateBoundary
            empty={quickActions.length === 0}
            emptyTitle="لا توجد إجراءات متاحة"
            emptyDescription="لا تتضمن صلاحياتك الحالية أيًا من الإجراءات التي أعادتها اللوحة."
          >
            <div className="ex-quick-actions">
              {quickActions.map((action) => (
                <Link key={`${action.to}-${action.label}`} to={action.to}>
                  <strong>{action.label}</strong>
                  <small>{action.description}</small>
                  <span aria-hidden="true">←</span>
                </Link>
              ))}
            </div>
          </CardStateBoundary>
        </ExecutiveCard>

        {(canViewStrategy || canViewInitiatives || canViewKpis) && (
          <ExecutiveCard
            title="النبض الاستراتيجي"
            description="تقدم الأهداف وحالة المبادرات ومؤشرات الأداء المسجلة."
            source="البيانات الاستراتيجية المصرح بها"
            sourceTo={strategicDestination}
            freshness={snapshot.loadedAt}
            freshnessFailed={refreshFailed}
            action={
              <Link className="ex-card-action" to={strategicDestination}>
                {strategicActionLabel}
              </Link>
            }
            className="ex-grid-seven"
          >
            {canViewStrategy && (
              <div className="ex-strategic-progress">
                <div>
                  <span>متوسط تقدم الأهداف</span>
                  <strong>{formatPercent(data.summary.objectives.averageProgress)}</strong>
                </div>
                <div
                  className="ex-progress"
                  role="progressbar"
                  aria-label="متوسط تقدم الأهداف"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={data.summary.objectives.averageProgress ?? 0}
                >
                  <span
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(data.summary.objectives.averageProgress ?? 0, 100),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}
            {strategicItems.length > 0 && <StatusSummaryStrip items={strategicItems} />}
            {canViewKpis && (
              <div className="ex-kpi-statuses">
                {Object.keys(data.summary.kpis).length === 0 ? (
                  <span>{MISSING_VALUE}</span>
                ) : (
                  Object.entries(data.summary.kpis).map(([status, count]) => (
                    <span key={status}>
                      {status}: <strong>{count.toLocaleString('ar-SA')}</strong>
                    </span>
                  ))
                )}
              </div>
            )}
          </ExecutiveCard>
        )}

        <PermissionGate permission="alerts.view">
          <ExecutiveCard
            title="الأولويات والتنبيهات"
            description="التنبيهات التنفيذية المفتوحة التي تتطلب المتابعة."
            source="مركز التنبيهات التنفيذية"
            sourceTo="/executive/alerts"
            freshness={snapshot.loadedAt}
            freshnessFailed={refreshFailed}
            action={
              <Link className="ex-card-action" to="/executive/command-center?queue=alerts">
                فتح مركز القيادة
              </Link>
            }
            className="ex-grid-five"
          >
            <CardStateBoundary
              empty={data.alerts.length === 0}
              emptyTitle="لا توجد تنبيهات مفتوحة"
              emptyDescription="لم تُعد واجهة لوحة القيادة تنبيهات مفتوحة ضمن النطاق الحالي."
            >
              <List
                items={data.alerts.slice(0, 5)}
                emptyTitle="لا توجد تنبيهات مفتوحة"
                emptyDescription="لا توجد عناصر مسجلة."
                render={(alert) => (
                  <Link
                    className="ex-record-item"
                    to="/executive/command-center?queue=alerts"
                    key={alert.id}
                  >
                    <span
                      className={`ex-severity is-${recordText(alert, 'severity').toLowerCase()}`}
                    >
                      {recordText(alert, 'severity')}
                    </span>
                    <strong>{recordText(alert, 'title')}</strong>
                    <small>{recordText(alert, 'message', 'description')}</small>
                  </Link>
                )}
              />
            </CardStateBoundary>
          </ExecutiveCard>
        </PermissionGate>

        <PermissionGate permission="metrics.view">
          <ExecutiveCard
            title="أثر القرآن"
            description="قياسات مؤسسية معتمدة وليست بيانات جلسات حية."
            source="المؤشرات المؤسسية المعتمدة"
            sourceTo="/executive/metrics"
            freshness={snapshot.loadedAt}
            freshnessFailed={refreshFailed}
            action={
              <Link className="ex-card-action" to="/executive/metrics">
                جميع المؤشرات
              </Link>
            }
            className="ex-grid-full"
          >
            <div className="ex-quran-grid">
              {quranMetrics.map(({ key, fallback }) => {
                const metric = data.associationIndicators[key];
                return (
                  <ExecutiveKpiCard
                    key={key}
                    label={metric?.nameAr ?? fallback}
                    value={metric?.value}
                    unit={metric?.unit}
                    measuredAt={metric?.measuredAt}
                    source="المؤشرات المؤسسية"
                    sourceTo="/executive/metrics"
                    missing={!metric || metric.value === null}
                  />
                );
              })}
            </div>
          </ExecutiveCard>
        </PermissionGate>

        {(canViewInitiatives || canViewRisks) && (
          <ExecutiveCard
            title="المواعيد القادمة"
            description="النطاق: مواعيد المبادرات وخطط معالجة المخاطر خلال الثلاثين يومًا القادمة فقط."
            source="المواعيد المصرح بها للمبادرات ومعالجات المخاطر"
            sourceTo={canViewInitiatives ? '/executive/initiatives' : '/executive/risks'}
            freshness={snapshot.loadedAt}
            freshnessFailed={refreshFailed}
            action={
              <Link className="ex-card-action" to="/executive/command-center?queue=deadlines">
                فتح لوحة الاستحقاقات
              </Link>
            }
            className="ex-grid-six"
          >
            <CardStateBoundary
              empty={authorizedDeadlines.length === 0}
              emptyTitle="لا توجد مواعيد قادمة"
              emptyDescription="لا توجد مبادرات أو خطط معالجة مخاطر مصرح بها تستحق خلال الثلاثين يومًا القادمة."
            >
              <List
                items={authorizedDeadlines}
                emptyTitle="لا توجد مواعيد قادمة"
                emptyDescription="لا توجد مواعيد مسجلة."
                render={(deadline) => {
                  const module = recordText(deadline, 'module');
                  const riskId =
                    typeof deadline.riskId === 'string' ? deadline.riskId : deadline.id;
                  const to =
                    module === 'risks'
                      ? `/executive/risks/${riskId}`
                      : `/executive/initiatives/${deadline.id}`;
                  return (
                    <Link className="ex-deadline" to={to} key={`${module}-${deadline.id}`}>
                      <time>{recordDate(deadline, 'endDate', 'dueDate')}</time>
                      <span>
                        <strong>{recordText(deadline, 'name', 'title')}</strong>
                        <small>{module === 'risks' ? 'خطة معالجة خطر' : 'مبادرة تشغيلية'}</small>
                      </span>
                      <span aria-hidden="true">←</span>
                    </Link>
                  );
                }}
              />
            </CardStateBoundary>
          </ExecutiveCard>
        )}

        <PermissionGate permission="documents.view">
          <ExecutiveCard
            title="المعرفة الحديثة"
            description="أحدث الملفات التي أعادتها الواجهة بعد تطبيق صلاحيات وسرية الوثائق."
            source="مركز الملفات والمعرفة"
            sourceTo="/documents"
            freshness={snapshot.loadedAt}
            freshnessFailed={refreshFailed}
            action={
              <Link className="ex-card-action" to="/documents">
                فتح المركز
              </Link>
            }
            className="ex-grid-six"
          >
            <CardStateBoundary
              empty={data.recentDocuments.length === 0}
              emptyTitle="لا توجد ملفات حديثة"
              emptyDescription="لا توجد ملفات مرئية ضمن نطاق وصولك الحالي."
            >
              <div className="ex-document-list">
                {data.recentDocuments.slice(0, 5).map((document) => (
                  <Link key={document.id} to={`/documents/${document.id}`}>
                    <span aria-hidden="true">▤</span>
                    <span>
                      <strong>{document.title}</strong>
                      <small>
                        {document.category?.name || document.documentType || MISSING_VALUE} ·
                        الإصدار{' '}
                        {typeof document.versionNumber === 'number'
                          ? document.versionNumber.toLocaleString('ar-SA')
                          : MISSING_VALUE}
                      </small>
                    </span>
                    <time>{recordDate(document, 'updatedAt')}</time>
                  </Link>
                ))}
              </div>
            </CardStateBoundary>
          </ExecutiveCard>
        </PermissionGate>

        <PermissionGate permission="executive_ai.use">
          <ExecutiveCard
            title="مساعد تنفيذي — إصدار البيانات المؤسسية"
            description="ابدأ صياغة مهنية مع فصل الاستشهادات الداعمة؛ لا يتم إرسال أي طلب تلقائي."
            source="المساعد التنفيذي Enterprise 26.1"
            sourceTo="/executive-assistant"
            className="ex-grid-eight ex-brief-panel"
          >
            <div>
              <span aria-hidden="true">✦</span>
              <div>
                <h3>إعداد موجز تنفيذي مهني</h3>
                <p>
                  انتقل إلى المساعد لاختيار نوع الكتابة والمراجع. هذه البطاقة تنقل فقط ولا تنشئ
                  محتوى أو تغيّر بيانات.
                </p>
              </div>
              <Link className="ex-primary-link" to="/executive-assistant">
                فتح المساعد التنفيذي
              </Link>
            </div>
          </ExecutiveCard>
        </PermissionGate>

        {readinessItems.length > 0 && (
          <ExecutiveCard
            title="جاهزية المعرفة"
            description="ملخص الملفات وعمليات التحليل المتاحة في التجميع التنفيذي."
            source="مصادر المعرفة المصرح بها"
            sourceTo={canViewDocuments ? '/documents' : '/document-analysis'}
            freshness={snapshot.loadedAt}
            freshnessFailed={refreshFailed}
            className="ex-grid-four"
          >
            <StatusSummaryStrip items={readinessItems} />
          </ExecutiveCard>
        )}
      </div>
    </section>
  );
}
