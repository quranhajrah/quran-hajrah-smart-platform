import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import {
  api,
  type ExecutiveDashboard as DashboardData,
  type ExecutiveHealth,
  type ExecutiveRecord,
  type PageResult,
  openExecutiveReportPrint,
} from './api';
import { useAuth } from './auth';
import {
  entityDefinitions,
  type ExecutiveEntityDefinition as EntityDefinition,
} from './executive-config';

const number = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 1 });
const currency = new Intl.NumberFormat('ar-SA', {
  style: 'currency',
  currency: 'SAR',
  maximumFractionDigits: 0,
});

const valueText = (value: unknown, unit?: string) =>
  value === null || value === undefined || value === ''
    ? 'لا توجد بيانات'
    : `${typeof value === 'number' ? number.format(value) : String(value)}${unit ? ` ${unit}` : ''}`;
const nullableNumber = (value: unknown) =>
  value === null || value === undefined || value === '' ? null : Number(value);

const statusLabels: Record<string, string> = {
  DRAFT: 'مسودة',
  GENERATED: 'مولّد',
  APPROVED: 'معتمد',
  ARCHIVED: 'مؤرشف',
  NOT_STARTED: 'لم يبدأ',
  ON_TRACK: 'على المسار',
  AT_RISK: 'معرّض للخطر',
  OFF_TRACK: 'متعثر',
  COMPLETED: 'مكتمل',
  PLANNED: 'مخطط',
  ACTIVE: 'نشط',
  DELAYED: 'متأخر',
  CANCELLED: 'ملغي',
  ON_HOLD: 'معلّق',
  OPEN: 'مفتوح',
  UNDER_TREATMENT: 'قيد المعالجة',
  ACCEPTED: 'مقبول',
  CLOSED: 'مغلق',
  ACKNOWLEDGED: 'تم الاطلاع',
  RESOLVED: 'معالج',
  DISMISSED: 'مستبعد',
  INFO: 'معلومة',
  LOW: 'منخفض',
  MEDIUM: 'متوسط',
  HIGH: 'عالٍ',
  CRITICAL: 'حرج',
};

const labelStatus = (status: unknown) => statusLabels[String(status)] ?? String(status ?? '—');
const badgeClass = (status: unknown) =>
  `executive-badge executive-badge-${String(status ?? 'neutral').toLowerCase()}`;

