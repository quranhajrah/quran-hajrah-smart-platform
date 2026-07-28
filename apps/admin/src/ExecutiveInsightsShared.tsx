/* eslint-disable react-refresh/only-export-components */
import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { ApiRequestError, type ExecutiveRecord } from './api';
import {
  generateExecutiveWriting,
  type ExecutiveAiWritingResponse,
  type RiskHeatMatrixData,
} from './executive-insights-data';
import { ExecutiveEmptyState } from './ExecutiveFoundation';
import { Link } from './router';
import './executive-sprint1b.css';

export const MISSING_VALUE = 'لا توجد بيانات معتمدة';

const statusLabels: Record<string, string> = {
  OPEN: 'مفتوح',
  ACKNOWLEDGED: 'تم الاطلاع',
  RESOLVED: 'مغلق بالمعالجة',
  DISMISSED: 'مستبعد',
  DELAYED: 'متأخرة',
  AT_RISK: 'معرضة للخطر',
  OFF_TRACK: 'خارج المسار',
  ON_TRACK: 'على المسار',
  UNDER_TREATMENT: 'تحت المعالجة',
  ACCEPTED: 'مقبول',
  CLOSED: 'مغلق',
  QUEUED: 'في قائمة الانتظار',
  PROCESSING: 'قيد المعالجة',
  TEXT_EXTRACTED: 'اكتمل استخراج النص',
  PROPOSALS_READY: 'المقترحات جاهزة للمراجعة',
  UNDER_REVIEW: 'بانتظار المراجعة',
  PARTIALLY_APPROVED: 'بانتظار استكمال الاعتماد',
  APPROVED: 'بانتظار الاستيراد',
  IMPORTING: 'قيد الاستيراد',
  IMPORTED: 'مستوردة',
  FAILED: 'متعذرة',
  OCR_REQUIRED: 'تتطلب OCR',
  CANCELLED: 'ملغاة',
};

const severityLabels: Record<string, string> = {
  INFO: 'معلومات',
  LOW: 'منخفض',
  MEDIUM: 'متوسط',
  HIGH: 'عالٍ',
  CRITICAL: 'حرج',
};

const likelihoodLabels: Record<string, string> = {
  RARE: 'نادر',
  UNLIKELY: 'غير محتمل',
  POSSIBLE: 'ممكن',
  LIKELY: 'مرجح',
  ALMOST_CERTAIN: 'شبه مؤكد',
};

const impactLabels: Record<string, string> = {
  INSIGNIFICANT: 'ضئيل',
  MINOR: 'محدود',
  MODERATE: 'متوسط',
  MAJOR: 'جسيم',
  SEVERE: 'شديد',
};

export const recordString = (record: ExecutiveRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return MISSING_VALUE;
};

export const recordNumber = (record: ExecutiveRecord, ...keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      return Number(value);
    }
  }
  return null;
};

export const relatedName = (record: ExecutiveRecord, key: string) => {
  const value = record[key];
  if (!value || typeof value !== 'object') return MISSING_VALUE;
  const related = value as Record<string, unknown>;
  for (const field of ['fullName', 'title', 'name', 'code']) {
    if (typeof related[field] === 'string' && related[field]) return String(related[field]);
  }
  return MISSING_VALUE;
};

export const formatStatus = (status: unknown) =>
  statusLabels[String(status)] ?? String(status || MISSING_VALUE);

export const formatSeverity = (severity: unknown) =>
  severityLabels[String(severity)] ?? String(severity || MISSING_VALUE);

export const formatDate = (value: unknown, withTime = false) => {
  if (!value) return MISSING_VALUE;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return withTime ? date.toLocaleString('ar-SA') : date.toLocaleDateString('ar-SA');
};

export const formatNumber = (value: number | null, unit?: string) =>
  value === null ? MISSING_VALUE : `${value.toLocaleString('ar-SA')}${unit ? ` ${unit}` : ''}`;

