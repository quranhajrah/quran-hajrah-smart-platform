import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  downloadDocument,
  uploadDocumentFile,
  type DocumentAudit,
  type DocumentCategory,
  type DocumentDashboard,
  type DocumentRecord,
  type DocumentVersion,
} from './api';
import { useAuth } from './auth';

const documentTypes: Record<string, string> = {
  STRATEGIC_PLAN: 'خطة استراتيجية',
  OPERATIONAL_PLAN: 'خطة تشغيلية',
  BUDGET: 'موازنة',
  POLICY: 'سياسة',
  REGULATION: 'لائحة',
  REPORT: 'تقرير',
  MINUTES: 'محضر اجتماع',
  LETTER: 'خطاب أو مراسلة',
  CONTRACT: 'عقد',
  GOVERNANCE: 'حوكمة',
  FINANCIAL: 'مالي',
  PROGRAM: 'برنامج أو مبادرة',
  EMPLOYEE: 'موارد بشرية',
  EDUCATIONAL: 'تعليمي',
  MEDIA: 'إعلامي',
  OTHER: 'أخرى',
};

const statuses: Record<string, string> = {
  DRAFT: 'مسودة',
  ACTIVE: 'نشط',
  UNDER_REVIEW: 'قيد المراجعة',
  EXPIRED: 'منتهي',
  ARCHIVED: 'مؤرشف',
};

const confidentiality: Record<string, string> = {
  PUBLIC: 'عام',
  INTERNAL: 'داخلي',
  CONFIDENTIAL: 'سري',
  HIGHLY_CONFIDENTIAL: 'سري للغاية',
};

const auditActions: Record<string, string> = {
  CREATED: 'إنشاء',
  UPLOADED: 'رفع',
  VIEWED: 'عرض',
  DOWNLOADED: 'تنزيل',
  UPDATED: 'تحديث',
  VERSION_UPLOADED: 'إصدار جديد',
  ARCHIVED: 'أرشفة',
  RESTORED: 'استعادة',
  DELETED: 'حذف',
};

const date = (value?: string) => (value ? new Date(value).toLocaleDateString('ar-SA') : '—');
const fileSize = (value?: number) =>
  value === undefined
    ? '—'
    : new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 1 }).format(value / 1024 / 1024) +
      ' م.ب';

function Message({ children, error = false }: { children: string; error?: boolean }) {
  return <div className={error ? 'status error' : 'status'}>{children}</div>;
}

function ConfidentialityBadge({ level }: { level: string }) {
  return (
    <span className={`confidentiality confidentiality-${level.toLowerCase()}`}>
      {confidentiality[level] ?? level}
    </span>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString('ar-SA')}</strong>
    </article>
  );
}

type Filters = {
  search: string;
  categoryId: string;
  documentType: string;
  status: string;
  owningDepartment: string;
  confidentialityLevel: string;
  dateFrom: string;
  dateTo: string;
  archived: string;
};

const emptyFilters: Filters = {
  search: '',
  categoryId: '',
  documentType: '',
  status: '',
  owningDepartment: '',
  confidentialityLevel: '',
  dateFrom: '',
  dateTo: '',
  archived: 'false',
};