function AsyncState({
  loading,
  error,
  empty,
  children,
}: {
  loading: boolean;
  error: string;
  empty?: boolean;
  children: ReactNode;
}) {
  if (loading) return <div className="status">جارٍ تحميل البيانات المؤسسية…</div>;
  if (error) return <div className="status error">{error}</div>;
  if (empty) return <div className="executive-empty">لا توجد سجلات مطابقة حتى الآن.</div>;
  return children;
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="executive-section">
      <div className="executive-section-heading">
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Progress({ value, label }: { value: number | null; label: string }) {
  const bounded = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="progress-chart" aria-label={`${label}: ${valueText(value, '%')}`}>
      <div className="progress-label">
        <span>{label}</span>
        <strong>{valueText(value, '%')}</strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${bounded}%` }} />
      </div>
    </div>
  );
}

const summaryCards = (dashboard: DashboardData) =>
  [
    ['إجمالي الوثائق', dashboard.summary.documents.total, 'documents'],
    ['الوثائق النشطة', dashboard.summary.documents.active, 'success'],
    ['قيد المراجعة', dashboard.summary.documents.underReview, 'review'],
    ['قرب انتهاء الوثائق', dashboard.summary.documents.expiring, 'warning'],
    ['الوثائق المؤرشفة', dashboard.summary.documents.archived, 'muted'],
    ['المستخدمون النشطون', dashboard.summary.activeUsers, 'success'],
    ['النشاط الحديث', dashboard.summary.recentSystemActivity, 'review'],
    ['درجة الحوكمة', dashboard.institutionalMetrics.governance_score?.value ?? null, 'gold'],
    [
      'تقدم الخطة الاستراتيجية',
      dashboard.institutionalMetrics.strategic_plan_progress?.value ?? null,
      'documents',
    ],
    [
      'تقدم الخطة التشغيلية',
      dashboard.institutionalMetrics.operational_plan_progress?.value ?? null,
      'documents',
    ],
    ['تنفيذ الموازنة', dashboard.institutionalMetrics.budget_execution_rate?.value ?? null, 'gold'],
    ['المبادرات النشطة', dashboard.summary.initiatives.active, 'success'],
    ['المبادرات المتأخرة', dashboard.summary.initiatives.delayed, 'warning'],
    ['المخاطر المفتوحة', dashboard.summary.risks.open, 'review'],
    ['المخاطر الحرجة', dashboard.summary.risks.critical, 'danger'],
  ] as const;

const indicatorLabels: Record<string, string> = {
  beneficiaries_total: 'إجمالي المستفيدين',
  students_male: 'الطلاب',
  students_female: 'الطالبات',
  teachers_male: 'المعلمون',
  teachers_female: 'المعلمات',
  circles_in_person: 'الحلقات الحضورية',
  circles_remote: 'الحلقات عن بُعد',
  memorized_pages_weekly: 'صفحات الحفظ أسبوعيًا',
  memorized_pages_monthly: 'صفحات الحفظ شهريًا',
  completed_parts: 'الأجزاء المكتملة',
  attendance_rate: 'نسبة الحضور',
  retention_rate: 'نسبة الاستبقاء',
};

const quickActions: Record<string, { label: string; route: string; permission?: string }> = {
  upload_document: { label: 'رفع وثيقة', route: '/documents', permission: 'documents.create' },
  add_kpi: { label: 'إضافة مؤشر', route: '/executive/kpis', permission: 'kpi.manage' },
  add_initiative: {
    label: 'إضافة مبادرة',
    route: '/executive/initiatives',
    permission: 'initiatives.manage',
  },
  add_risk: { label: 'إضافة خطر', route: '/executive/risks', permission: 'risks.manage' },
  add_alert: { label: 'إضافة تنبيه', route: '/executive/alerts', permission: 'alerts.manage' },
  create_report: {
    label: 'إنشاء تقرير تنفيذي',
    route: '/executive/reports',
    permission: 'reports.create',
  },
  knowledge_center: {
    label: 'فتح مركز المعرفة',
    route: '/documents',
    permission: 'documents.view',
  },
  manage_users: { label: 'إدارة المستخدمين', route: '/users', permission: 'users.view' },
};

export function ExecutiveDashboard() {
  const { can } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<{
    title: string;
    summary: string;
    data: unknown;
    missingData: string[];
  } | null>(null);
  const [queryBusy, setQueryBusy] = useState(false);

  useEffect(() => {
    api<DashboardData>('/executive/dashboard')
      .then(setDashboard)
      .catch(() => setError('تعذر تحميل لوحة القيادة التنفيذية.'))
      .finally(() => setLoading(false));
  }, []);

  async function ask(event: FormEvent) {
    event.preventDefault();
    setQueryBusy(true);
    setError('');
    try {
      setQueryResult(
        await api('/executive/query', {
          method: 'POST',
          body: JSON.stringify({ text: query }),
        }),
      );
    } catch {
      setError('هذا السؤال غير مدعوم في إصدار البيانات المؤسسية.');
    } finally {
      setQueryBusy(false);
    }
  }

  return (
    <div className="executive-page">
      <div className="executive-hero">
        <div>
          <small>Enterprise 23 · القيادة بالبيانات</small>
          <h1>لوحة القيادة التنفيذية</h1>
          <p>صورة مؤسسية موحدة مبنية حصريًا على البيانات المسجلة في المنصة.</p>
        </div>
        <NavLink className="outline-action" to="/executive/health">
          منهجية الصحة التنفيذية
        </NavLink>
      </div>
      <AsyncState loading={loading} error={error}>
        {dashboard && (
          <>
            <div className="executive-score-strip">
              <div className="score-ring" aria-label="درجة الصحة التنفيذية">
                <strong>
                  {dashboard.health.score === null ? '—' : number.format(dashboard.health.score)}
                </strong>
                <span>من 100</span>
              </div>
              <div>
                <small>الصحة التنفيذية</small>
                <h2>{dashboard.health.rating ?? 'البيانات غير مكتملة'}</h2>
                <p>{dashboard.health.explanation}</p>
              </div>
              <div className="coverage">
                <span>تغطية البيانات</span>
                <strong>{number.format(dashboard.health.coverage)}%</strong>
              </div>
            </div>

            <div className="executive-summary-grid">
              {summaryCards(dashboard).map(([label, value, tone]) => (
                <article className={`summary-card tone-${tone}`} key={label}>
                  <span>{label}</span>
                  <strong>{valueText(value)}</strong>
                </article>
              ))}
            </div>

            <Section
              title="مؤشرات الجمعية القرآنية"
              hint="لا تعرض اللوحة قيمة إلا إذا سُجل لها قياس مؤسسي معتمد."
              action={
                can('metrics.view') ? (
                  <NavLink to="/executive/metrics">إدارة المؤشرات</NavLink>
                ) : undefined
              }
            >
              <div className="indicator-grid">
                {Object.entries(indicatorLabels).map(([key, label]) => {
                  const metric = dashboard.associationIndicators[key];
                  return (
                    <article key={key}>
                      <span>{label}</span>
                      <strong>{valueText(metric?.value, metric?.unit ?? undefined)}</strong>
                      <small>
                        {metric?.measuredAt
                          ? `قياس ${new Date(metric.measuredAt).toLocaleDateString('ar-SA')}`
                          : 'بانتظار أول قياس'}
                      </small>
                    </article>
                  );
                })}
              </div>
            </Section>

            <div className="executive-two-column">
              <Section title="التقدم الاستراتيجي والتشغيلي">
                <div className="progress-stack">
                  <Progress
                    label="الخطة الاستراتيجية"
                    value={nullableNumber(
                      dashboard.institutionalMetrics.strategic_plan_progress?.value,
                    )}
                  />
                  <Progress
                    label="الخطة التشغيلية"
                    value={nullableNumber(
                      dashboard.institutionalMetrics.operational_plan_progress?.value,
                    )}
                  />
                  <Progress
                    label="تنفيذ الموازنة"
                    value={nullableNumber(
                      dashboard.institutionalMetrics.budget_execution_rate?.value,
                    )}
                  />
                </div>
              </Section>
              <Section title="ملخص المبادرات والمخاطر">
                <div className="status-distribution">
                  {[
                    ['على المسار', dashboard.summary.kpis.ON_TRACK ?? 0, 'good'],
                    ['مؤشرات معرضة', dashboard.summary.kpis.AT_RISK ?? 0, 'warning'],
                    ['مبادرات متأخرة', dashboard.summary.initiatives.delayed, 'danger'],
                    ['مخاطر حرجة', dashboard.summary.risks.critical, 'critical'],
                  ].map(([label, value, tone]) => (
                    <div className={`distribution-${tone}`} key={String(label)}>
                      <strong>{value}</strong>
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
                <p className="budget-line">
                  الموازنة المخططة: {currency.format(dashboard.summary.initiatives.plannedBudget)}
                  <br />
                  المصروف الفعلي: {currency.format(dashboard.summary.initiatives.actualSpending)}
                </p>
              </Section>
            </div>

            <div className="executive-two-column">
              <Section
                title="التنبيهات المهمة"
                action={<NavLink to="/executive/alerts">عرض المركز</NavLink>}
              >
                <RecordList
                  items={dashboard.alerts}
                  primary="title"
                  secondary="description"
                  empty="لا توجد تنبيهات مفتوحة."
                  status="severity"
                />
              </Section>
              <Section title="المواعيد القادمة">
                <RecordList
                  items={dashboard.upcomingDeadlines}
                  primary="title"
                  secondary="dueDate"
                  empty="لا توجد مواعيد قريبة."
                  status="sourceModule"
                />
              </Section>
            </div>

            <div className="executive-two-column">
              <Section
                title="أحدث الوثائق"
                action={<NavLink to="/documents">مركز المعرفة</NavLink>}
              >
                <div className="compact-list">
                  {dashboard.recentDocuments.map((document) => (
                    <Link key={document.id} to={`/documents/${document.id}`}>
                      <strong>{document.title}</strong>
                      <span>{document.owningDepartment}</span>
                    </Link>
                  ))}
                  {dashboard.recentDocuments.length === 0 && (
                    <div className="executive-empty">لا توجد وثائق متاحة.</div>
                  )}
                </div>
              </Section>
              <Section title="أحدث الأنشطة">
                <RecordList
                  items={dashboard.recentActivities}
                  primary="description"
                  secondary="createdAt"
                  empty="لا يوجد نشاط حديث."
                  status="action"
                />
              </Section>
            </div>

            <Section title="إجراءات سريعة">
              <div className="quick-actions">
                {dashboard.quickActions.map((code) => {
                  const action = quickActions[code];
                  if (!action || (action.permission && !can(action.permission))) return null;
                  return (
                    <NavLink key={code} to={action.route}>
                      <span>+</span>
                      {action.label}
                    </NavLink>
                  );
                })}
              </div>
            </Section>

            {can('executive.query') && (
              <Section
                title="مساعد تنفيذي — إصدار البيانات المؤسسية"
                hint="استعلامات محلية منظمة؛ لا تُستخدم خدمة ذكاء اصطناعي خارجية."
              >
                <form className="executive-query" onSubmit={ask}>
                  <label>
                    اسأل عن مؤشرات الأداء أو المبادرات أو المخاطر أو الوثائق
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="مثال: ما المخاطر الحرجة؟"
                      minLength={3}
                      required
                    />
                  </label>
                  <button disabled={queryBusy}>{queryBusy ? 'جارٍ الاستعلام…' : 'استعلام'}</button>
                </form>
                <div className="query-suggestions">
                  {[
                    'ما مؤشرات الأداء المتعثرة؟',
                    'ما المبادرات المتأخرة؟',
                    'ما المخاطر الحرجة؟',
                    'ما الوثائق التي ستنتهي؟',
                    'ما نسبة تنفيذ الخطة؟',
                    'أعطني ملخصًا تنفيذيًا',
                  ].map((suggestion) => (
                    <button
                      className="secondary"
                      key={suggestion}
                      onClick={() => setQuery(suggestion)}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                {queryResult && (
                  <article className="query-result">
                    <h3>{queryResult.title}</h3>
                    <p>{queryResult.summary}</p>
                    {queryResult.missingData.length > 0 && (
                      <small>بيانات ناقصة: {queryResult.missingData.join('، ')}</small>
                    )}
                  </article>
                )}
              </Section>
            )}
          </>
        )}
      </AsyncState>
    </div>
  );
}

function RecordList({
  items,
  primary,
  secondary,
  status,
  empty,
}: {
  items: ExecutiveRecord[];
  primary: string;
  secondary: string;
  status: string;
  empty: string;
}) {
  if (items.length === 0) return <div className="executive-empty">{empty}</div>;
  return (
    <div className="compact-list">
      {items.slice(0, 8).map((item) => (
        <div key={item.id}>
          <strong>{String(item[primary] ?? '—')}</strong>
          <span>
            {secondary.toLowerCase().includes('date') && item[secondary]
              ? new Date(String(item[secondary])).toLocaleDateString('ar-SA')
              : String(item[secondary] ?? '')}
          </span>
          <small className={badgeClass(item[status])}>{labelStatus(item[status])}</small>
        </div>
      ))}
    </div>
  );
}

const formatCell = (value: unknown, format?: string) => {
  if (value === null || value === undefined || value === '') return '—';
  if (format === 'status') return <span className={badgeClass(value)}>{labelStatus(value)}</span>;
  if (format === 'percent') return `${number.format(Number(value))}%`;
  if (format === 'currency') return currency.format(Number(value));
  if (format === 'date') return new Date(String(value)).toLocaleDateString('ar-SA');
  return String(value);
};

export function ExecutiveRegistry({ definition }: { definition: EntityDefinition }) {
  const { can } = useAuth();
  const [result, setResult] = useState<PageResult>({ items: [], total: 0, page: 1, pageSize: 20 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    const query = new URLSearchParams({
      page: String(page),
      pageSize: '20',
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });
    api<PageResult>(`/executive/${definition.key}?${query}`)
      .then(setResult)
      .catch(() => setError(`تعذر تحميل ${definition.title}.`))
      .finally(() => setLoading(false));
  }, [definition, page, search, status]);

  useEffect(() => {
    const timeout = window.setTimeout(load, 250);
    return () => window.clearTimeout(timeout);
  }, [load]);

  return (
    <div className="executive-page">
      <div className="executive-hero compact">
        <div>
          <small>منصة الذكاء التنفيذي</small>
          <h1>{definition.title}</h1>
        </div>
        {can(definition.managePermission) && (
          <button onClick={() => setShowForm((current) => !current)}>
            {showForm ? 'إغلاق النموذج' : `+ إضافة ${definition.singular}`}
          </button>
        )}
      </div>
      {showForm && (
        <CreateEntityForm
          entity={definition.key}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      <div className="executive-filters">
        <input
          aria-label="بحث في السجل"
          placeholder="بحث بالاسم أو الرمز"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="تصفية الحالة"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">كل الحالات</option>
          {[
            'ACTIVE',
            'ON_TRACK',
            'AT_RISK',
            'OFF_TRACK',
            'DELAYED',
            'OPEN',
            'DRAFT',
            'APPROVED',
          ].map((value) => (
            <option key={value} value={value}>
              {labelStatus(value)}
            </option>
          ))}
        </select>
      </div>
      <AsyncState loading={loading} error={error} empty={result.items.length === 0}>
        <div className="table-wrap executive-table">
          <table>
            <thead>
              <tr>
                {definition.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th>تفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.id}>
                  {definition.columns.map((column) => (
                    <td key={column.key}>{formatCell(item[column.key], column.format)}</td>
                  ))}
                  <td>
                    <Link to={`/executive/${definition.key}/${item.id}`}>فتح السجل</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={result.total} pageSize={20} onPage={setPage} />
      </AsyncState>
    </div>
  );
}

function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination" aria-label="التنقل بين الصفحات">
      <button className="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        السابق
      </button>
      <span>
        الصفحة {page} من {pages}
      </span>
      <button className="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        التالي
      </button>
    </div>
  );
}

function CreateEntityForm({
  entity,
  onCreated,
}: {
  entity: EntityDefinition['key'];
  onCreated: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [objectives, setObjectives] = useState<ExecutiveRecord[]>([]);

  useEffect(() => {
    if (entity === 'kpis' || entity === 'initiatives') {
      api<PageResult>('/executive/objectives?page=1&pageSize=100')
        .then((result) => setObjectives(result.items))
        .catch(() => setObjectives([]));
    }
  }, [entity]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await api(`/executive/${entity}`, {
        method: 'POST',
        body: JSON.stringify(entityPayload(entity, form)),
      });
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر حفظ السجل.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card executive-create-form" onSubmit={submit}>
      {entity === 'metrics' && (
        <>
          <Field name="nameAr" label="اسم المؤشر بالعربية" required />
          <Field name="key" label="المفتاح الإنجليزي" placeholder="metric_key" required />
          <Select
            name="dataType"
            label="نوع البيانات"
            options={['NUMBER', 'PERCENTAGE', 'CURRENCY', 'TEXT']}
          />
          <Select
            name="frequency"
            label="الدورية"
            options={[
              'DAILY',
              'WEEKLY',
              'MONTHLY',
              'QUARTERLY',
              'SEMIANNUAL',
              'ANNUAL',
              'ON_DEMAND',
            ]}
          />
          <Field name="unit" label="الوحدة" />
          <Field name="responsibleDepartment" label="الإدارة المسؤولة" />
          <Field name="targetValue" label="القيمة المستهدفة" type="number" />
          <Field name="warningThreshold" label="حد التحذير" type="number" />
        </>
      )}
      {entity === 'objectives' && (
        <>
          <Field name="code" label="رمز الهدف" required />
          <Field name="title" label="عنوان الهدف" required />
          <Field name="strategicAxis" label="المحور الاستراتيجي" required />
          <Field name="startDate" label="تاريخ البدء" type="date" required />
          <Field name="endDate" label="تاريخ الانتهاء" type="date" required />
          <Field name="baseline" label="خط الأساس" type="number" />
          <Field name="target" label="المستهدف" type="number" />
          <Field name="weight" label="الوزن %" type="number" defaultValue="0" required />
        </>
      )}
      {entity === 'kpis' && (
        <>
          <Select
            name="objectiveId"
            label="الهدف الاستراتيجي"
            options={objectives.map((item) => String(item.id))}
            labels={Object.fromEntries(objectives.map((item) => [item.id, String(item.title)]))}
          />
          <Field name="code" label="رمز المؤشر" required />
          <Field name="title" label="اسم المؤشر" required />
          <Field name="formula" label="معادلة القياس" />
          <Field name="baseline" label="خط الأساس" type="number" />
          <Field name="target" label="المستهدف" type="number" required />
          <Field name="unit" label="الوحدة" />
          <Select
            name="frequency"
            label="الدورية"
            options={['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']}
          />
        </>
      )}
      {entity === 'initiatives' && (
        <>
          <Field name="code" label="رمز المبادرة" required />
          <Field name="name" label="اسم المبادرة" required />
          <Field name="department" label="الإدارة" required />
          <Select
            name="objectiveId"
            label="الهدف المرتبط (اختياري)"
            allowEmpty
            options={objectives.map((item) => String(item.id))}
            labels={Object.fromEntries(objectives.map((item) => [item.id, String(item.title)]))}
          />
          <Field name="startDate" label="تاريخ البدء" type="date" required />
          <Field name="endDate" label="تاريخ الانتهاء" type="date" required />
          <Field name="budget" label="الموازنة" type="number" defaultValue="0" required />
          <Field
            name="actualSpending"
            label="المصروف الفعلي"
            type="number"
            defaultValue="0"
            required
          />
        </>
      )}
      {entity === 'risks' && (
        <>
          <Field name="code" label="رمز الخطر" required />
          <Field name="title" label="عنوان الخطر" required />
          <Field name="category" label="التصنيف" required />
          <Select
            name="likelihood"
            label="الاحتمالية الكامنة"
            options={['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN']}
          />
          <Select
            name="impact"
            label="الأثر الكامن"
            options={['INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE']}
          />
          <Select
            name="residualLikelihood"
            label="الاحتمالية المتبقية"
            options={['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN']}
          />
          <Select
            name="residualImpact"
            label="الأثر المتبقي"
            options={['INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE']}
          />
          <Field name="reviewDate" label="تاريخ المراجعة" type="date" />
        </>
      )}
      {entity === 'reports' && (
        <>
          <Field name="title" label="عنوان التقرير" required />
          <Select
            name="reportType"
            label="نوع التقرير"
            options={[
              'BOARD',
              'MONTHLY_PERFORMANCE',
              'QUARTERLY_PERFORMANCE',
              'OPERATIONAL_PLAN',
              'RISKS',
              'GOVERNANCE',
              'KNOWLEDGE_CENTER',
              'COMPREHENSIVE',
            ]}
          />
          <Field name="periodStart" label="بداية الفترة" type="date" />
          <Field name="periodEnd" label="نهاية الفترة" type="date" />
        </>
      )}
      {error && <div className="status error field-wide">{error}</div>}
      <div className="form-actions field-wide">
        <button disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ السجل'}</button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        step={type === 'number' ? 'any' : undefined}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function Select({
  label,
  name,
  options,
  labels = {},
  allowEmpty = false,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[];
  labels?: Record<string, string>;
  allowEmpty?: boolean;
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <select name={name} required={!allowEmpty} defaultValue={defaultValue}>
        {allowEmpty && <option value="">غير محدد</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option] ?? labelStatus(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

const optional = (form: FormData, key: string) => {
  const value = String(form.get(key) ?? '').trim();
  return value || undefined;
};
const optionalNumber = (form: FormData, key: string) => {
  const value = optional(form, key);
  return value === undefined ? undefined : Number(value);
};

function entityPayload(entity: EntityDefinition['key'], form: FormData) {
  if (entity === 'metrics')
    return {
      key: String(form.get('key')),
      nameAr: String(form.get('nameAr')),
      dataType: String(form.get('dataType')),
      frequency: String(form.get('frequency')),
      unit: optional(form, 'unit'),
      responsibleDepartment: optional(form, 'responsibleDepartment'),
      targetValue: optionalNumber(form, 'targetValue'),
      warningThreshold: optionalNumber(form, 'warningThreshold'),
      higherIsBetter: true,
      isActive: true,
    };
  if (entity === 'objectives')
    return {
      code: String(form.get('code')),
      title: String(form.get('title')),
      strategicAxis: String(form.get('strategicAxis')),
      startDate: String(form.get('startDate')),
      endDate: String(form.get('endDate')),
      baseline: optionalNumber(form, 'baseline'),
      target: optionalNumber(form, 'target'),
      weight: Number(form.get('weight')),
      progress: 0,
      status: 'NOT_STARTED',
    };
  if (entity === 'kpis')
    return {
      objectiveId: String(form.get('objectiveId')),
      code: String(form.get('code')),
      title: String(form.get('title')),
      formula: optional(form, 'formula'),
      baseline: optionalNumber(form, 'baseline'),
      target: Number(form.get('target')),
      unit: optional(form, 'unit'),
      frequency: String(form.get('frequency')),
      status: 'NOT_STARTED',
      weight: 0,
    };
  if (entity === 'initiatives')
    return {
      code: String(form.get('code')),
      name: String(form.get('name')),
      department: String(form.get('department')),
      objectiveId: optional(form, 'objectiveId'),
      startDate: String(form.get('startDate')),
      endDate: String(form.get('endDate')),
      budget: Number(form.get('budget')),
      actualSpending: Number(form.get('actualSpending')),
      progress: 0,
      status: 'PLANNED',
    };
  if (entity === 'risks')
    return {
      code: String(form.get('code')),
      title: String(form.get('title')),
      category: String(form.get('category')),
      likelihood: String(form.get('likelihood')),
      impact: String(form.get('impact')),
      residualLikelihood: String(form.get('residualLikelihood')),
      residualImpact: String(form.get('residualImpact')),
      reviewDate: optional(form, 'reviewDate'),
      status: 'OPEN',
    };
  return {
    title: String(form.get('title')),
    reportType: String(form.get('reportType')),
    periodStart: optional(form, 'periodStart'),
    periodEnd: optional(form, 'periodEnd'),
    status: 'DRAFT',
  };
}

const hiddenDetailKeys = new Set([
  'id',
  'createdById',
  'updatedById',
  'deletedAt',
  'createdAt',
  'updatedAt',
  'sections',
  'measurements',
  'milestones',
  'updates',
  'treatments',
  'evidence',
]);

export function ExecutiveDetail({ entity }: { entity: EntityDefinition['key'] }) {
  const { can } = useAuth();
  const { id = '' } = useParams();
  const definition = entityDefinitions[entity]!;
  const [record, setRecord] = useState<ExecutiveRecord | null>(null);
  const [history, setHistory] = useState<ExecutiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [value, setValue] = useState('');

  const load = useCallback(async () => {
    try {
      const next = await api<ExecutiveRecord>(`/executive/${entity}/${id}`);
      setRecord(next);
      if (entity === 'metrics' || entity === 'kpis') {
        const historyResult = await api<PageResult>(
          `/executive/${entity}/${id}/${entity === 'metrics' ? 'history' : 'trend'}?page=1&pageSize=50`,
        );
        setHistory(historyResult.items);
      }
    } catch {
      setError('تعذر تحميل تفاصيل السجل.');
    } finally {
      setLoading(false);
    }
  }, [entity, id]);

  useEffect(() => void load(), [load]);

  async function recordMeasurement(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/executive/${entity}/${id}/measurements`, {
        method: 'POST',
        body: JSON.stringify({
          [entity === 'metrics' ? 'numericValue' : 'value']: Number(value),
          measuredAt: new Date().toISOString(),
        }),
      });
      setValue('');
      await load();
    } catch {
      setError('تعذر تسجيل القياس.');
    }
  }

  async function reportAction(action: 'generate' | 'approve' | 'archive') {
    try {
      await api(`/executive/reports/${id}/${action}`, { method: 'POST' });
      await load();
    } catch {
      setError('تعذر تنفيذ إجراء التقرير في حالته الحالية.');
    }
  }

  return (
    <div className="executive-page">
      <div className="breadcrumbs">
        <Link to={`/executive/${entity}`}>{definition.title}</Link>
        <span>/</span>
        <span>تفاصيل {definition.singular}</span>
      </div>
      <AsyncState loading={loading} error={error}>
        {record && (
          <>
            <div className="executive-hero compact">
              <div>
                <small>{String(record.code ?? record.key ?? definition.singular)}</small>
                <h1>
                  {String(record.title ?? record.name ?? record.nameAr ?? definition.singular)}
                </h1>
              </div>
              {Boolean(record.status) && (
                <span className={badgeClass(record.status)}>{labelStatus(record.status)}</span>
              )}
            </div>
            <Section title="بيانات السجل">
              <dl className="executive-details">
                {Object.entries(record)
                  .filter(
                    ([key, item]) =>
                      !hiddenDetailKeys.has(key) && typeof item !== 'object' && item !== null,
                  )
                  .map(([key, item]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>
                        {formatCell(item, key.toLowerCase().includes('date') ? 'date' : undefined)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </Section>
            {can(definition.managePermission) && (
              <UpdateEntityForm entity={entity} record={record} onUpdated={load} />
            )}
            {(entity === 'metrics' || entity === 'kpis') && (
              <Section title="الاتجاه والقياسات">
                {can(entity === 'metrics' ? 'metrics.measure' : 'kpi.measure') && (
                  <form className="inline-measurement" onSubmit={recordMeasurement}>
                    <label>
                      قياس جديد
                      <input
                        type="number"
                        step="any"
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        required
                      />
                    </label>
                    <button>تسجيل القياس</button>
                  </form>
                )}
                <TrendChart
                  values={history.map((item) => Number(item.value ?? item.numericValue))}
                />
                <RecordList
                  items={history}
                  primary={entity === 'metrics' ? 'numericValue' : 'value'}
                  secondary="measuredAt"
                  status={entity === 'kpis' ? 'status' : 'sourceType'}
                  empty="لا توجد قياسات مسجلة."
                />
              </Section>
            )}
            {entity === 'initiatives' && (
              <Section title="الإنجاز والميزانية">
                <Progress label="نسبة الإنجاز" value={Number(record.progress ?? 0)} />
                <p className="budget-line">
                  المخطط: {currency.format(Number(record.budget ?? 0))} · الفعلي:{' '}
                  {currency.format(Number(record.actualSpending ?? 0))}
                </p>
              </Section>
            )}
            {entity === 'reports' && (
              <>
                {can('reports.create') &&
                  ['DRAFT', 'GENERATED'].includes(String(record.status)) && (
                    <ReportSectionEditor record={record} onUpdated={load} />
                  )}
                <Section title="سير اعتماد التقرير">
                  <div className="quick-actions">
                    {can('reports.create') && record.status === 'DRAFT' && (
                      <button onClick={() => void reportAction('generate')}>توليد التقرير</button>
                    )}
                    {can('reports.approve') && record.status === 'GENERATED' && (
                      <button onClick={() => void reportAction('approve')}>اعتماد التقرير</button>
                    )}
                    {can('reports.approve') && record.status === 'APPROVED' && (
                      <button onClick={() => void reportAction('archive')}>أرشفة التقرير</button>
                    )}
                    <button
                      className="outline-action"
                      onClick={() =>
                        void openExecutiveReportPrint(id).catch(() =>
                          setError('تعذر فتح عرض الطباعة.'),
                        )
                      }
                    >
                      عرض الطباعة
                    </button>
                  </div>
                </Section>
              </>
            )}
          </>
        )}
      </AsyncState>
    </div>
  );
}

function ReportSectionEditor({
  record,
  onUpdated,
}: {
  record: ExecutiveRecord;
  onUpdated: () => Promise<void>;
}) {
  const initialSections = Array.isArray(record.sections)
    ? record.sections.map((section) => {
        const value = section as Record<string, unknown>;
        return {
          title: value.title,
          content: value.content,
          sortOrder: value.sortOrder,
          sourceReferences: value.sourceReferences ?? undefined,
        };
      })
    : [];
  const [content, setContent] = useState(
    JSON.stringify(
      initialSections.length > 0
        ? initialSections
        : [{ title: 'قسم تنفيذي', content: {}, sortOrder: 0 }],
      null,
      2,
    ),
  );
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const sections = JSON.parse(content) as unknown;
      if (!Array.isArray(sections)) throw new Error('Sections must be an array.');
      await api(`/executive/reports/${record.id}/sections`, {
        method: 'PATCH',
        body: JSON.stringify({ sections }),
      });
      setMessage('تم حفظ أقسام التقرير وإعادته إلى حالة مولّد.');
      await onUpdated();
    } catch {
      setMessage('تعذر حفظ الأقسام. تحقق من بنية JSON والحقول المطلوبة.');
    }
  }

  return (
    <Section
      title="منشئ أقسام التقرير"
      hint="تحرير منظم مؤقت بصيغة JSON؛ بنية التصدير مستقلة عن مزود PDF المستقبلي."
    >
      <form className="report-section-editor" onSubmit={submit}>
        <label>
          الأقسام
          <textarea
            rows={14}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            spellCheck={false}
          />
        </label>
        <button>حفظ الأقسام</button>
        {message && <div className="status">{message}</div>}
      </form>
    </Section>
  );
}

function UpdateEntityForm({
  entity,
  record,
  onUpdated,
}: {
  entity: EntityDefinition['key'];
  record: ExecutiveRecord;
  onUpdated: () => Promise<void>;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      let path = `/executive/${entity}/${record.id}`;
      let method = 'PATCH';
      let payload: Record<string, unknown>;
      if (entity === 'metrics') {
        payload = {
          targetValue: optionalNumber(form, 'targetValue'),
          warningThreshold: optionalNumber(form, 'warningThreshold'),
          criticalThreshold: optionalNumber(form, 'criticalThreshold'),
          isActive: form.get('isActive') === 'true',
        };
      } else if (entity === 'objectives') {
        payload = {
          progress: Number(form.get('progress')),
          status: String(form.get('status')),
        };
      } else if (entity === 'kpis') {
        payload = {
          target: Number(form.get('target')),
          status: String(form.get('status')),
        };
      } else if (entity === 'initiatives') {
        path = `${path}/updates`;
        method = 'POST';
        payload = {
          summary: String(form.get('summary')),
          progress: Number(form.get('progress')),
          actualSpending: optionalNumber(form, 'actualSpending'),
          status: String(form.get('status')),
          updateDate: new Date().toISOString(),
        };
      } else if (entity === 'risks') {
        payload = {
          status: String(form.get('status')),
          reviewDate: optional(form, 'reviewDate') ?? null,
        };
      } else {
        payload = { title: String(form.get('title')) };
      }
      await api(path, { method, body: JSON.stringify(payload) });
      await onUpdated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذر تحديث السجل.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section
      title={entity === 'initiatives' ? 'تحديث تقدم المبادرة' : 'تحديث السجل'}
      hint="تُسجل التعديلات في سجل العمليات المؤسسي."
    >
      <form className="executive-create-form" onSubmit={submit}>
        {entity === 'metrics' && (
          <>
            <Field
              name="targetValue"
              label="المستهدف"
              type="number"
              defaultValue={String(record.targetValue ?? '')}
            />
            <Field
              name="warningThreshold"
              label="حد التحذير"
              type="number"
              defaultValue={String(record.warningThreshold ?? '')}
            />
            <Field
              name="criticalThreshold"
              label="الحد الحرج"
              type="number"
              defaultValue={String(record.criticalThreshold ?? '')}
            />
            <Select
              name="isActive"
              label="الحالة"
              options={['true', 'false']}
              labels={{ true: 'نشط', false: 'غير نشط' }}
              defaultValue={record.isActive === false ? 'false' : 'true'}
            />
          </>
        )}
        {entity === 'objectives' && (
          <>
            <Field
              name="progress"
              label="نسبة التقدم"
              type="number"
              defaultValue={String(record.progress ?? 0)}
              required
            />
            <Select
              name="status"
              label="الحالة"
              options={['NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED']}
              labels={{ [String(record.status)]: labelStatus(record.status) }}
              defaultValue={String(record.status)}
            />
          </>
        )}
        {entity === 'kpis' && (
          <>
            <Field
              name="target"
              label="المستهدف"
              type="number"
              defaultValue={String(record.target)}
              required
            />
            <Select
              name="status"
              label="الحالة"
              options={['NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED']}
              defaultValue={String(record.status)}
            />
          </>
        )}
        {entity === 'initiatives' && (
          <>
            <Field name="summary" label="ملخص التحديث" required />
            <Field
              name="progress"
              label="نسبة الإنجاز"
              type="number"
              defaultValue={String(record.progress ?? 0)}
              required
            />
            <Field
              name="actualSpending"
              label="المصروف الفعلي"
              type="number"
              defaultValue={String(record.actualSpending ?? 0)}
            />
            <Select
              name="status"
              label="الحالة"
              options={[
                'PLANNED',
                'ACTIVE',
                'AT_RISK',
                'DELAYED',
                'COMPLETED',
                'CANCELLED',
                'ON_HOLD',
              ]}
              defaultValue={String(record.status)}
            />
          </>
        )}
        {entity === 'risks' && (
          <>
            <Select
              name="status"
              label="حالة الخطر"
              options={['OPEN', 'UNDER_TREATMENT', 'ACCEPTED', 'CLOSED']}
              defaultValue={String(record.status)}
            />
            <Field
              name="reviewDate"
              label="تاريخ المراجعة"
              type="date"
              defaultValue={record.reviewDate ? String(record.reviewDate).slice(0, 10) : undefined}
            />
          </>
        )}
        {entity === 'reports' && (
          <Field name="title" label="عنوان التقرير" defaultValue={String(record.title)} required />
        )}
        {error && <div className="status error field-wide">{error}</div>}
        <button className="field-wide" disabled={busy}>
          {busy ? 'جارٍ التحديث…' : 'حفظ التحديث'}
        </button>
      </form>
    </Section>
  );
}

function TrendChart({ values }: { values: number[] }) {
  const valid = values.filter(Number.isFinite);
  if (valid.length === 0)
    return <div className="executive-empty">يظهر الرسم بعد تسجيل أول قياس.</div>;
  const maximum = Math.max(...valid, 1);
  return (
    <div className="trend-chart" aria-label="اتجاه القياسات">
      {valid
        .slice()
        .reverse()
        .slice(-12)
        .map((item, index) => (
          <span
            key={`${index}-${item}`}
            style={{ height: `${Math.max(5, (item / maximum) * 100)}%` }}
            title={number.format(item)}
          />
        ))}
    </div>
  );
}

export function RiskHeatMatrix() {
  const [matrix, setMatrix] = useState<number[][]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ matrix: number[][] }>('/executive/risks/heat-matrix')
      .then((result) => setMatrix(result.matrix))
      .catch(() => setError('تعذر تحميل مصفوفة المخاطر.'));
  }, []);
  return (
    <div className="executive-page">
      <div className="executive-hero compact">
        <div>
          <small>سجل المخاطر</small>
          <h1>مصفوفة الحرارة</h1>
        </div>
        <NavLink className="outline-action" to="/executive/risks">
          سجل المخاطر
        </NavLink>
      </div>
      {error ? (
        <div className="status error">{error}</div>
      ) : (
        <div className="risk-matrix" aria-label="مصفوفة احتمال وأثر المخاطر">
          {matrix
            .slice()
            .reverse()
            .flatMap((row, rowIndex) =>
              row.map((count, columnIndex) => {
                const score = (5 - rowIndex) * (columnIndex + 1);
                return (
                  <div
                    className={`risk-cell risk-score-${score}`}
                    key={`${rowIndex}-${columnIndex}`}
                  >
                    <strong>{count}</strong>
                    <small>درجة {score}</small>
                  </div>
                );
              }),
            )}
        </div>
      )}
    </div>
  );
}

