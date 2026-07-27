import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import { Link } from './router';

type KnowledgeSummary = {
  indexedDocuments: number;
  queuedDocuments: number;
  failedDocuments: number;
  chunkCount: number;
  relationCount: number;
};

type SearchResult = {
  documentId: string;
  documentTitle: string;
  documentType: string;
  owningDepartment: string;
  versionNumber: number;
  pageNumber?: number;
  section?: string;
  excerpt: string;
  score: number;
  sourceUrl: string;
};

type KnowledgeAnswer = {
  status: 'ANSWERED' | 'INSUFFICIENT_EVIDENCE';
  answer: string;
  sources: Array<SearchResult & { reference: number }>;
  limitations: string[];
};

const emptySummary: KnowledgeSummary = {
  indexedDocuments: 0,
  queuedDocuments: 0,
  failedDocuments: 0,
  chunkCount: 0,
  relationCount: 0,
};

export function KnowledgeIntelligence() {
  const { can } = useAuth();
  const [summary, setSummary] = useState(emptySummary);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [rebuilding, setRebuilding] = useState(false);

  const loadSummary = async () => {
    setSummary(await api<KnowledgeSummary>('/knowledge/summary'));
  };

  useEffect(() => {
    loadSummary()
      .catch(() => setError('تعذر تحميل ملخص المعرفة المؤسسية.'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: FormEvent, mode: 'search' | 'answer') => {
    event.preventDefault();
    setSearching(true);
    setError('');
    setResults([]);
    setAnswer(null);
    try {
      if (mode === 'search') {
        const response = await api<{ items: SearchResult[] }>('/knowledge/search', {
          method: 'POST',
          body: JSON.stringify({ query, limit: 10 }),
        });
        setResults(response.items);
      } else {
        setAnswer(
          await api<KnowledgeAnswer>('/knowledge/answer', {
            method: 'POST',
            body: JSON.stringify({ query }),
          }),
        );
      }
    } catch {
      setError('تعذر تنفيذ الاستعلام. تحقق من الصياغة وحاول مرة أخرى.');
    } finally {
      setSearching(false);
    }
  };

  const rebuild = async () => {
    setRebuilding(true);
    setError('');
    try {
      await api('/knowledge/index/rebuild', { method: 'POST' });
      await loadSummary();
    } catch {
      setError('تعذر إعادة بناء الفهرس المؤسسي.');
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <section className="page knowledge-intelligence">
      <div className="knowledge-ai-hero">
        <div>
          <span className="eyebrow">Enterprise 25</span>
          <h1>الذكاء المعرفي المؤسسي</h1>
          <p>بحث موحد وإجابات استخراجية من وثائق الجمعية، مع مرجع واضح لكل معلومة.</p>
        </div>
        {can('knowledge.index') && (
          <button className="secondary" disabled={rebuilding} onClick={() => void rebuild()}>
            {rebuilding ? 'جارٍ الفهرسة…' : 'فهرسة جميع المستندات'}
          </button>
        )}
      </div>

      {error && <div className="status error">{error}</div>}
      {loading ? (
        <div className="status">جارٍ تحميل طبقة المعرفة…</div>
      ) : (
        <div className="knowledge-summary-grid" aria-label="ملخص الفهرس المؤسسي">
          <article>
            <strong>{summary.indexedDocuments}</strong>
            <span>مستند مفهرس</span>
          </article>
          <article>
            <strong>{summary.chunkCount}</strong>
            <span>مقطع معرفي</span>
          </article>
          <article>
            <strong>{summary.relationCount}</strong>
            <span>علاقة بين المستندات</span>
          </article>
          <article>
            <strong>{summary.queuedDocuments}</strong>
            <span>بانتظار الفهرسة</span>
          </article>
          <article className={summary.failedDocuments ? 'warning' : ''}>
            <strong>{summary.failedDocuments}</strong>
            <span>فشل فهرسة</span>
          </article>
        </div>
      )}

      <form className="knowledge-query-card" onSubmit={(event) => void submit(event, 'search')}>
        <label htmlFor="institutional-query">ابحث أو اسأل في المعرفة المؤسسية</label>
        <div>
          <input
            id="institutional-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            minLength={2}
            maxLength={600}
            placeholder="مثال: ما السياسات المرتبطة بالخطة التشغيلية؟"
            required
          />
          <button disabled={searching}>بحث دلالي</button>
          {can('knowledge.ask') && (
            <button
              type="button"
              className="gold"
              disabled={searching || query.trim().length < 2}
              onClick={(event) => void submit(event as never, 'answer')}
            >
              إجابة موثقة
            </button>
          )}
        </div>
        <small>
          المساعد التنفيذي — طبقة المعرفة المؤسسية. لا يولّد حقائق خارج الأدلة المفهرسة.
        </small>
      </form>

      {searching && <div className="status">جارٍ مطابقة السؤال مع المستندات المصرح بها…</div>}

      {answer && (
        <section className="knowledge-answer card">
          <div className="section-heading">
            <h2>الإجابة الموثقة</h2>
            <span className={`status-badge ${answer.status.toLowerCase()}`}>
              {answer.status === 'ANSWERED' ? 'مدعومة بالمصادر' : 'أدلة غير كافية'}
            </span>
          </div>
          <p className="answer-body">{answer.answer}</p>
          {answer.sources.length > 0 && (
            <ol className="knowledge-sources">
              {answer.sources.map((source) => (
                <li key={`${source.reference}-${source.documentId}-${source.pageNumber ?? 0}`}>
                  <Link to={source.sourceUrl}>
                    [{source.reference}] {source.documentTitle}
                  </Link>
                  <span>
                    الإصدار {source.versionNumber}
                    {source.pageNumber ? ` — الصفحة ${source.pageNumber}` : ''}
                    {source.section ? ` — ${source.section}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <ul className="knowledge-limitations">
            {answer.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}

      {results.length > 0 && (
        <section className="knowledge-results">
          <h2>نتائج البحث</h2>
          {results.map((result, index) => (
            <article className="card" key={`${result.documentId}-${result.pageNumber ?? index}`}>
              <div>
                <Link to={result.sourceUrl}>{result.documentTitle}</Link>
                <span>{Math.round(result.score * 100)}% مطابقة</span>
              </div>
              <p>{result.excerpt}</p>
              <small>
                {result.owningDepartment} — الإصدار {result.versionNumber}
                {result.pageNumber ? ` — الصفحة ${result.pageNumber}` : ''}
              </small>
            </article>
          ))}
        </section>
      )}

      {!searching && query && results.length === 0 && !answer && !error && (
        <div className="status">لا توجد نتائج تتجاوز حد المطابقة المعتمد.</div>
      )}
    </section>
  );
}
