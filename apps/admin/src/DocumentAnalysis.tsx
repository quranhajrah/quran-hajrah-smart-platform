import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from './router';
import {
  api,
  type AnalysisConflict,
  type AnalysisImportBatch,
  type AnalysisJob,
  type AnalysisPage,
  type AnalysisProposal,
  type AnalysisTable,
  type PageResult,
} from './api';
import { useAuth } from './auth';
import { buildExtractionSummary, groupAnalysisProposals } from './document-analysis-view';

const statusLabels: Record<string, string> = {
  QUEUED: 'في قائمة الانتظار',
  PROCESSING: 'جارٍ التحليل',
  TEXT_EXTRACTED: 'اكتمل استخراج النص',
  PROPOSALS_READY: 'المقترحات جاهزة',
  UNDER_REVIEW: 'قيد المراجعة',
  PARTIALLY_APPROVED: 'معتمد جزئيًا',
  APPROVED: 'معتمد',
  IMPORTING: 'جارٍ الاستيراد',
  IMPORTED: 'تم الاستيراد',
  FAILED: 'فشل التحليل',
  OCR_REQUIRED: 'يحتاج إلى OCR',
  CANCELLED: 'ملغى',
};

const proposalLabels: Record<string, string> = {
  STRATEGIC_OBJECTIVE: 'هدف استراتيجي',
  KPI: 'مؤشر أداء',
  METRIC: 'مؤشر مؤسسي',
  INITIATIVE: 'مبادرة',
  MILESTONE: 'مرحلة رئيسية',
  RISK: 'خطر مؤسسي',
  RISK_TREATMENT: 'معالجة خطر',
  BUDGET: 'موازنة',
  BUDGET_LINE: 'بند موازنة',
  BENEFICIARY_GROUP: 'فئة مستفيدة',
  RESPONSIBLE_DEPARTMENT: 'جهة مسؤولة',
  DOCUMENT_DATE: 'تاريخ مستند',
  DOCUMENT_NUMBER: 'رقم مستند',
  POLICY_REQUIREMENT: 'متطلب لائحة أو سياسة',
  GOVERNANCE_SCORE: 'درجة حوكمة',
  FINANCIAL_VALUE: 'قيمة مالية',
  REPORTING_PERIOD: 'فترة تقرير',
  OTHER: 'مقترح آخر',
};

const decisionLabels: Record<string, string> = {
  PENDING: 'بانتظار القرار',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  EDITED: 'معدّل ومعتمد',
};

const importTargetLabels: Record<string, string> = {
  NONE: 'بدون استيراد',
  STRATEGIC_OBJECTIVE: 'هدف تشغيلي',
  KPI: 'مؤشر أداء',
  METRIC: 'تعريف مؤشر مؤسسي',
  METRIC_VALUE: 'قياس مؤشر مؤسسي',
  INITIATIVE: 'مبادرة تشغيلية',
  MILESTONE: 'مرحلة رئيسية',
  RISK: 'خطر مؤسسي',
  RISK_TREATMENT: 'معالجة خطر',
  EXECUTIVE_ALERT: 'تنبيه تنفيذي',
  EXECUTIVE_REPORT_SECTION: 'قسم تقرير تنفيذي',
  BUDGET_RECORD: 'موازنة',
  BUDGET_LINE: 'بند موازنة',
};

function StatusMessage({ children, error = false }: { children: string; error?: boolean }) {
  return <div className={error ? 'status error' : 'status'}>{children}</div>;
}