export function AlertsCenter() {
  const { can } = useAuth();
  const [items, setItems] = useState<ExecutiveRecord[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      api<PageResult>('/executive/alerts?page=1&pageSize=100')
        .then((result) => setItems(result.items))
        .catch(() => setError('تعذر تحميل التنبيهات.')),
    [],
  );
  useEffect(() => void load(), [load]);
  async function action(id: string, operation: string) {
    await api(`/executive/alerts/${id}/${operation}`, { method: 'POST' });
    await load();
  }
  return (
    <div className="executive-page">
      <div className="executive-hero compact">
        <div>
          <small>المتابعة الاستباقية</small>
          <h1>مركز التنبيهات التنفيذية</h1>
        </div>
        {can('alerts.manage') && (
          <button
            onClick={() => void api('/executive/alerts/generate', { method: 'POST' }).then(load)}
          >
            توليد التنبيهات الآن
          </button>
        )}
      </div>
      {error && <div className="status error">{error}</div>}
      <div className="alert-grid">
        {items.map((item) => (
          <article className="executive-section" key={item.id}>
            <span className={badgeClass(item.severity)}>{labelStatus(item.severity)}</span>
            <h2>{String(item.title)}</h2>
            <p>{String(item.description)}</p>
            <small>{String(item.sourceModule)}</small>
            {can('alerts.manage') && String(item.status) === 'OPEN' && (
              <div className="alert-actions">
                <button onClick={() => void action(item.id, 'acknowledge')}>تم الاطلاع</button>
                <button className="secondary" onClick={() => void action(item.id, 'resolve')}>
                  معالجة
                </button>
                <button className="secondary" onClick={() => void action(item.id, 'dismiss')}>
                  استبعاد
                </button>
              </div>
            )}
          </article>
        ))}
        {items.length === 0 && <div className="executive-empty">لا توجد تنبيهات.</div>}
      </div>
    </div>
  );
}