export const formatMoney = (value: number | null) =>
  value === null
    ? MISSING_VALUE
    : new Intl.NumberFormat('ar-SA', {
        style: 'currency',
        currency: 'SAR',
        maximumFractionDigits: 2,
      }).format(value);

export const calculateInitiativeVariance = (planned: number | null, actual: number | null) => {
  const amount = planned === null || actual === null ? null : planned - actual;
  return {
    amount,
    percentage:
      amount === null || planned === null || planned === 0
        ? null
        : Math.round((amount / planned) * 10_000) / 100,
  };
};

const localMidnight = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const daysFromToday = (value: unknown, now = new Date()) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((localMidnight(date) - localMidnight(now)) / 86_400_000);
};

export const sameLocalDay = (value: unknown, now = new Date()) => daysFromToday(value, now) === 0;

export function ExecutiveBreadcrumbs({
  current,
  parent,
}: {
  current: string;
  parent?: { label: string; to: string };
}) {
  return (
    <nav className="ex-breadcrumbs" aria-label="مسار الصفحة">
      <Link to="/">الرئيسية التنفيذية</Link>
      <span aria-hidden="true">/</span>
      {parent && (
        <>
          <Link to={parent.to}>{parent.label}</Link>
          <span aria-hidden="true">/</span>
        </>
      )}
      <span aria-current="page">{current}</span>
    </nav>
  );
}

export function ExecutiveQueue({
  label,
  children,
  empty,
  emptyDescription,
}: {
  label: string;
  children: ReactNode;
  empty: boolean;
  emptyDescription: string;
}) {
  if (empty) {
    return (
      <ExecutiveEmptyState title="لا توجد بيانات معتمدة" description={emptyDescription} compact />
    );
  }
  return (
    <div className="ex-exception-queue" role="list" aria-label={label}>
      {children}
    </div>
  );
}