function UploadDocument({
  categories,
  onClose,
  onUploaded,
}: {
  categories: DocumentCategory[];
  onClose(): void;
  onUploaded(document: DocumentRecord): void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const selectedFile = form.get('file');
    if (!(selectedFile instanceof File) || selectedFile.size === 0) {
      setBusy(false);
      setError('اختر ملفًا صالحًا للرفع.');
      return;
    }
    const keywords = String(form.get('keywords') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const tags = String(form.get('tags') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const optional = (name: string) => {
      const value = String(form.get(name) ?? '').trim();
      return value || undefined;
    };
    try {
      const document = await api<DocumentRecord>('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: String(form.get('title')),
          description: optional('description'),
          categoryId: String(form.get('categoryId')),
          documentType: String(form.get('documentType')),
          documentNumber: optional('documentNumber'),
          documentDate: optional('documentDate'),
          effectiveDate: optional('effectiveDate'),
          expiryDate: optional('expiryDate'),
          status: String(form.get('status')),
          confidentialityLevel: String(form.get('confidentialityLevel')),
          owningDepartment: String(form.get('owningDepartment')),
          keywords,
          tags,
        }),
      });
      const uploaded = await uploadDocumentFile(document.id, selectedFile);
      onUploaded(uploaded.document);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر رفع المستند.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
      >
        <div className="modal-heading">
          <div>
            <small>مركز المعرفة المؤسسية</small>
            <h2 id="upload-title">رفع مستند جديد</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="إغلاق">
            ×
          </button>
        </div>
        <form className="document-form" onSubmit={submit}>
          <label className="field-wide">
            عنوان المستند
            <input name="title" required maxLength={240} />
          </label>
          <label>
            التصنيف
            <select name="categoryId" required defaultValue="">
              <option value="" disabled>
                اختر التصنيف
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            نوع المستند
            <select name="documentType" required defaultValue="REPORT">
              {Object.entries(documentTypes).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            الإدارة المالكة
            <input name="owningDepartment" required maxLength={160} />
          </label>
          <label>
            رقم المستند
            <input name="documentNumber" maxLength={100} />
          </label>
          <label>
            الحالة
            <select name="status" defaultValue="DRAFT">
              {Object.entries(statuses)
                .filter(([value]) => value !== 'ARCHIVED')
                .map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
            </select>
          </label>
          <label>
            مستوى السرية
            <select name="confidentialityLevel" defaultValue="INTERNAL">
              {Object.entries(confidentiality).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            تاريخ المستند
            <input name="documentDate" type="date" />
          </label>
          <label>
            تاريخ السريان
            <input name="effectiveDate" type="date" />
          </label>
          <label>
            تاريخ الانتهاء
            <input name="expiryDate" type="date" />
          </label>
          <label className="field-wide">
            الوصف
            <textarea name="description" maxLength={4000} rows={3} />
          </label>
          <label>
            الكلمات المفتاحية
            <input name="keywords" placeholder="افصل بينها بفاصلة" />
          </label>
          <label>
            الوسوم
            <input name="tags" placeholder="افصل بينها بفاصلة" />
          </label>
          <label className="field-wide file-drop">
            الملف
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.txt,.csv"
            />
            <small>الحد الأعلى ٢٥ م.ب — PDF وملفات Office والصور والنصوص</small>
          </label>
          {error && (
            <div className="field-wide">
              <Message error>{error}</Message>
            </div>
          )}
          <div className="form-actions field-wide">
            <button type="button" className="secondary" onClick={onClose}>
              إلغاء
            </button>
            <button disabled={busy}>{busy ? 'جارٍ الرفع…' : 'حفظ ورفع المستند'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function DocumentsCenter() {
  const { can } = useAuth();
  const [dashboard, setDashboard] = useState<DocumentDashboard | null>(null);
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [advanced, setAdvanced] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: '1', pageSize: '25' });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const loadSummary = () =>
    Promise.all([
      api<DocumentDashboard>('/documents/dashboard'),
      api<DocumentCategory[]>('/document-categories'),
    ]).then(([metrics, nextCategories]) => {
      setDashboard(metrics);
      setCategories(nextCategories);
    });

  useEffect(() => {
    void loadSummary().catch(() => setError('تعذر تحميل مؤشرات مركز المعرفة.'));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError('');
      api<{ items: DocumentRecord[]; total: number }>(`/documents?${query}`)
        .then((result) => {
          setDocuments(result.items);
          setTotal(result.total);
        })
        .catch(() => setError('تعذر تحميل المستندات.'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const setFilter = (name: keyof Filters, value: string) =>
    setFilters((current) => ({ ...current, [name]: value }));

  return (
    <section className="page knowledge-page">
      <div className="page-title knowledge-heading">
        <div>
          <small>Enterprise 22</small>
          <h1>مركز المعرفة المؤسسية</h1>
          <p>إدارة آمنة وموحدة لوثائق الجمعية وإصداراتها.</p>
        </div>
        {can('documents.create') && (
          <button onClick={() => setUploadOpen(true)}>+ رفع مستند</button>
        )}
      </div>

      <div className="metrics-grid">
        <MetricCard label="إجمالي المستندات" value={dashboard?.total ?? 0} tone="metric-primary" />
        <MetricCard label="المستندات النشطة" value={dashboard?.active ?? 0} tone="metric-success" />
        <MetricCard label="قيد المراجعة" value={dashboard?.underReview ?? 0} tone="metric-review" />
        <MetricCard label="تنتهي قريبًا" value={dashboard?.expiring ?? 0} tone="metric-warning" />
        <MetricCard
          label="المستندات المؤرشفة"
          value={dashboard?.archived ?? 0}
          tone="metric-muted"
        />
      </div>

      <section className="document-panel">
        <div className="document-toolbar">
          <div className="search-field">
            <span>⌕</span>
            <input
              aria-label="بحث في المستندات"
              placeholder="ابحث بالعنوان أو الرقم أو الإدارة أو الوسم…"
              value={filters.search}
              onChange={(event) => setFilter('search', event.target.value)}
            />
          </div>
          <button className="secondary" onClick={() => setAdvanced((value) => !value)}>
            الفلاتر المتقدمة
          </button>
        </div>
        {advanced && (
          <div className="advanced-filters">
            <label>
              التصنيف
              <select
                value={filters.categoryId}
                onChange={(event) => setFilter('categoryId', event.target.value)}
              >
                <option value="">الكل</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              النوع
              <select
                value={filters.documentType}
                onChange={(event) => setFilter('documentType', event.target.value)}
              >
                <option value="">الكل</option>
                {Object.entries(documentTypes).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الحالة
              <select
                value={filters.status}
                onChange={(event) => setFilter('status', event.target.value)}
              >
                <option value="">الكل</option>
                {Object.entries(statuses).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              الإدارة
              <input
                value={filters.owningDepartment}
                onChange={(event) => setFilter('owningDepartment', event.target.value)}
              />
            </label>
            <label>
              السرية
              <select
                value={filters.confidentialityLevel}
                onChange={(event) => setFilter('confidentialityLevel', event.target.value)}
              >
                <option value="">الكل</option>
                {Object.entries(confidentiality).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              من تاريخ
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilter('dateFrom', event.target.value)}
              />
            </label>
            <label>
              إلى تاريخ
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilter('dateTo', event.target.value)}
              />
            </label>
            <label>
              النطاق
              <select
                value={filters.archived}
                onChange={(event) => setFilter('archived', event.target.value)}
              >
                <option value="false">الحالية</option>
                <option value="true">المؤرشفة</option>
              </select>
            </label>
            <button className="secondary filter-reset" onClick={() => setFilters(emptyFilters)}>
              مسح الفلاتر
            </button>
          </div>
        )}
        <div className="result-summary">
          <strong>{total.toLocaleString('ar-SA')}</strong> مستند
        </div>
        {loading ? (
          <Message>جارٍ تحميل المستندات…</Message>
        ) : error ? (
          <Message error>{error}</Message>
        ) : (
          <div className="table-wrap document-table">
            <table>
              <thead>
                <tr>
                  <th>المستند</th>
                  <th>التصنيف</th>
                  <th>الإدارة</th>
                  <th>الحالة</th>
                  <th>السرية</th>
                  <th>الإصدار</th>
                  <th>آخر تحديث</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <Link to={`/documents/${document.id}`}>
                        <strong>{document.title}</strong>
                      </Link>
                      <small>
                        {document.documentNumber || documentTypes[document.documentType]}
                      </small>
                    </td>
                    <td>{document.category.name}</td>
                    <td>{document.owningDepartment}</td>
                    <td>
                      <span className={`document-status status-${document.status.toLowerCase()}`}>
                        {statuses[document.status]}
                      </span>
                    </td>
                    <td>
                      <ConfidentialityBadge level={document.confidentialityLevel} />
                    </td>
                    <td>v{document.versionNumber.toLocaleString('ar-SA')}</td>
                    <td>{date(document.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {documents.length === 0 && <Message>لا توجد مستندات مطابقة.</Message>}
          </div>
        )}
      </section>

      {dashboard && dashboard.recent.length > 0 && (
        <section className="recent-section">
          <div className="section-heading">
            <h2>أحدث الملفات المرفوعة</h2>
          </div>
          <div className="recent-grid">
            {dashboard.recent.map((document) => (
              <Link className="recent-document" to={`/documents/${document.id}`} key={document.id}>
                <span className="document-icon">▤</span>
                <div>
                  <strong>{document.title}</strong>
                  <small>
                    {document.category.name} · {date(document.createdAt)}
                  </small>
                </div>
                <ConfidentialityBadge level={document.confidentialityLevel} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {uploadOpen && (
        <UploadDocument
          categories={categories}
          onClose={() => setUploadOpen(false)}
          onUploaded={(document) => {
            setUploadOpen(false);
            setDocuments((items) => [document, ...items]);
            setTotal((value) => value + 1);
            void loadSummary();
          }}
        />
      )}
    </section>
  );
}

export function DocumentDetails() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [audit, setAudit] = useState<DocumentAudit[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [nextDocument, nextVersions, nextAudit] = await Promise.all([
      api<DocumentRecord>(`/documents/${id}`),
      api<DocumentVersion[]>(`/documents/${id}/versions`),
      can('documents.audit')
        ? api<{ items: DocumentAudit[] }>(`/documents/${id}/audit`).then((result) => result.items)
        : Promise.resolve([]),
    ]);
    setDocument(nextDocument);
    setVersions(nextVersions);
    setAudit(nextAudit);
  }, [can, id]);

  useEffect(() => {
    void load().catch(() => setError('تعذر تحميل تفاصيل المستند.'));
  }, [load]);

  async function toggleArchive() {
    if (!document) return;
    setBusy(true);
    try {
      setDocument(
        await api<DocumentRecord>(
          `/documents/${id}/${document.isArchived ? 'restore' : 'archive'}`,
          { method: 'POST' },
        ),
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ العملية.');
    } finally {
      setBusy(false);
    }
  }

  async function uploadVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedFile = form.get('file');
    if (!(selectedFile instanceof File) || selectedFile.size === 0) return;
    setBusy(true);
    try {
      await uploadDocumentFile(id, selectedFile, true, String(form.get('notes') ?? '').trim());
      event.currentTarget.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر رفع الإصدار.');
    } finally {
      setBusy(false);
    }
  }

  if (error && !document)
    return (
      <section className="page">
        <Message error>{error}</Message>
      </section>
    );
  if (!document)
    return (
      <section className="page">
        <Message>جارٍ تحميل المستند…</Message>
      </section>
    );

  return (
    <section className="page knowledge-page">
      <div className="breadcrumbs">
        <Link to="/documents">مركز المعرفة</Link>
        <span>/</span>
        <span>{document.title}</span>
      </div>
      <div className="document-detail-heading">
        <div>
          <div className="detail-badges">
            <span className={`document-status status-${document.status.toLowerCase()}`}>
              {statuses[document.status]}
            </span>
            <ConfidentialityBadge level={document.confidentialityLevel} />
          </div>
          <h1>{document.title}</h1>
          <p>{document.description || 'لا يوجد وصف مضاف لهذا المستند.'}</p>
        </div>
        <div className="detail-actions">
          {document.hasFile && can('documents.download') && (
            <button className="secondary" onClick={() => void downloadDocument(document)}>
              تنزيل
            </button>
          )}
          {can('documents.archive') && (
            <button disabled={busy} onClick={() => void toggleArchive()}>
              {document.isArchived ? 'استعادة' : 'أرشفة'}
            </button>
          )}
        </div>
      </div>
      {error && <Message error>{error}</Message>}
      <div className="detail-grid">
        <section className="card document-overview">
          <h2>بيانات المستند</h2>
          <dl>
            <div>
              <dt>التصنيف</dt>
              <dd>{document.category.name}</dd>
            </div>
            <div>
              <dt>النوع</dt>
              <dd>{documentTypes[document.documentType]}</dd>
            </div>
            <div>
              <dt>الرقم</dt>
              <dd>{document.documentNumber || '—'}</dd>
            </div>
            <div>
              <dt>الإدارة المالكة</dt>
              <dd>{document.owningDepartment}</dd>
            </div>
            <div>
              <dt>تاريخ المستند</dt>
              <dd>{date(document.documentDate)}</dd>
            </div>
            <div>
              <dt>السريان</dt>
              <dd>{date(document.effectiveDate)}</dd>
            </div>
            <div>
              <dt>الانتهاء</dt>
              <dd>{date(document.expiryDate)}</dd>
            </div>
            <div>
              <dt>حجم الملف</dt>
              <dd>{fileSize(document.fileSize)}</dd>
            </div>
            <div>
              <dt>أنشأه</dt>
              <dd>{document.createdBy.fullName}</dd>
            </div>
            <div>
              <dt>آخر تحديث</dt>
              <dd>{date(document.updatedAt)}</dd>
            </div>
          </dl>
          {document.tags.length > 0 && (
            <div className="tag-list">
              {document.tags.map((tag) => (
                <span key={tag.id}>{tag.name}</span>
              ))}
            </div>
          )}
        </section>
        {can('documents.upload') && !document.isArchived && (
          <section className="card new-version">
            <h2>رفع إصدار جديد</h2>
            <p>سيبقى الإصدار السابق محفوظًا في السجل.</p>
            <form onSubmit={uploadVersion}>
              <label>
                الملف
                <input name="file" type="file" required />
              </label>
              <label>
                ملاحظات الإصدار
                <input name="notes" maxLength={500} />
              </label>
              <button disabled={busy}>{busy ? 'جارٍ الرفع…' : 'رفع الإصدار'}</button>
            </form>
          </section>
        )}
      </div>
      <section className="document-panel history-panel">
        <h2>سجل الإصدارات</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الإصدار</th>
                <th>اسم الملف</th>
                <th>النوع والحجم</th>
                <th>رفع بواسطة</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id}>
                  <td>v{version.versionNumber.toLocaleString('ar-SA')}</td>
                  <td>{version.originalFileName}</td>
                  <td>
                    {version.mimeType}
                    <small>{fileSize(version.fileSize)}</small>
                  </td>
                  <td>{version.createdBy.fullName}</td>
                  <td>{date(version.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {versions.length === 0 && <Message>لم يُرفع ملف بعد.</Message>}
        </div>
      </section>
      {can('documents.audit') && (
        <section className="document-panel history-panel">
          <h2>سجل التدقيق</h2>
          <div className="audit-timeline">
            {audit.map((entry) => (
              <article key={entry.id}>
                <span className="audit-dot" />
                <div>
                  <strong>{auditActions[entry.action] ?? entry.action}</strong>
                  <p>{entry.description}</p>
                  <small>
                    {entry.user?.fullName || 'النظام'} ·{' '}
                    {new Date(entry.createdAt).toLocaleString('ar-SA')}
                  </small>
                </div>
              </article>
            ))}
            {audit.length === 0 && <Message>لا توجد عمليات مسجلة.</Message>}
          </div>
        </section>
      )}
    </section>
  );
}
