import { useMemo, useState, type ReactNode } from 'react';
import type { ExecutiveDashboard, ExecutiveHealth, ExecutiveRecord } from './api';
import {
  CoverageNotice,
  ExecutiveEmptyState,
  FreshnessBadge,
  SourceBadge,
} from './ExecutiveFoundation';
import {
  MISSING_VALUE,
  formatDate,
  formatMoney,
  formatNumber,
  formatStatus,
  recordNumber,
  recordString,
  relatedName,
} from './ExecutiveInsightsShared';
import type { KnowledgeIndexSummary } from './executive-insights-data';
import { Link } from './router';

const healthSources: Record<string, { label: string; to: string }> = {
  governance: { label: 'مؤشر الحوكمة المعتمد', to: '/executive/metrics' },
  strategic: { label: 'تقدم الخطة الاستراتيجية', to: '/executive/metrics' },
  operational: { label: 'تقدم الخطة التشغيلية', to: '/executive/metrics' },
  financial: { label: 'تنفيذ الموازنة المؤسسية', to: '/executive/metrics' },
  risk: { label: 'سجل المخاطر المتبقية', to: '/executive/risks' },
  knowledge: { label: 'الوثائق المصرح بها', to: '/documents' },
};

export function HealthComponentBreakdown({
  health,
  loadedAt,
}: {
  health: ExecutiveHealth;
  loadedAt?: string;
}) {
  return (
    <div className="ex-lead-health-layout">
      <div className="ex-lead-health-score" aria-label="الصحة المؤسسية وتغطيتها">
        <div
          className="ex-lead-score-ring"
          role="img"
          aria-label={
            health.score === null
              ? `درجة الصحة غير مكتملة، التغطية ${health.coverage}%`
              : `درجة الصحة ${health.score} من 100، التغطية ${health.coverage}%`
          }
        >
          <strong>{health.score === null ? '—' : health.score.toLocaleString('ar-SA')}</strong>
          <span>من 100</span>
        </div>
        <div>
          <h3>{health.rating ?? 'التقييم غير مكتمل'}</h3>
          <p>{health.explanation}</p>
          <CoverageNotice coverage={health.coverage} missing={health.missingData} />
          {loadedAt && <FreshnessBadge timestamp={loadedAt} />}
        </div>
      </div>
      <div className="ex-health-component-list" role="list" aria-label="مكونات الصحة الموزونة">
        {health.components.map((component) => {
          const source = healthSources[component.key] ?? {
            label: 'حساب الصحة المؤسسية',
            to: '/executive/health',
          };
          return (
            <article className="ex-health-component" role="listitem" key={component.key}>
              <header>
                <div>
                  <h3>{component.label}</h3>
                  <span>الوزن: {component.weight.toLocaleString('ar-SA')}٪</span>
                </div>
                <strong>
                  {component.score === null
                    ? MISSING_VALUE
                    : `${component.score.toLocaleString('ar-SA')} / 100`}
                </strong>
              </header>
              <progress
                max="100"
                value={component.score ?? 0}
                aria-label={`درجة ${component.label}`}
                aria-valuetext={
                  component.score === null
                    ? MISSING_VALUE
                    : `${component.score.toLocaleString('ar-SA')} من 100`
                }
              />
              <p>{component.explanation}</p>
              <div>
                <span>
                  المساهمة الموزونة:{' '}
                  {component.contribution === null
                    ? MISSING_VALUE
                    : component.contribution.toLocaleString('ar-SA')}
                </span>
                <SourceBadge label={source.label} to={source.to} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

type MetricValue = ExecutiveDashboard['institutionalMetrics'][string] | null;

export function MetricProgressComparison({
  metrics,
  loadedAt,
}: {
  metrics: Array<{ key: string; label: string; metric: MetricValue }>;
  loadedAt?: string;
}) {
  return (
    <div className="ex-metric-comparisons" role="list">
      {metrics.map(({ key, label, metric }) => {
        const numeric = typeof metric?.value === 'number' ? metric.value : null;
        return (
          <article className="ex-metric-comparison" role="listitem" key={key}>
            <header>
              <div>
                <small>{label}</small>
                <h3>{metric?.nameAr ?? label}</h3>
              </div>
              <strong>
                {metric?.value === null || metric?.value === undefined
                  ? MISSING_VALUE
                  : `${String(metric.value)}${metric.unit ? ` ${metric.unit}` : ''}`}
              </strong>
            </header>
            <progress
              max="100"
              value={numeric === null ? 0 : Math.max(0, Math.min(numeric, 100))}
              aria-label={metric?.nameAr ?? label}
              aria-valuetext={
                numeric === null
                  ? MISSING_VALUE
                  : `${numeric.toLocaleString('ar-SA')}${metric?.unit ? ` ${metric.unit}` : ''}`
              }
            />
            <dl>
              <div>
                <dt>تاريخ القياس</dt>
                <dd>{formatDate(metric?.measuredAt)}</dd>
              </div>
              <div>
                <dt>الوحدة</dt>
                <dd>{metric?.unit ?? MISSING_VALUE}</dd>
              </div>
            </dl>
            <footer>
              <SourceBadge label="سجل المؤشرات المؤسسية" to="/executive/metrics" />
              <FreshnessBadge timestamp={metric?.measuredAt ?? null} />
              {loadedAt && <small>تحميل الواجهة: {formatDate(loadedAt, true)}</small>}
            </footer>
          </article>
        );
      })}
    </div>
  );
}

export type StatusDistributionItem = {
  key: string;
  label: string;
  value: number;
  tone: string;
  to?: string;
};

export function AccessibleStatusDistribution({
  title,
  items,
}: {
  title: string;
  items: StatusDistributionItem[];
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const captionId = `status-distribution-${items
    .map((item) => item.key)
    .join('-')
    .toLowerCase()}`;
  if (total === 0) {
    return (
      <ExecutiveEmptyState
        title="لا توجد بيانات معتمدة"
        description={`لا توجد سجلات مصرح بها لبناء ${title}.`}
        compact
      />
    );
  }
  return (
    <figure className="ex-status-distribution" aria-labelledby={captionId}>
      <figcaption id={captionId}>
        {title}: الإجمالي {total.toLocaleString('ar-SA')}، وهو مجموع الحالات الظاهرة المصرح بها.
      </figcaption>
      <div className="ex-status-distribution-chart" aria-hidden="true">
        {items.map((item) => (
          <span
            className={`is-${item.tone}`}
            style={{ flexBasis: `${(item.value / total) * 100}%` }}
            key={item.key}
          />
        ))}
      </div>
      <div className="ex-status-distribution-legend" role="list">
        {items.map((item) => {
          const content = (
            <>
              <span className={`is-${item.tone}`} aria-hidden="true" />
              <strong>{item.label}</strong>
              <b>{item.value.toLocaleString('ar-SA')}</b>
            </>
          );
          return item.to ? (
            <Link role="listitem" to={item.to} key={item.key}>
              {content}
            </Link>
          ) : (
            <div role="listitem" key={item.key}>
              {content}
            </div>
          );
        })}
      </div>
    </figure>
  );
}

const objectiveCount = (objective: ExecutiveRecord, key: string) => {
  const counts =
    objective._count && typeof objective._count === 'object'
      ? (objective._count as Record<string, unknown>)
      : {};
  const value = Number(counts[key]);
  return Number.isFinite(value) ? value : 0;
};

export function ObjectivePortfolio({ objectives }: { objectives: ExecutiveRecord[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('code');
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ar');
    return objectives
      .filter((objective) => !status || recordString(objective, 'status') === status)
      .filter((objective) => {
        if (!normalized) return true;
        return [
          recordString(objective, 'code'),
          recordString(objective, 'title'),
          recordString(objective, 'strategicAxis'),
          relatedName(objective, 'owner'),
        ].some((value) => value.toLocaleLowerCase('ar').includes(normalized));
      })
      .sort((left, right) => {
        if (sort === 'progress') {
          return (recordNumber(right, 'progress') ?? -1) - (recordNumber(left, 'progress') ?? -1);
        }
        if (sort === 'weight') {
          return (recordNumber(right, 'weight') ?? -1) - (recordNumber(left, 'weight') ?? -1);
        }
        return recordString(left, 'code').localeCompare(recordString(right, 'code'), 'ar');
      });
  }, [objectives, query, sort, status]);

  const statuses = [
    ...new Set(objectives.map((item) => recordString(item, 'status')).filter(Boolean)),
  ];
  return (
    <div className="ex-objective-portfolio">
      <div className="ex-portfolio-filters" role="search" aria-label="تصفية محفظة الأهداف">
        <label>
          <span>البحث</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="العنوان أو المحور أو المالك…"
          />
        </label>
        <label>
          <span>الحالة</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">كل الحالات</option>
            {statuses.map((value) => (
              <option value={value} key={value}>
                {formatStatus(value)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>الترتيب</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="code">الرمز</option>
            <option value="progress">التقدم</option>
            <option value="weight">الوزن</option>
          </select>
        </label>
      </div>
      {visible.length === 0 ? (
        <ExecutiveEmptyState
          title="لا توجد بيانات معتمدة"
          description="لا توجد أهداف تطابق عوامل التصفية الحالية."
          compact
        />
      ) : (
        <div className="ex-objective-records" role="list">
          {visible.map((objective) => (
            <article role="listitem" key={objective.id}>
              <header>
                <div>
                  <small>{recordString(objective, 'code')}</small>
                  <h3>{recordString(objective, 'title')}</h3>
                </div>
                <span>{formatStatus(recordString(objective, 'status'))}</span>
              </header>
              <dl>
                <div>
                  <dt>المحور</dt>
                  <dd>{recordString(objective, 'strategicAxis') || MISSING_VALUE}</dd>
                </div>
                <div>
                  <dt>المالك</dt>
                  <dd>{relatedName(objective, 'owner')}</dd>
                </div>
                <div>
                  <dt>الوزن</dt>
                  <dd>{formatNumber(recordNumber(objective, 'weight'), '٪')}</dd>
                </div>
                <div>
                  <dt>التقدم</dt>
                  <dd>{formatNumber(recordNumber(objective, 'progress'), '٪')}</dd>
                </div>
                <div>
                  <dt>الفترة</dt>
                  <dd>
                    {formatDate(objective.startDate)} — {formatDate(objective.endDate)}
                  </dd>
                </div>
                <div>
                  <dt>الروابط</dt>
                  <dd>
                    {objectiveCount(objective, 'kpis').toLocaleString('ar-SA')} مؤشر ·{' '}
                    {objectiveCount(objective, 'initiatives').toLocaleString('ar-SA')} مبادرة
                  </dd>
                </div>
              </dl>
              <footer>
                <Link to={`/executive/objectives/${objective.id}`}>فتح الهدف</Link>
                <Link to={`/executive/kpis?objectiveId=${objective.id}`}>المؤشرات المرتبطة</Link>
                <Link to={`/executive/initiatives?objectiveId=${objective.id}`}>
                  المبادرات المرتبطة
                </Link>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export function KnowledgeComplianceSummary({
  documents,
  analysis,
  knowledge,
}: {
  documents: ExecutiveDashboard['summary']['documents'] | null;
  analysis: ExecutiveDashboard['documentAnalysis'] | null;
  knowledge: KnowledgeIndexSummary | null;
}) {
  const activeRatio =
    !documents || documents.total === 0 ? null : (documents.active / documents.total) * 100;
  const indexedRatio =
    !knowledge || !documents || documents.total === 0
      ? null
      : (knowledge.indexedDocuments / documents.total) * 100;
  return (
    <div className="ex-knowledge-compliance">
      <div className="ex-compliance-formulas">
        {documents && (
          <p>
            امتثال الوثائق النشطة = الوثائق النشطة ÷ جميع الوثائق المرئية. النتيجة:{' '}
            <strong>{activeRatio === null ? MISSING_VALUE : `${activeRatio.toFixed(1)}٪`}</strong>
          </p>
        )}
        {documents && knowledge && (
          <p>
            تغطية الفهرسة = الوثائق المفهرسة المرئية ÷ جميع الوثائق المرئية. النتيجة:{' '}
            <strong>{indexedRatio === null ? MISSING_VALUE : `${indexedRatio.toFixed(1)}٪`}</strong>
          </p>
        )}
      </div>
      <dl className="ex-compliance-metrics">
        {documents && (
          <>
            <div>
              <dt>إجمالي الوثائق المرئية</dt>
              <dd>{documents.total.toLocaleString('ar-SA')}</dd>
            </div>
            <div>
              <dt>نشطة</dt>
              <dd>{documents.active.toLocaleString('ar-SA')}</dd>
            </div>
            <div>
              <dt>قيد المراجعة</dt>
              <dd>{documents.underReview.toLocaleString('ar-SA')}</dd>
            </div>
            <div>
              <dt>قريبة الانتهاء</dt>
              <dd>{documents.expiring.toLocaleString('ar-SA')}</dd>
            </div>
          </>
        )}
        {knowledge && (
          <>
            <div>
              <dt>مفهرسة معرفيًا</dt>
              <dd>{knowledge.indexedDocuments.toLocaleString('ar-SA')}</dd>
            </div>
            <div>
              <dt>فهرسة معلقة/فاشلة</dt>
              <dd>
                {(knowledge.queuedDocuments + knowledge.failedDocuments).toLocaleString('ar-SA')}
              </dd>
            </div>
          </>
        )}
        {analysis && (
          <>
            <div>
              <dt>بانتظار مراجعة التحليل</dt>
              <dd>{analysis.awaitingReview.toLocaleString('ar-SA')}</dd>
            </div>
            <div>
              <dt>بانتظار اعتماد التحليل</dt>
              <dd>{analysis.awaitingApproval.toLocaleString('ar-SA')}</dd>
            </div>
          </>
        )}
      </dl>
      <nav aria-label="وجهات الامتثال المعرفي">
        {documents && <Link to="/documents">الوثائق</Link>}
        {analysis && <Link to="/document-analysis">تحليل المستندات</Link>}
        {knowledge && <Link to="/knowledge-intelligence">مركز المعرفة</Link>}
      </nav>
    </div>
  );
}

export function ExecutiveReportPipeline({
  reports,
  can,
}: {
  reports: ExecutiveRecord[];
  can(permission: string): boolean;
}) {
  const statuses = ['DRAFT', 'GENERATED', 'APPROVED', 'ARCHIVED'];
  const distribution = statuses.map((status) => ({
    key: status,
    label: formatStatus(status),
    value: reports.filter((report) => recordString(report, 'status') === status).length,
    tone: status.toLocaleLowerCase('en'),
    to: `/executive/reports?status=${status}`,
  }));
  return (
    <div className="ex-report-pipeline">
      <AccessibleStatusDistribution title="حالات التقارير التنفيذية" items={distribution} />
      <div className="ex-report-records" role="list">
        {reports.slice(0, 8).map((report) => (
          <article role="listitem" key={report.id}>
            <header>
              <div>
                <small>{formatStatus(recordString(report, 'reportType'))}</small>
                <h3>{recordString(report, 'title')}</h3>
              </div>
              <span>{formatStatus(recordString(report, 'status'))}</span>
            </header>
            <p>
              المُعد: {relatedName(report, 'preparedBy')} · التحديث: {formatDate(report.updatedAt)}
            </p>
            <div>
              <Link to={`/executive/reports/${report.id}`}>فتح التقرير</Link>
              {can('reports.create') && recordString(report, 'status') === 'DRAFT' && (
                <Link to={`/executive/reports/${report.id}`}>توليد/تحرير</Link>
              )}
              {can('reports.approve') && recordString(report, 'status') === 'GENERATED' && (
                <Link to={`/executive/reports/${report.id}`}>مراجعة للاعتماد</Link>
              )}
              {can('reports.approve') && recordString(report, 'status') === 'APPROVED' && (
                <Link to={`/executive/reports/${report.id}`}>الأرشفة</Link>
              )}
            </div>
          </article>
        ))}
      </div>
      {can('reports.create') && (
        <Link className="ex-primary-inline" to="/executive/reports">
          إنشاء تقرير عبر المسار المعتمد
        </Link>
      )}
    </div>
  );
}

export type CeoSummaryItem = {
  id: string;
  title: string;
  detail: string;
  source: string;
  to?: string;
  tone: 'problem' | 'opportunity';
};

export function CeoModeSummary({
  problems,
  opportunities,
  recommendationAction,
}: {
  problems: CeoSummaryItem[];
  opportunities: CeoSummaryItem[];
  recommendationAction?: ReactNode;
}) {
  const group = (title: string, items: CeoSummaryItem[], empty: string) => (
    <section>
      <h3>{title}</h3>
      {items.length === 0 ? (
        <ExecutiveEmptyState title="لا توجد بيانات معتمدة" description={empty} compact />
      ) : (
        <div role="list">
          {items.slice(0, 5).map((item) => {
            const body = (
              <>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
                <small>المصدر: {item.source}</small>
              </>
            );
            return item.to ? (
              <Link className={`is-${item.tone}`} role="listitem" to={item.to} key={item.id}>
                {body}
              </Link>
            ) : (
              <article className={`is-${item.tone}`} role="listitem" key={item.id}>
                {body}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
  return (
    <div className="ex-ceo-summary">
      {group('أهم المشكلات', problems, 'لم تُظهر السجلات المصرح بها مشكلات حرجة في النطاق الحالي.')}
      {group(
        'أهم الفرص',
        opportunities,
        'لا تُعرض فرصة دون دلالة إيجابية صريحة في البيانات المعتمدة.',
      )}
      <section>
        <h3>التوصيات المبنية على الأدلة</h3>
        {recommendationAction ?? (
          <p className="ex-ceo-no-recommendation">
            لا تُنشأ توصيات تلقائيًا. استخدم الإجراء المصرح به لطلبها من الأدلة المؤسسية.
          </p>
        )}
      </section>
    </div>
  );
}

export function InitiativePortfolioSummary({ initiatives }: { initiatives: ExecutiveRecord[] }) {
  const planned = initiatives.reduce((sum, item) => sum + (recordNumber(item, 'budget') ?? 0), 0);
  const actual = initiatives.reduce(
    (sum, item) => sum + (recordNumber(item, 'actualSpending') ?? 0),
    0,
  );
  const withProgress = initiatives.filter((item) => recordNumber(item, 'progress') !== null);
  const average =
    withProgress.length === 0
      ? null
      : withProgress.reduce((sum, item) => sum + (recordNumber(item, 'progress') ?? 0), 0) /
        withProgress.length;
  return (
    <div className="ex-initiative-summary">
      <dl>
        <div>
          <dt>متوسط التقدم المسجل</dt>
          <dd>{average === null ? MISSING_VALUE : `${average.toFixed(1)}٪`}</dd>
        </div>
        <div>
          <dt>الموازنات المخططة للمبادرات</dt>
          <dd>{formatMoney(planned)}</dd>
        </div>
        <div>
          <dt>الإنفاق الفعلي للمبادرات</dt>
          <dd>{formatMoney(actual)}</dd>
        </div>
        <div>
          <dt>الفرق</dt>
          <dd>{formatMoney(planned - actual)}</dd>
        </div>
      </dl>
      <p>
        متوسط التقدم = مجموع قيم التقدم المسجلة ÷ عدد المبادرات ذات القيمة (
        {withProgress.length.toLocaleString('ar-SA')}). فروق الإنفاق تخص المبادرات فقط ولا تمثل
        تنفيذ الموازنة المؤسسية.
      </p>
    </div>
  );
}
