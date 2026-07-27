import { useState, type FormEvent } from 'react';
import { api } from './api';
import { useAuth } from './auth';
import { Link } from './router';

type Mode = 'QUESTION' | 'BOARD_REPORT' | 'CEO_RECOMMENDATIONS' | 'OFFICIAL_LETTER';
type Source = {
  reference: number;
  documentId: string;
  documentTitle: string;
  versionNumber: number;
  pageNumber?: number;
  section?: string;
  sourceUrl: string;
};
type ExecutiveAiResponse = {
  version: string;
  status: 'ANSWERED' | 'INSUFFICIENT_EVIDENCE';
  answer: string;
  executiveRecommendation: string;
  sources: Source[];
  evidence: { chunkCount: number; documentCount: number; combinedMultipleDocuments: boolean };
  limitations: string[];
};

const modes: Array<{ value: Mode; label: string; permission: string }> = [
  { value: 'QUESTION', label: 'سؤال تنفيذي', permission: 'executive_ai.use' },
  { value: 'BOARD_REPORT', label: 'تقرير مجلس الإدارة', permission: 'executive_ai.reports' },
  {
    value: 'CEO_RECOMMENDATIONS',
    label: 'توصيات الرئيس التنفيذي',
    permission: 'executive_ai.recommendations',
  },
  { value: 'OFFICIAL_LETTER', label: 'خطاب رسمي', permission: 'executive_ai.letters' },
];
const endpoints: Record<Mode, string> = {
  QUESTION: '/executive-ai/ask',
  BOARD_REPORT: '/executive-ai/board-report',
  CEO_RECOMMENDATIONS: '/executive-ai/recommendations',
  OFFICIAL_LETTER: '/executive-ai/official-letter',
};
const suggestions = [
  'ما رؤية الجمعية؟',
  'ما رسالة الجمعية؟',
  'كم عدد المستفيدين؟',
  'ما الأهداف الاستراتيجية؟',
  'ما المخاطر التي تهدد الخطة التشغيلية؟',
];

export function ExecutiveAiAssistant() {
  const { can } = useAuth();
  const availableModes = modes.filter((item) => can(item.permission));
  const [mode, setMode] = useState<Mode>(availableModes[0]?.value ?? 'QUESTION');
  const [question, setQuestion] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [response, setResponse] = useState<ExecutiveAiResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResponse(null);
    try {
      setResponse(
        await api<ExecutiveAiResponse>(endpoints[mode], {
          method: 'POST',
          body: JSON.stringify({
            question:
              question.trim() ||
              (mode === 'BOARD_REPORT'
                ? 'إعداد تقرير مجلس الإدارة من المعرفة المؤسسية'
                : 'إعداد توصيات تنفيذية للرئيس التنفيذي'),
            ...(mode === 'OFFICIAL_LETTER' ? { recipient, subject } : {}),
          }),
        }),
      );
    } catch {
      setError('تعذر إكمال الاستدلال التنفيذي. تحقق من الصياغة والصلاحية ثم حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page executive-ai">
      <div className="executive-ai-hero">
        <div>
          <span>Enterprise 26</span>
          <h1>المساعد التنفيذي الذكي</h1>
          <p>طبقة استدلال عربية فوق المعرفة المؤسسية، لا تُصدر إجابة أو توصية بلا مرجع.</p>
        </div>
        <div className="evidence-seal">الأدلة أولًا</div>
      </div>

      <div className="executive-ai-layout">
        <form className="card executive-ai-form" onSubmit={(event) => void submit(event)}>
          <div className="mode-tabs" role="tablist" aria-label="نوع المهمة التنفيذية">
            {availableModes.map((item) => (
              <button
                key={item.value}
                type="button"
                className={mode === item.value ? 'active' : 'secondary'}
                onClick={() => setMode(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label htmlFor="executive-question">السؤال أو المهمة</label>
          <textarea
            id="executive-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={mode === 'BOARD_REPORT' || mode === 'CEO_RECOMMENDATIONS' ? undefined : 2}
            maxLength={1200}
            rows={5}
            placeholder="اكتب سؤالًا تنفيذيًا يستند إلى وثائق الجمعية…"
            required={mode === 'QUESTION' || mode === 'OFFICIAL_LETTER'}
          />
          {mode === 'OFFICIAL_LETTER' && (
            <div className="letter-fields">
              <label>
                الجهة المرسل إليها
                <input
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  maxLength={160}
                  required
                />
              </label>
              <label>
                موضوع الخطاب
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={240}
                  required
                />
              </label>
            </div>
          )}
          {mode === 'QUESTION' && (
            <div className="executive-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  type="button"
                  className="secondary"
                  key={suggestion}
                  onClick={() => setQuestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <button disabled={busy}>{busy ? 'جارٍ ترتيب الأدلة…' : 'إنشاء إجابة موثقة'}</button>
          <small>
            لا تُرسل هذه النسخة البيانات إلى خدمة ذكاء اصطناعي خارجية. الصياغة محلية ومقيدة بالمقاطع
            المصرح بها.
          </small>
        </form>

        <aside className="card executive-ai-policy">
          <h2>ضوابط الإجابة</h2>
          <ul>
            <li>كل معلومة مرتبطة بمرجع قابل للفتح.</li>
            <li>تُدمج عدة وثائق عندما تدعم الأدلة ذلك.</li>
            <li>تُحترم سرية المستند وصلاحيات المستخدم.</li>
            <li>عند غياب الدليل لا تُنشأ إجابة.</li>
          </ul>
        </aside>
      </div>

      {error && <div className="status error">{error}</div>}
      {busy && <div className="status">جارٍ استرجاع الأدلة وترتيبها وصياغة النتيجة…</div>}
      {response && (
        <section className="card executive-ai-response">
          <div className="section-heading">
            <div>
              <small>محرك الاستدلال {response.version}</small>
              <h2>
                {response.status === 'ANSWERED' ? 'النتيجة التنفيذية الموثقة' : 'الأدلة غير كافية'}
              </h2>
            </div>
            <div className="evidence-stats">
              <span>{response.evidence.documentCount} مستند</span>
              <span>{response.evidence.chunkCount} مرجع</span>
            </div>
          </div>
          <pre className="executive-answer">{response.answer}</pre>
          {response.executiveRecommendation && (
            <div className="executive-recommendation">
              <h3>التوصية التنفيذية</h3>
              <p>{response.executiveRecommendation}</p>
            </div>
          )}
          {response.sources.length > 0 && (
            <div className="executive-sources">
              <h3>المراجع الداعمة</h3>
              <ol>
                {response.sources.map((source) => (
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
            </div>
          )}
          <ul className="knowledge-limitations">
            {response.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