export function ExecutiveHealthPage() {
  const [health, setHealth] = useState<ExecutiveHealth | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<ExecutiveHealth>('/executive/health')
      .then(setHealth)
      .catch(() => setError('تعذر تحميل تفاصيل الصحة التنفيذية.'));
  }, []);
  return (
    <div className="executive-page">
      <div className="executive-hero compact">
        <div>
          <small>منهجية شفافة قابلة للتدقيق</small>
          <h1>تفاصيل الصحة التنفيذية</h1>
        </div>
      </div>
      {error && <div className="status error">{error}</div>}
      {health && (
        <>
          <div className="executive-score-strip">
            <div className="score-ring">
              <strong>{valueText(health.score)}</strong>
              <span>من 100</span>
            </div>
            <div>
              <h2>{health.rating ?? 'غير مكتمل'}</h2>
              <p>{health.explanation}</p>
            </div>
          </div>
          <div className="health-components">
            {health.components.map((component) => (
              <article className="executive-section" key={component.key}>
                <div className="progress-label">
                  <h3>{component.label}</h3>
                  <span>الوزن {component.weight}%</span>
                </div>
                <Progress label="الدرجة" value={component.score} />
                <p>{component.explanation}</p>
                {component.missing && <span className="executive-badge">بيانات مفقودة</span>}
              </article>
            ))}
          </div>
          <Section title="سجل الصحة">
            <TrendChart values={(health.history ?? []).map((snapshot) => Number(snapshot.score))} />
          </Section>
        </>
      )}
    </div>
  );
}