export function ExceptionFilterBar({
  search,
  onSearch,
  status,
  onStatus,
  statusOptions,
  sort,
  onSort,
  sortOptions,
  owner,
  onOwner,
  ownerOptions = [],
  objective,
  onObjective,
  objectiveOptions = [],
}: {
  search: string;
  onSearch(value: string): void;
  status: string;
  onStatus(value: string): void;
  statusOptions: Array<{ value: string; label: string }>;
  sort: string;
  onSort(value: string): void;
  sortOptions: Array<{ value: string; label: string }>;
  owner?: string;
  onOwner?(value: string): void;
  ownerOptions?: string[];
  objective?: string;
  onObjective?(value: string): void;
  objectiveOptions?: string[];
}) {
  return (
    <div className="ex-exception-filters" role="search" aria-label="تصفية الاستثناءات">
      <label>
        <span>بحث</span>
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="ابحث بالعنوان أو الرمز…"
        />
      </label>
      <label>
        <span>الحالة</span>
        <select value={status} onChange={(event) => onStatus(event.target.value)}>
          <option value="">كل الحالات</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {onOwner && (
        <label>
          <span>المسؤول</span>
          <select value={owner} onChange={(event) => onOwner(event.target.value)}>
            <option value="">كل المسؤولين</option>
            {ownerOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )}
      {onObjective && (
        <label>
          <span>الهدف</span>
          <select value={objective} onChange={(event) => onObjective(event.target.value)}>
            <option value="">كل الأهداف</option>
            {objectiveOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        <span>الترتيب</span>
        <select value={sort} onChange={(event) => onSort(event.target.value)}>
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function AccessibleBulletChart({
  label,
  current,
  target,
  unit,
}: {
  label: string;
  current: number | null;
  target: number | null;
  unit?: string;
}) {
  if (current === null || target === null) {
    return (
      <div className="ex-bullet-chart is-missing">
        <strong>{label}</strong>
        <span>{MISSING_VALUE}</span>
      </div>
    );
  }
  const maximum = Math.max(Math.abs(current), Math.abs(target), 1);
  const currentWidth = Math.min(100, (Math.abs(current) / maximum) * 100);
  const targetPosition = Math.min(100, (Math.abs(target) / maximum) * 100);
  return (
    <div
      className="ex-bullet-chart"
      role="img"
      aria-label={`${label}: القيمة الحالية ${current} ${unit ?? ''}، المستهدف ${target} ${
        unit ?? ''
      }`}
    >
      <div>
        <strong>{label}</strong>
        <span>
          الحالي: {formatNumber(current, unit)} · المستهدف: {formatNumber(target, unit)}
        </span>
      </div>
      <div className="ex-bullet-track" aria-hidden="true">
        <span className="ex-bullet-current" style={{ width: `${currentWidth}%` }} />
        <i className="ex-bullet-target" style={{ insetInlineStart: `${targetPosition}%` }} />
      </div>
    </div>
  );
}

export type RiskCellSelection = { likelihood: string; impact: string } | null;

export function AccessibleRiskHeatMatrix({
  data,
  selection,
  onSelect,
}: {
  data: RiskHeatMatrixData;
  selection: RiskCellSelection;
  onSelect(selection: RiskCellSelection): void;
}) {
  const gridRef = useRef<HTMLTableElement>(null);
  const nonEmptyCells = useMemo(
    () =>
      data.likelihoods.flatMap((likelihood, row) =>
        data.impacts
          .map((impact, column) => ({
            likelihood,
            impact,
            count: data.matrix[row]?.[column] ?? 0,
          }))
          .filter((cell) => cell.count > 0),
      ),
    [data],
  );

  const focusCell = (row: number, column: number) => {
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-risk-cell="${row}-${column}"]`)
      ?.focus();
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, row: number, column: number) => {
    const next = {
      ArrowUp: [Math.max(0, row - 1), column],
      ArrowDown: [Math.min(4, row + 1), column],
      ArrowRight: [row, Math.max(0, column - 1)],
      ArrowLeft: [row, Math.min(4, column + 1)],
    }[event.key];
    if (!next) return;
    event.preventDefault();
    focusCell(next[0]!, next[1]!);
  };

  return (
    <div className="ex-risk-matrix-wrap">
      <div className="ex-risk-matrix-scroll">
        <table ref={gridRef} className="ex-risk-matrix">
          <caption>
            مصفوفة الخطر المتبقي. حد الخطر الحرج المعتمد في الخادم هو درجة{' '}
            {data.criticalThreshold.toLocaleString('ar-SA')} فأعلى.
          </caption>
          <thead>
            <tr>
              <th scope="col">الاحتمالية / الأثر</th>
              {data.impacts.map((impact) => (
                <th scope="col" key={impact}>
                  {impactLabels[impact] ?? impact}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.likelihoods.map((likelihood, row) => (
              <tr key={likelihood}>
                <th scope="row">{likelihoodLabels[likelihood] ?? likelihood}</th>
                {data.impacts.map((impact, column) => {
                  const count = data.matrix[row]?.[column] ?? 0;
                  const score = (row + 1) * (column + 1);
                  const selected =
                    selection?.likelihood === likelihood && selection.impact === impact;
                  return (
                    <td key={impact} data-score={score}>
                      <button
                        type="button"
                        data-risk-cell={`${row}-${column}`}
                        className={selected ? 'is-selected' : ''}
                        aria-pressed={selected}
                        aria-label={`${likelihoodLabels[likelihood]}، ${
                          impactLabels[impact]
                        }: ${count} مخاطر، درجة ${score}`}
                        onKeyDown={(event) => handleKey(event, row, column)}
                        onClick={() => onSelect(selected ? null : { likelihood, impact })}
                      >
                        <strong>{count.toLocaleString('ar-SA')}</strong>
                        <small>درجة {score.toLocaleString('ar-SA')}</small>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="ex-risk-matrix-alternative" aria-label="البديل النصي لمصفوفة المخاطر">
        <h3>القراءة الرقمية</h3>
        {nonEmptyCells.length === 0 ? (
          <p>لا توجد مخاطر مسجلة في خلايا المصفوفة.</p>
        ) : (
          <ul>
            {nonEmptyCells.map((cell) => (
              <li key={`${cell.likelihood}-${cell.impact}`}>
                {likelihoodLabels[cell.likelihood]} × {impactLabels[cell.impact]}:{' '}
                <strong>{cell.count.toLocaleString('ar-SA')}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function RecordLinkCard({
  to,
  title,
  eyebrow,
  metadata,
  children,
}: {
  to: string;
  title: string;
  eyebrow?: string;
  metadata?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Link className="ex-record-link-card" to={to} role="listitem">
      <span>
        {eyebrow && <small>{eyebrow}</small>}
        <strong>{title}</strong>
        {metadata && <span>{metadata}</span>}
      </span>
      {children}
      <i aria-hidden="true">←</i>
    </Link>
  );
}

export function DeadlineGroup({ title, items }: { title: string; items: ExecutiveRecord[] }) {
  return (
    <section className="ex-deadline-group">
      <h3>
        {title} <span>{items.length.toLocaleString('ar-SA')}</span>
      </h3>
      {items.length === 0 ? (
        <p>لا توجد استحقاقات مسجلة في هذه الفترة.</p>
      ) : (
        <div role="list">
          {items.map((item) => {
            const module = recordString(item, 'module');
            const riskId = typeof item.riskId === 'string' ? item.riskId : item.id;
            const to =
              module === 'risks'
                ? `/executive/risks/${riskId}`
                : `/executive/initiatives/${item.id}`;
            const due = item.dueDate ?? item.endDate;
            const remaining = daysFromToday(due);
            const owner = relatedName(item, 'owner');
            return (
              <RecordLinkCard
                key={`${module}-${item.id}`}
                to={to}
                title={recordString(item, 'title', 'name')}
                eyebrow={module === 'risks' ? 'معالجة خطر' : 'مبادرة تشغيلية'}
                metadata={
                  <>
                    <span>الاستحقاق: {formatDate(due)}</span>
                    {owner !== MISSING_VALUE && <span>المسؤول: {owner}</span>}
                    <span>
                      {remaining === null
                        ? MISSING_VALUE
                        : remaining < 0
                          ? `متأخر ${Math.abs(remaining).toLocaleString('ar-SA')} يوم`
                          : remaining === 0
                            ? 'مستحق اليوم'
                            : `متبقٍ ${remaining.toLocaleString('ar-SA')} يوم`}
                    </span>
                    <span>الحالة: {formatStatus(item.status)}</span>
                  </>
                }
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export function DomainCoverageNotice() {
  return (
    <aside className="ex-domain-coverage" aria-labelledby="domain-coverage-title">
      <div>
        <span aria-hidden="true">◎</span>
        <div>
          <h2 id="domain-coverage-title">نطاق الموجز اليومي المعتمد</h2>
          <p>
            يغطي المشهد الحالي المبادرات، والمخاطر، والتنبيهات، والوثائق، وتحليل المستندات، والنشاط
            المؤسسي المصرح به.
          </p>
        </div>
      </div>
      <p>
        لا يدّعي هذا الإصدار تغطية الاجتماعات، أو مهام الموظفين، أو معاملات التبرعات، أو جلسات
        الحلقات الحية، أو حضور الموارد البشرية، أو العقود غير المرتبطة بمصدر معتمد قائم.
      </p>
    </aside>
  );
}

export function MutationFeedback({
  tone,
  message,
  onDismiss,
}: {
  tone: 'success' | 'error';
  message: string;
  onDismiss?(): void;
}) {
  return (
    <div className={`ex-mutation-feedback is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="إغلاق الرسالة">
          ×
        </button>
      )}
    </div>
  );
}

const severityOrder: Record<string, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export const sortAlerts = (items: ExecutiveRecord[]) =>
  [...items].sort((left, right) => {
    const severity =
      (severityOrder[String(right.severity)] ?? 0) - (severityOrder[String(left.severity)] ?? 0);
    if (severity) return severity;
    const leftDue = left.dueDate ? new Date(String(left.dueDate)).getTime() : Number.MAX_VALUE;
    const rightDue = right.dueDate ? new Date(String(right.dueDate)).getTime() : Number.MAX_VALUE;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return (
      new Date(String(right.createdAt ?? 0)).getTime() -
      new Date(String(left.createdAt ?? 0)).getTime()
    );
  });

export const alertSourceLink = (alert: ExecutiveRecord) => {
  const module = recordString(alert, 'sourceModule');
  const id = typeof alert.sourceRecordId === 'string' ? alert.sourceRecordId : null;
  if (!id) return module === 'alerts' ? '/executive/alerts' : null;
  const routes: Record<string, string> = {
    initiatives: `/executive/initiatives/${id}`,
    initiative: `/executive/initiatives/${id}`,
    risks: `/executive/risks/${id}`,
    risk: `/executive/risks/${id}`,
    kpi: `/executive/kpis/${id}`,
    metrics: `/executive/metrics/${id}`,
    documents: `/documents/${id}`,
    document_analysis: `/document-analysis/jobs/${id}`,
    reports: `/executive/reports/${id}`,
  };
  return routes[module] ?? null;
};

export function AlertQueue({
  items,
  canManage,
  busyId,
  onAction,
  emptyDescription,
  canOpenSource = () => true,
}: {
  items: ExecutiveRecord[];
  canManage: boolean;
  busyId?: string | null;
  onAction?(alert: ExecutiveRecord, action: 'acknowledge' | 'resolve' | 'dismiss'): void;
  emptyDescription: string;
  canOpenSource?(alert: ExecutiveRecord): boolean;
}) {
  const ordered = sortAlerts(items);
  return (
    <ExecutiveQueue
      label="قائمة التنبيهات التنفيذية"
      empty={ordered.length === 0}
      emptyDescription={emptyDescription}
    >
      {ordered.map((alert) => {
        const source = canOpenSource(alert) ? alertSourceLink(alert) : null;
        const status = String(alert.status ?? 'OPEN');
        return (
          <article className="ex-alert-row" role="listitem" key={alert.id}>
            <div className="ex-alert-row-main">
              <span className={`ex-severity is-${String(alert.severity).toLowerCase()}`}>
                {formatSeverity(alert.severity)}
              </span>
              <div>
                <h3>{recordString(alert, 'title')}</h3>
                <p>{recordString(alert, 'description', 'message')}</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>الوحدة</dt>
                <dd>{recordString(alert, 'sourceModule')}</dd>
              </div>
              <div>
                <dt>الاستحقاق</dt>
                <dd>{formatDate(alert.dueDate)}</dd>
              </div>
              <div>
                <dt>الإنشاء</dt>
                <dd>{formatDate(alert.createdAt, true)}</dd>
              </div>
              <div>
                <dt>الحالة</dt>
                <dd>{formatStatus(status)}</dd>
              </div>
            </dl>
            <div className="ex-row-actions">
              {source && (
                <Link to={source} className="ex-secondary-link">
                  فتح المصدر
                </Link>
              )}
              {canManage && status === 'OPEN' && (
                <button
                  type="button"
                  disabled={busyId === alert.id}
                  onClick={() => onAction?.(alert, 'acknowledge')}
                >
                  إثبات الاطلاع
                </button>
              )}
              {canManage && ['OPEN', 'ACKNOWLEDGED'].includes(status) && (
                <>
                  <button
                    type="button"
                    disabled={busyId === alert.id}
                    onClick={() => onAction?.(alert, 'resolve')}
                  >
                    معالجة
                  </button>
                  <button
                    type="button"
                    className="ex-quiet-action"
                    disabled={busyId === alert.id}
                    onClick={() => onAction?.(alert, 'dismiss')}
                  >
                    استبعاد
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </ExecutiveQueue>
  );
}

export function WritingResult({ result }: { result: ExecutiveAiWritingResponse }) {
  const [copied, setCopied] = useState('');
  const copy = async (label: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  };
  const prose = [result.answer, result.executiveRecommendation].filter(Boolean).join('\n\n');
  const evidence = result.supportingReferences
    .map((reference) => `[${reference.reference}] «${reference.quote}» — ${reference.relevance}`)
    .join('\n');

  return (
    <section className="ex-writing-result" aria-live="polite">
      <header>
        <div>
          <small>Enterprise {result.version}</small>
          <h3>{result.status === 'ANSWERED' ? 'الصياغة التنفيذية المهنية' : 'الأدلة غير كافية'}</h3>
        </div>
        <div className="ex-writing-stats">
          <span>{result.evidence.documentCount.toLocaleString('ar-SA')} مستند</span>
          <span>{result.evidence.chunkCount.toLocaleString('ar-SA')} مرجع</span>
        </div>
      </header>
      <pre>{result.answer}</pre>
      {result.executiveRecommendation && (
        <div className="ex-writing-recommendation">
          <h4>التوصية التنفيذية</h4>
          <p>{result.executiveRecommendation}</p>
        </div>
      )}
      <div className="ex-writing-copy-actions">
        <button type="button" onClick={() => void copy('prose', prose)} disabled={!prose}>
          {copied === 'prose' ? 'تم نسخ الصياغة' : 'نسخ الصياغة والتوصيات'}
        </button>
        <button
          type="button"
          className="ex-secondary-button"
          onClick={() => void copy('evidence', evidence)}
          disabled={!evidence}
        >
          {copied === 'evidence' ? 'تم نسخ الأدلة' : 'نسخ الاقتباسات منفصلة'}
        </button>
      </div>
      {result.supportingReferences.length > 0 && (
        <div className="ex-writing-evidence">
          <h4>الاقتباسات الداعمة — منفصلة عن الصياغة</h4>
          {result.supportingReferences.map((reference) => (
            <blockquote key={reference.reference}>
              <p>
                [{reference.reference}] «{reference.quote}»
              </p>
              <footer>{reference.relevance}</footer>
            </blockquote>
          ))}
        </div>
      )}
      {result.sources.length > 0 && (
        <div className="ex-writing-sources">
          <h4>المصادر المصرح بها</h4>
          <ol>
            {result.sources.map((source) => (
              <li key={`${source.reference}-${source.documentId}-${source.pageNumber ?? 0}`}>
                <Link to={source.sourceUrl}>
                  [{source.reference}] {source.documentTitle}
                </Link>
                <span>
                  الإصدار {source.versionNumber}
                  {source.pageNumber ? ` · الصفحة ${source.pageNumber}` : ''}
                  {source.section ? ` · ${source.section}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {result.limitations.length > 0 && (
        <div className="ex-writing-limitations">
          <h4>الحدود</h4>
          <ul>
            {result.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function ExecutiveWritingPanel({ mode }: { mode: 'recommendations' | 'executive-report' }) {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<ExecutiveAiWritingResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const label = mode === 'recommendations' ? 'التوصيات التنفيذية' : 'الموجز التنفيذي اليومي';
  const endpoint =
    mode === 'recommendations' ? '/executive-ai/recommendations' : '/executive-ai/executive-report';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await generateExecutiveWriting(endpoint, question.trim()));
    } catch (failure) {
      setError(
        failure instanceof ApiRequestError
          ? failure.message
          : 'تعذر إنشاء الصياغة التنفيذية. بقي موضوعك محفوظًا لإعادة المحاولة.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ex-writing-panel">
      <form onSubmit={(event) => void submit(event)}>
        <label>
          <span>موضوع {label}</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={2}
            maxLength={1200}
            rows={4}
            required
            placeholder={
              mode === 'recommendations'
                ? 'حدد القضية أو الأولوية التي تريد توصيات مهنية بشأنها…'
                : 'حدد نطاق الموجز أو القرار التنفيذي المطلوب دعمه بالمراجع…'
            }
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'جارٍ فهم المراجع وإعادة الصياغة…' : `إنشاء ${label}`}
        </button>
        <small>لا يبدأ أي طلب تلقائيًا، وتُفصل الصياغة عن الاقتباسات والمصادر.</small>
      </form>
      {error && <MutationFeedback tone="error" message={error} />}
      {result && <WritingResult result={result} />}
    </div>
  );
}