function AnalysisSummary({
  value,
}: {
  value: {
    analyzed: number;
    awaitingReview: number;
    awaitingApproval: number;
    imported: number;
    failed: number;
    ocrRequired: number;
  } | null;
}) {
  const cards = [
    ['المستندات المحللة', value?.analyzed ?? 0, 'metric-primary'],
    ['بانتظار المراجعة', value?.awaitingReview ?? 0, 'metric-review'],
    ['بانتظار الاعتماد', value?.awaitingApproval ?? 0, 'metric-warning'],
    ['المقترحات المستوردة', value?.imported ?? 0, 'metric-success'],
    ['تحليل متعثر', value?.failed ?? 0, 'metric-danger'],
    ['يحتاج OCR', value?.ocrRequired ?? 0, 'metric-muted'],
  ] as const;
  return (
    <div className="metrics-grid analysis-metrics">
      {cards.map(([label, count, tone]) => (
        <article className={`metric-card ${tone}`} key={label}>
          <span>{label}</span>
          <strong>{count.toLocaleString('ar-SA')}</strong>
        </article>
      ))}
    </div>
  );
}

export function DocumentAnalysisCenter() {
  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [summary, setSummary] = useState<Parameters<typeof AnalysisSummary>[0]['value']>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoading(true);
      const query = new URLSearchParams({ page: '1', pageSize: '50' });
      if (status) query.set('status', status);
      if (search.trim()) query.set('search', search.trim());
      Promise.all([
        api<PageResult<AnalysisJob>>(`/document-analysis/jobs?${query}`),
        api<NonNullable<typeof summary>>('/document-analysis/summary'),
      ])
        .then(([result, nextSummary]) => {
          setJobs(result.items);
          setSummary(nextSummary);
          setError('');
        })
        .catch((cause) =>
          setError(cause instanceof Error ? cause.message : 'تعذر تحميل مهام التحليل.'),
        )
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, status]);

  return (
    <section className="page analysis-page">
      <div className="page-title knowledge-heading">
        <div>
          <small>Enterprise 24</small>
          <h1>مركز تحليل المستندات المؤسسية</h1>
          <p>استخراج حتمي قابل للمراجعة، مع إبقاء المصدر والدليل والصفحة قبل أي استيراد.</p>
        </div>
        <Link className="primary-link" to="/documents">
          اختيار مستند للتحليل
        </Link>
      </div>
      <AnalysisSummary value={summary} />
      <section className="document-panel">
        <div className="document-toolbar">
          <div className="search-field">
            <span>⌕</span>
            <input
              aria-label="البحث في مهام التحليل"
              placeholder="ابحث باسم المستند…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            aria-label="حالة مهمة التحليل"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">كل الحالات</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <StatusMessage error>{error}</StatusMessage>
        ) : loading ? (
          <StatusMessage>جارٍ تحميل مهام التحليل…</StatusMessage>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>المستند</th>
                  <th>الحالة</th>
                  <th>الصفحات</th>
                  <th>الجداول</th>
                  <th>المقترحات</th>
                  <th>آخر تحديث</th>
                  <th>الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <strong>{job.document?.title ?? 'مستند'}</strong>
                      <small>الإصدار {job.document?.versionNumber ?? '—'}</small>
                    </td>
                    <td>
                      <span className={`analysis-status analysis-${job.status.toLowerCase()}`}>
                        {statusLabels[job.status] ?? job.status}
                      </span>
                    </td>
                    <td>{job.pageCount.toLocaleString('ar-SA')}</td>
                    <td>{job.tableCount.toLocaleString('ar-SA')}</td>
                    <td>{job.proposalCount.toLocaleString('ar-SA')}</td>
                    <td>{new Date(job.updatedAt).toLocaleString('ar-SA')}</td>
                    <td>
                      <Link to={`/document-analysis/jobs/${job.id}`}>فتح المراجعة</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {jobs.length === 0 && <StatusMessage>لا توجد مهام مطابقة.</StatusMessage>}
          </div>
        )}
      </section>
    </section>
  );
}

const asEditableJson = (proposal: AnalysisProposal) =>
  JSON.stringify(proposal.editedData ?? proposal.proposedData, null, 2);