export function DashboardPreferences() {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  useEffect(() => {
    api<{ healthWeights: Record<string, number> }>('/executive/preferences').then((result) =>
      setWeights(result.healthWeights),
    );
  }, []);
  const keys = [
    ['governance', 'الحوكمة'],
    ['strategic', 'التنفيذ الاستراتيجي'],
    ['operational', 'التنفيذ التشغيلي'],
    ['financial', 'الصحة المالية'],
    ['risk', 'صحة المخاطر'],
    ['knowledge', 'الامتثال المعرفي'],
  ] as const;
  const total = useMemo(
    () => Object.values(weights).reduce((sum, current) => sum + Number(current), 0),
    [weights],
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await api('/executive/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ healthWeights: weights }),
      });
      setMessage('تم حفظ الأوزان.');
    } catch {
      setMessage('يجب أن يساوي مجموع الأوزان 100%.');
    }
  }
  return (
    <div className="executive-page">
      <div className="executive-hero compact">
        <div>
          <small>إعدادات مخولة</small>
          <h1>تفضيلات لوحة القيادة</h1>
        </div>
      </div>
      <form className="card executive-create-form" onSubmit={submit}>
        {keys.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={weights[key] ?? ''}
              onChange={(event) =>
                setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))
              }
              required
            />
          </label>
        ))}
        <div className={total === 100 ? 'weight-total valid' : 'weight-total'}>
          المجموع: {number.format(total)}%
        </div>
        <button className="field-wide" disabled={total !== 100}>
          حفظ التفضيلات
        </button>
        {message && <div className="status field-wide">{message}</div>}
      </form>
    </div>
  );
}