export function DocumentAnalysisReview() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [pages, setPages] = useState<AnalysisPage[]>([]);
  const [tables, setTables] = useState<AnalysisTable[]>([]);
  const [proposals, setProposals] = useState<AnalysisProposal[]>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [selected, setSelected] = useState<AnalysisProposal | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [decisionFilter, setDecisionFilter] = useState('');
  const [minimumConfidence, setMinimumConfidence] = useState('0');
  const [pageFilter, setPageFilter] = useState('');
  const [editJson, setEditJson] = useState('');
  const [importTargetType, setImportTargetType] = useState('NONE');
  const [conflicts, setConflicts] = useState<AnalysisConflict[]>([]);
  const [conflictActions, setConflictActions] = useState<Record<string, string>>({});
  const [mergeFields, setMergeFields] = useState<Record<string, string>>({});
  const [importBatch, setImportBatch] = useState<AnalysisImportBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const proposalQuery = new URLSearchParams({ page: '1', pageSize: '100' });
    if (typeFilter) proposalQuery.set('proposalType', typeFilter);
    if (decisionFilter) proposalQuery.set('decision', decisionFilter);
    if (Number(minimumConfidence) > 0) proposalQuery.set('minimumConfidence', minimumConfidence);
    if (pageFilter) proposalQuery.set('pageNumber', pageFilter);
    const [nextJob, nextPages, nextTables, nextProposals, nextAudit] = await Promise.all([
      api<AnalysisJob>(`/document-analysis/jobs/${id}`),
      api<AnalysisPage[]>(`/document-analysis/jobs/${id}/pages`),
      api<AnalysisTable[]>(`/document-analysis/jobs/${id}/tables`),
      api<PageResult<AnalysisProposal>>(`/document-analysis/jobs/${id}/proposals?${proposalQuery}`),
      can('document_analysis.audit')
        ? api<{ items: Array<Record<string, unknown>> }>(
            `/document-analysis/jobs/${id}/audit?page=1&pageSize=50`,
          ).then((result) => result.items)
        : Promise.resolve([]),
    ]);
    setJob(nextJob);
    setPages(nextPages);
    setTables(nextTables);
    setProposals(nextProposals.items);
    setAudit(nextAudit);
    setSelected((current) =>
      current ? (nextProposals.items.find((item) => item.id === current.id) ?? null) : null,
    );
  }, [can, decisionFilter, id, minimumConfidence, pageFilter, typeFilter]);

  useEffect(() => {
    void load().catch((cause) =>
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل تفاصيل التحليل.'),
    );
  }, [load]);

  useEffect(() => {
    if (!job || !['QUEUED', 'PROCESSING', 'IMPORTING'].includes(job.status)) return;
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, [job, load]);

  const groupedPages = useMemo(
    () => new Map(pages.map((page) => [page.pageNumber, page])),
    [pages],
  );
  const groupedProposals = useMemo(() => groupAnalysisProposals(proposals), [proposals]);
  const extractionSummary = useMemo(
    () =>
      buildExtractionSummary(
        proposals,
        job?.pageCount ?? pages.length,
        job?.tableCount ?? tables.length,
      ),
    [job?.pageCount, job?.tableCount, pages.length, proposals, tables.length],
  );

  function choose(proposal: AnalysisProposal) {
    setSelected(proposal);
    setEditJson(asEditableJson(proposal));
    setImportTargetType(proposal.importTargetType);
  }

  async function review(
    proposalId: string,
    decision: 'approve' | 'reject',
    editedData?: Record<string, unknown>,
  ) {
    setBusy(true);
    setError('');
    try {
      await api(`/document-analysis/proposals/${proposalId}/${decision}`, {
        method: 'POST',
        body: JSON.stringify(editedData ? { editedData } : {}),
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ قرار المراجعة.');
    } finally {
      setBusy(false);
    }
  }

  async function saveAndApprove(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      const value = JSON.parse(editJson) as Record<string, unknown>;
      if (importTargetType !== selected.importTargetType) {
        await api(`/document-analysis/proposals/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ importTargetType }),
        });
      }
      await review(selected.id, 'approve', value);
    } catch (cause) {
      if (cause instanceof SyntaxError) setError('صيغة البيانات المعدلة غير صحيحة.');
    }
  }

  async function bulk(decision: 'APPROVED' | 'REJECTED') {
    if (selectedIds.length === 0) return;
    setBusy(true);
    try {
      await api('/document-analysis/proposals/bulk-review', {
        method: 'POST',
        body: JSON.stringify({ proposalIds: selectedIds, decision }),
      });
      setSelectedIds([]);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ المراجعة الجماعية.');
    } finally {
      setBusy(false);
    }
  }

  async function previewImport() {
    setBusy(true);
    try {
      const result = await api<AnalysisConflict[]>(`/document-analysis/jobs/${id}/import-preview`, {
        method: 'POST',
      });
      setConflicts(result);
      setConflictActions(
        Object.fromEntries(result.map((item) => [item.proposalId, item.defaultAction])),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء معاينة الاستيراد.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!window.confirm('سيتم استيراد المقترحات المعتمدة وفق القرارات المعروضة. هل تريد المتابعة؟'))
      return;
    setBusy(true);
    try {
      const batch = await api<AnalysisImportBatch>(`/document-analysis/jobs/${id}/import`, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({
          decisions: conflicts.map((item) => ({
            proposalId: item.proposalId,
            action: conflictActions[item.proposalId] ?? 'skip',
            ...((conflictActions[item.proposalId] ?? item.defaultAction) === 'merge'
              ? {
                  selectedFields: (mergeFields[item.proposalId] ?? '')
                    .split(',')
                    .map((field) => field.trim())
                    .filter(Boolean),
                }
              : {}),
          })),
        }),
      });
      setImportBatch(batch);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر استيراد المقترحات.');
    } finally {
      setBusy(false);
    }
  }

  if (!job) {
    return (
      <section className="page">
        <StatusMessage>{error || 'جارٍ تحميل مهمة التحليل…'}</StatusMessage>
      </section>
    );
  }

  return (
    <section className="page analysis-page">
      <div className="breadcrumbs">
        <Link to="/document-analysis">مركز التحليل</Link>
        <span>/</span>
        <span>{job.document?.title}</span>
      </div>
      <div className="document-detail-heading">
        <div>
          <small>تحليل الإصدار {job.document?.versionNumber}</small>
          <h1>{job.document?.title}</h1>
          <p>
            {statusLabels[job.status] ?? job.status} · {job.pageCount} صفحة · {job.proposalCount}{' '}
            مقترح
          </p>
        </div>
        <div className="detail-actions">
          <Link className="outline-action" to={`/documents/${job.documentId}`}>
            فتح المستند الأصلي
          </Link>
          {can('document_analysis.run') &&
            ['FAILED', 'OCR_REQUIRED', 'CANCELLED'].includes(job.status) && (
              <button
                disabled={busy}
                onClick={() =>
                  void api(`/document-analysis/jobs/${id}/retry`, { method: 'POST' })
                    .then(() => load())
                    .catch((cause) => setError(String(cause)))
                }
              >
                إعادة التحليل
              </button>
            )}
          {can('document_analysis.run') && ['QUEUED', 'PROCESSING'].includes(job.status) && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void api(`/document-analysis/jobs/${id}/cancel`, {
                  method: 'POST',
                })
                  .then(() => load())
                  .catch((cause) =>
                    setError(cause instanceof Error ? cause.message : 'تعذر إلغاء مهمة التحليل.'),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              إلغاء التحليل
            </button>
          )}
        </div>
      </div>
      {job.failureReason && <StatusMessage error>{job.failureReason}</StatusMessage>}
      {job.providerMetadata?.failure && (
        <div className="status-message analysis-failure-details" role="status">
          <strong>مرحلة الفشل: {job.providerMetadata.failure.stageLabel ?? 'غير محددة'}</strong>
          <span>
            الرمز: {job.providerMetadata.failure.errorCode ?? 'غير متاح'} · معرّف التشخيص:{' '}
            {job.providerMetadata.failure.diagnosticId ?? 'غير متاح'}
          </span>
        </div>
      )}
      {error && <StatusMessage error>{error}</StatusMessage>}

      <section className="document-panel">
        <div className="section-heading">
          <div>
            <h2>ملخص الاستخراج الدلالي</h2>
            <p>يعرض ما اكتُشف من المستند فقط، دون افتراض قيم غير موجودة في المصدر.</p>
          </div>
        </div>
        <div className="metrics-grid analysis-metrics">
          {[
            ['عدد الصفحات', extractionSummary.pageCount],
            ['عدد الجداول', extractionSummary.tableCount],
            ['عدد الأهداف', extractionSummary.objectives],
            ['عدد المؤشرات', extractionSummary.kpis],
            ['عدد المبادرات', extractionSummary.initiatives],
            ['عدد الفئات المستهدفة', extractionSummary.beneficiaries],
            ['عدد بنود الموازنة', extractionSummary.budgetLines],
            ['عناصر تحتاج مراجعة', extractionSummary.lowConfidence],
          ].map(([label, value]) => (
            <article className="metric-card metric-muted" key={label}>
              <span>{label}</span>
              <strong>{Number(value).toLocaleString('ar-SA')}</strong>
            </article>
          ))}
          <article className="metric-card metric-success">
            <span>إجمالي الموازنة المستخرج</span>
            <strong>
              {extractionSummary.budgetTotal === null
                ? 'غير متاح'
                : `${extractionSummary.budgetTotal.toLocaleString('ar-SA')} ر.س`}
            </strong>
          </article>
        </div>
      </section>

      <section className="document-panel">
        <div className="analysis-filter-grid">
          <label>
            نوع المقترح
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">الكل</option>
              {Object.entries(proposalLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            القرار
            <select
              value={decisionFilter}
              onChange={(event) => setDecisionFilter(event.target.value)}
            >
              <option value="">الكل</option>
              {Object.entries(decisionLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            الحد الأدنى للثقة
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={minimumConfidence}
              onChange={(event) => setMinimumConfidence(event.target.value)}
            />
          </label>
          <label>
            الصفحة
            <input
              type="number"
              min="1"
              value={pageFilter}
              onChange={(event) => setPageFilter(event.target.value)}
            />
          </label>
        </div>
        {proposals.length > 0 && can('document_analysis.review') && (
          <div className="analysis-selection-actions">
            <button
              className="outline-action"
              type="button"
              onClick={() =>
                setSelectedIds(
                  selectedIds.length === proposals.length
                    ? []
                    : proposals.map((proposal) => proposal.id),
                )
              }
            >
              {selectedIds.length === proposals.length
                ? 'إلغاء تحديد الظاهر'
                : 'تحديد كل المقترحات الظاهرة'}
            </button>
            {typeFilter && <small>سيُطبّق التحديد على النوع المصفّى فقط.</small>}
          </div>
        )}
        {selectedIds.length > 0 && can('document_analysis.review') && (
          <div className="bulk-bar">
            <span>{selectedIds.length} مقترحات محددة</span>
            {can('document_analysis.approve') && (
              <button disabled={busy} onClick={() => void bulk('APPROVED')}>
                اعتماد المحدد
              </button>
            )}
            <button className="secondary" disabled={busy} onClick={() => void bulk('REJECTED')}>
              رفض المحدد
            </button>
          </div>
        )}
        <div className="analysis-review-layout">
          <div className="proposal-list">
            {groupedProposals.map((group) => (
              <section className="proposal-group" key={group.label}>
                <h3>
                  {group.label} <small>({group.items.length.toLocaleString('ar-SA')})</small>
                </h3>
                {group.items.map((proposal) => (
                  <article
                    className={
                      selected?.id === proposal.id ? 'proposal-card selected' : 'proposal-card'
                    }
                    key={proposal.id}
                  >
                    <label className="proposal-check">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(proposal.id)}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, proposal.id]
                              : current.filter((item) => item !== proposal.id),
                          )
                        }
                      />
                      <span className={`decision decision-${proposal.decision.toLowerCase()}`}>
                        {decisionLabels[proposal.decision]}
                      </span>
                    </label>
                    <button className="proposal-open" onClick={() => choose(proposal)}>
                      <small>
                        {proposal.proposalType === 'STRATEGIC_OBJECTIVE' &&
                        proposal.proposedData.objectiveLevel === 'OPERATIONAL'
                          ? 'هدف تشغيلي'
                          : (proposalLabels[proposal.proposalType] ?? proposal.proposalType)}
                      </small>
                      <strong>{proposal.title}</strong>
                      <span>
                        الصفحة {proposal.sourcePage ?? '—'} · ثقة{' '}
                        {Math.round(proposal.confidence * 100)}%
                      </span>
                    </button>
                  </article>
                ))}
              </section>
            ))}
            {proposals.length === 0 && <StatusMessage>لا توجد مقترحات مطابقة.</StatusMessage>}
          </div>
          <div className="evidence-panel">
            {selected ? (
              <>
                <div className="evidence-heading">
                  <div>
                    <small>{proposalLabels[selected.proposalType]}</small>
                    <h2>{selected.title}</h2>
                  </div>
                  <span>{Math.round(selected.confidence * 100)}%</span>
                </div>
                <div className="source-reference">
                  <strong>المصدر والدليل</strong>
                  <p>
                    الصفحة {selected.sourcePage ?? '—'}
                    {selected.sourceSection ? ` · ${selected.sourceSection}` : ''}
                  </p>
                  <blockquote>{selected.evidenceSnippet || 'لا يوجد مقتطف محفوظ.'}</blockquote>
                  {selected.sourcePage && groupedPages.get(selected.sourcePage) && (
                    <details>
                      <summary>عرض النص المستخرج من الصفحة</summary>
                      <pre>{groupedPages.get(selected.sourcePage)?.text}</pre>
                    </details>
                  )}
                </div>
                <div className="proposal-data">
                  <strong>البيانات المقترحة</strong>
                  <dl>
                    {selected.fields?.map((field) => (
                      <div key={field.key}>
                        <dt>{field.labelAr}</dt>
                        <dd>
                          {Array.isArray(field.value)
                            ? field.value.join('، ')
                            : String(field.value ?? '—')}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
                {selected.relations && selected.relations.length > 0 && (
                  <div className="proposal-data">
                    <strong>العناصر المرتبطة</strong>
                    <ul>
                      {selected.relations.map((relation) => (
                        <li key={relation.id}>
                          {relation.direction === 'parent' ? 'يتبع' : 'يتضمن'}:{' '}
                          {relation.proposal.title}
                          <small> · {Math.round(relation.confidence * 100)}%</small>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {can('document_analysis.review') && selected.decision === 'PENDING' && (
                  <form className="proposal-edit-form" onSubmit={saveAndApprove}>
                    <label>
                      وجهة الاستيراد
                      <select
                        value={importTargetType}
                        onChange={(event) => setImportTargetType(event.target.value)}
                      >
                        {Object.entries(importTargetLabels).map(([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      {selected.proposalType === 'BENEFICIARY_GROUP' && (
                        <small>
                          لا تُحوّل أعداد المستفيدين إلى قياس حي إلا بعد اختيار «قياس مؤشر مؤسسي»
                          وتحديد المؤشر وتاريخ القياس صراحة.
                        </small>
                      )}
                    </label>
                    <label>
                      تعديل البيانات قبل الاعتماد
                      <textarea
                        rows={10}
                        dir="ltr"
                        value={editJson}
                        onChange={(event) => setEditJson(event.target.value)}
                      />
                    </label>
                    <div className="form-actions">
                      {can('document_analysis.approve') && (
                        <button disabled={busy}>حفظ التعديل واعتماد</button>
                      )}
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => void review(selected.id, 'reject')}
                      >
                        رفض
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <StatusMessage>اختر مقترحًا لعرض الدليل والبيانات.</StatusMessage>
            )}
          </div>
        </div>
      </section>

      <section className="document-panel analysis-tables">
        <h2>الجداول المستخرجة</h2>
        {tables.map((table) => (
          <details key={table.id}>
            <summary>
              الصفحة {table.pageNumber} · الجدول {table.tableIndex + 1} · {table.rowCount} صفوف
            </summary>
            <div className="table-wrap">
              <table>
                <tbody>
                  {table.rows.map((row, rowIndex) => (
                    <tr key={`${table.id}-${rowIndex}`}>
                      {row.map((cell, columnIndex) => (
                        <td key={`${table.id}-${rowIndex}-${columnIndex}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
        {tables.length === 0 && <StatusMessage>لم تُكتشف جداول قابلة للاستخراج.</StatusMessage>}
      </section>

      {can('document_analysis.import') && (
        <section className="document-panel import-panel">
          <div className="section-heading">
            <div>
              <h2>معاينة الاستيراد</h2>
              <p>الافتراضي هو التخطي عند وجود تعارض أو نقص في البيانات.</p>
            </div>
            <button disabled={busy} onClick={() => void previewImport()}>
              فحص التعارضات
            </button>
          </div>
          {conflicts.map((conflict) => (
            <div className={`conflict-row conflict-${conflict.status}`} key={conflict.proposalId}>
              <div>
                <strong>
                  {proposals.find((item) => item.id === conflict.proposalId)?.title ??
                    conflict.proposalId}
                </strong>
                <span>{conflict.reason ?? 'جاهز للاستيراد'}</span>
              </div>
              <select
                value={conflictActions[conflict.proposalId] ?? conflict.defaultAction}
                onChange={(event) =>
                  setConflictActions((current) => ({
                    ...current,
                    [conflict.proposalId]: event.target.value,
                  }))
                }
              >
                {conflict.allowedActions.map((action) => (
                  <option value={action} key={action}>
                    {action === 'skip'
                      ? 'تخطي'
                      : action === 'update'
                        ? 'تحديث الموجود'
                        : action === 'merge'
                          ? 'دمج الحقول'
                          : 'إنشاء جديد'}
                  </option>
                ))}
              </select>
              {(conflictActions[conflict.proposalId] ?? conflict.defaultAction) === 'merge' && (
                <input
                  aria-label="الحقول المحددة للدمج"
                  placeholder="title, target, ownerId"
                  value={mergeFields[conflict.proposalId] ?? ''}
                  onChange={(event) =>
                    setMergeFields((current) => ({
                      ...current,
                      [conflict.proposalId]: event.target.value,
                    }))
                  }
                />
              )}
            </div>
          ))}
          {conflicts.length > 0 && (
            <button disabled={busy} onClick={() => void confirmImport()}>
              تأكيد الاستيراد
            </button>
          )}
          {importBatch && (
            <StatusMessage>
              {`نتيجة الاستيراد: ${importBatch.status} — الدفعة ${importBatch.id}`}
            </StatusMessage>
          )}
        </section>
      )}

      {can('document_analysis.audit') && (
        <section className="document-panel history-panel">
          <h2>سجل التحليل والمراجعة والاستيراد</h2>
          <div className="audit-timeline">
            {audit.map((entry) => (
              <article key={String(entry.id)}>
                <span className="audit-dot" />
                <div>
                  <strong>{String(entry.action)}</strong>
                  <p>{String(entry.description)}</p>
                  <small>{new Date(String(entry.createdAt)).toLocaleString('ar-SA')}</small>
                </div>
              </article>
            ))}
            {audit.length === 0 && <StatusMessage>لا توجد عمليات مسجلة.</StatusMessage>}
          </div>
        </section>
      )}
    </section>
  );
}
