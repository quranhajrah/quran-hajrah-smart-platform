import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { ApiRequestError } from './api';
import { useAuth } from './auth';
import { Link, NavLink, useNavigate } from './router';
import {
  answerFromInstitutionalKnowledge,
  executiveWritingDefinitions,
  generateSmartBarWriting,
  loadExecutiveAiCapabilities,
  runStructuredExecutiveQuery,
  searchInstitutionalKnowledge,
  structuredRecords,
  type ExecutiveAiCapabilities,
  type ExecutiveStructuredQueryResult,
  type ExecutiveWritingDefinition,
  type KnowledgeAnswer,
  type KnowledgeSearchItem,
} from './executive-smartbar-data';
import type { ExecutiveAiWritingResponse } from './executive-insights-data';
import { WritingResult } from './ExecutiveWritingResult';
import './executive-foundation.css';
import './executive-sprint1c.css';

type NavigationItem = {
  to: string;
  label: string;
  description: string;
  permission?: string;
  keywords: string[];
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

const executiveNavigationGroups: NavigationGroup[] = [
  {
    label: 'القيادة',
    items: [
      {
        to: '/',
        label: 'الرئيسية التنفيذية',
        description: 'المشهد التنفيذي الموحد',
        permission: 'dashboard.view',
        keywords: ['الرئيسية', 'قيادة', 'لوحة'],
      },
      {
        to: '/executive/command-center',
        label: 'مركز القيادة التنفيذي',
        description: 'الاستثناءات والأولويات الحرجة',
        permission: 'dashboard.view',
        keywords: ['قيادة', 'استثناءات', 'مخاطر', 'أولويات', 'تنبيهات'],
      },
      {
        to: '/executive/today',
        label: 'اليوم في الجمعية',
        description: 'الموجز التنفيذي اليومي',
        permission: 'dashboard.view',
        keywords: ['اليوم', 'موجز', 'متابعة', 'استحقاقات'],
      },
      {
        to: '/executive/leadership',
        label: 'لوحة القيادة القيادية',
        description: 'الصحة والتقدم والأثر والتقارير',
        permission: 'dashboard.view',
        keywords: ['قيادة', 'رئيس تنفيذي', 'أهداف', 'أثر', 'تقارير'],
      },
      {
        to: '/executive/health',
        label: 'الصحة المؤسسية',
        description: 'تفاصيل التقييم والتغطية',
        permission: 'dashboard.view',
        keywords: ['صحة', 'تقييم', 'تغطية'],
      },
      {
        to: '/executive/metrics',
        label: 'المؤشرات المؤسسية',
        description: 'القياسات المعتمدة',
        permission: 'metrics.view',
        keywords: ['مؤشرات', 'مقاييس', 'أثر'],
      },
    ],
  },
  {
    label: 'الاستراتيجية والأداء',
    items: [
      {
        to: '/executive/objectives',
        label: 'الأهداف الاستراتيجية',
        description: 'تقدم الأهداف',
        permission: 'strategy.view',
        keywords: ['أهداف', 'استراتيجية'],
      },
      {
        to: '/executive/kpis',
        label: 'مؤشرات الأداء',
        description: 'متابعة الأداء التنفيذي',
        permission: 'kpi.view',
        keywords: ['أداء', 'مؤشرات'],
      },
      {
        to: '/executive/initiatives',
        label: 'المبادرات',
        description: 'المبادرات ومواعيدها',
        permission: 'initiatives.view',
        keywords: ['مشاريع', 'مبادرات', 'مواعيد'],
      },
      {
        to: '/executive/risks',
        label: 'المخاطر',
        description: 'المخاطر وخطط المعالجة',
        permission: 'risks.view',
        keywords: ['مخاطر', 'معالجة'],
      },
      {
        to: '/executive/alerts',
        label: 'التنبيهات',
        description: 'الأولويات التي تتطلب انتباهًا',
        permission: 'alerts.view',
        keywords: ['تنبيه', 'أولوية'],
      },
      {
        to: '/executive/reports',
        label: 'التقارير التنفيذية',
        description: 'التقارير الرسمية',
        permission: 'reports.view',
        keywords: ['تقارير', 'تنفيذي'],
      },
    ],
  },
  {
    label: 'المعرفة والذكاء',
    items: [
      {
        to: '/documents',
        label: 'الملفات والمعرفة',
        description: 'الوثائق المؤسسية',
        permission: 'documents.view',
        keywords: ['مستندات', 'وثائق', 'ملفات'],
      },
      {
        to: '/knowledge-intelligence',
        label: 'الذكاء المعرفي',
        description: 'البحث في المعرفة المعتمدة',
        permission: 'knowledge.search',
        keywords: ['بحث', 'معرفة', 'مراجع'],
      },
      {
        to: '/executive-assistant',
        label: 'المساعد التنفيذي',
        description: 'الكتابة التنفيذية المهنية',
        permission: 'executive_ai.use',
        keywords: ['مساعد', 'كتابة', 'مذكرة', 'قرار'],
      },
      {
        to: '/document-analysis',
        label: 'تحليل المستندات',
        description: 'مراجعة نتائج الاستخراج',
        permission: 'document_analysis.view',
        keywords: ['تحليل', 'استخراج', 'مراجعة'],
      },
    ],
  },
  {
    label: 'الإدارة',
    items: [
      {
        to: '/account',
        label: 'حسابي',
        description: 'الملف الشخصي',
        keywords: ['حساب', 'شخصي'],
      },
      {
        to: '/users',
        label: 'المستخدمون',
        description: 'إدارة المستخدمين',
        permission: 'users.view',
        keywords: ['مستخدمون'],
      },
      {
        to: '/roles',
        label: 'الأدوار والصلاحيات',
        description: 'إدارة الوصول',
        permission: 'roles.view',
        keywords: ['أدوار', 'صلاحيات'],
      },
      {
        to: '/audit',
        label: 'سجل العمليات',
        description: 'التدقيق المؤسسي',
        permission: 'audit.view',
        keywords: ['سجل', 'تدقيق', 'عمليات'],
      },
    ],
  },
];

const navigationItems = executiveNavigationGroups.flatMap((group) => group.items);

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission?: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useAuth();
  return !permission || can(permission) ? children : fallback;
}

function allowed(item: NavigationItem, can: (permission: string) => boolean) {
  return !item.permission || can(item.permission);
}

export function ExecutiveSidebar({ open, onClose }: { open: boolean; onClose(): void }) {
  const { can, logout } = useAuth();

  return (
    <>
      {open && (
        <button
          className="ex-sidebar-backdrop"
          type="button"
          aria-label="إغلاق قائمة التنقل"
          onClick={onClose}
        />
      )}
      <aside className={`ex-sidebar ${open ? 'is-open' : ''}`}>
        <div className="ex-brand">
          <span aria-hidden="true">ق</span>
          <div>
            <strong>قرآن الهجرة</strong>
            <small>المنصة التنفيذية الذكية</small>
          </div>
          <button type="button" className="ex-icon-button ex-sidebar-close" onClick={onClose}>
            <span aria-hidden="true">×</span>
            <span className="sr-only">إغلاق القائمة</span>
          </button>
        </div>

        <nav className="ex-sidebar-nav" aria-label="التنقل الرئيسي">
          {executiveNavigationGroups.map((group) => {
            const items = group.items.filter((item) => allowed(item, can));
            if (items.length === 0) return null;
            return (
              <section key={group.label}>
                <h2>{group.label}</h2>
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={onClose}>
                    <span>{item.label}</span>
                    <small aria-hidden="true">{item.description}</small>
                  </NavLink>
                ))}
              </section>
            );
          })}
        </nav>

        <button className="ex-signout" type="button" onClick={() => void logout()}>
          تسجيل الخروج
        </button>
      </aside>
    </>
  );
}

export function ExecutiveHeader({
  onOpenSidebar,
  onOpenSmartBar,
  smartBarAvailable,
}: {
  onOpenSidebar(): void;
  onOpenSmartBar(): void;
  smartBarAvailable: boolean;
}) {
  const { user, logout } = useAuth();
  const date = new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="ex-header">
      <button
        className="ex-icon-button ex-menu-button"
        type="button"
        onClick={onOpenSidebar}
        aria-label="فتح قائمة التنقل"
      >
        <span aria-hidden="true">☰</span>
      </button>
      <div className="ex-header-intro">
        <small>{date}</small>
        <strong>مرحبًا، {user?.fullName}</strong>
      </div>
      {smartBarAvailable && (
        <button
          className="ex-smart-trigger"
          type="button"
          onClick={onOpenSmartBar}
          aria-label="فتح الشريط التنفيذي الذكي"
        >
          <span aria-hidden="true">⌕</span>
          <span>تنقل، استعلم، وابحث أو اكتب</span>
          <kbd>⌘ / Ctrl + K</kbd>
        </button>
      )}
      <button className="ex-header-signout" type="button" onClick={() => void logout()}>
        تسجيل الخروج
      </button>
    </header>
  );
}

type SmartBarMode = 'navigation' | 'structured' | 'knowledge' | 'writing';

const smartBarModeDefinitions: Array<{
  key: SmartBarMode;
  label: string;
  permission?: string;
}> = [
  { key: 'navigation', label: 'التنقل' },
  { key: 'structured', label: 'استعلام مؤسسي', permission: 'executive.query' },
  { key: 'knowledge', label: 'المعرفة والأدلة' },
  { key: 'writing', label: 'الكتابة التنفيذية', permission: 'executive_ai.use' },
];

const smartBarError = (error: unknown, fallback: string) =>
  error instanceof ApiRequestError && error.message ? error.message : fallback;

const structuredFactLabels: Record<string, string> = {
  total: 'الإجمالي',
  active: 'نشط',
  underReview: 'قيد المراجعة',
  expiring: 'قريب الانتهاء',
  archived: 'مؤرشف',
  open: 'مفتوح',
  critical: 'حرج',
  delayed: 'متأخر',
  atRisk: 'معرض للخطر',
  completed: 'مكتمل',
  plannedBudget: 'الموازنة المخططة للمبادرات',
  actualSpending: 'الإنفاق الفعلي للمبادرات',
  coverage: 'التغطية',
  score: 'الدرجة',
  rating: 'التقييم',
  averageProgress: 'متوسط التقدم',
  averageResidualScore: 'متوسط الدرجة المتبقية',
};

const collectStructuredFacts = (
  value: unknown,
  facts: Array<{ label: string; value: string }>,
  depth = 0,
  parent = '',
) => {
  if (facts.length >= 14 || depth > 3 || !value || typeof value !== 'object') return facts;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (facts.length >= 14) break;
    const label = structuredFactLabels[key] ?? (parent ? `${parent} — ${key}` : key);
    if (typeof item === 'number' || typeof item === 'string') {
      facts.push({ label, value: typeof item === 'number' ? item.toLocaleString('ar-SA') : item });
    } else if (item && typeof item === 'object' && !Array.isArray(item)) {
      collectStructuredFacts(item, facts, depth + 1, structuredFactLabels[key] ?? label);
    }
  }
  return facts;
};

export function SmartBarModeSelector({
  modes,
  value,
  onChange,
}: {
  modes: Array<{ key: SmartBarMode; label: string }>;
  value: SmartBarMode;
  onChange(mode: SmartBarMode): void;
}) {
  return (
    <div className="ex-smartbar-modes" role="tablist" aria-label="أوضاع الشريط التنفيذي">
      {modes.map((mode) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === mode.key}
          className={value === mode.key ? 'is-active' : ''}
          onClick={() => onChange(mode.key)}
          key={mode.key}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

export function StructuredQueryResult({
  result,
  receivedAt,
  can,
}: {
  result: ExecutiveStructuredQueryResult;
  receivedAt: string;
  can(permission: string): boolean;
}) {
  const records = structuredRecords(result.data);
  const facts = records.length === 0 ? collectStructuredFacts(result.data, []) : [];
  return (
    <section className="ex-smart-result" aria-live="polite">
      <header>
        <div>
          <small>إجابة منظمة من السجلات الحالية</small>
          <h3>{result.title}</h3>
        </div>
        <FreshnessBadge timestamp={receivedAt} />
      </header>
      <p>{result.summary}</p>
      {records.length > 0 && (
        <div className="ex-smart-records" role="list">
          {records.slice(0, 10).map((record) => {
            const source = result.sources.find((item) => item.recordId === record.id);
            const label = String(
              record.title ??
                record.name ??
                record.nameAr ??
                record.code ??
                source?.label ??
                record.id,
            );
            const content = (
              <>
                <strong>{label}</strong>
                <span>
                  {record.status ? String(record.status).replaceAll('_', ' ') : 'سجل مؤسسي'}
                </span>
              </>
            );
            return source?.route ? (
              <Link
                role="listitem"
                to={`${source.route}/${record.id}`}
                key={record.id}
                onClick={(event) => event.stopPropagation()}
              >
                {content}
              </Link>
            ) : (
              <article role="listitem" key={record.id}>
                {content}
              </article>
            );
          })}
        </div>
      )}
      {facts.length > 0 && (
        <dl className="ex-smart-facts">
          {facts.map((fact) => (
            <div key={`${fact.label}-${fact.value}`}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="ex-smart-result-sources">
        <h4>المصادر</h4>
        <ul>
          {result.sources.map((source) => (
            <li key={`${source.module}-${source.recordId ?? source.label}`}>
              {source.route ? <Link to={source.route}>{source.label}</Link> : source.label}
              <span>{source.module}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="ex-smart-limitations">
        <h4>التغطية والحدود</h4>
        {result.missingData.length === 0 ? (
          <p>لا تسجل الاستجابة مكونات مفقودة ضمن نطاق السؤال المدعوم.</p>
        ) : (
          <ul>
            {result.missingData.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <small>وقت الاستعلام: {new Date(receivedAt).toLocaleString('ar-SA')}</small>
      </div>
      <nav className="ex-smart-actions" aria-label="الإجراءات المقترحة المحكومة">
        {result.suggestedActions
          .filter((action) => !action.permission || can(action.permission))
          .map((action) => (
            <Link to={action.route} key={`${action.route}-${action.label}`}>
              {action.label}
            </Link>
          ))}
      </nav>
    </section>
  );
}

export function KnowledgeAnswerResult({
  answer,
  searchItems,
}: {
  answer: KnowledgeAnswer | null;
  searchItems: KnowledgeSearchItem[];
}) {
  if (!answer && searchItems.length === 0) return null;
  const sources = answer?.sources ?? searchItems;
  return (
    <section className="ex-smart-result ex-knowledge-result" aria-live="polite">
      {answer && (
        <>
          <header>
            <div>
              <small>Enterprise 25 — إجابة مستندة إلى الأدلة</small>
              <h3>{answer.status === 'ANSWERED' ? 'الإجابة المعرفية' : 'الأدلة غير كافية'}</h3>
            </div>
            <span>{answer.sources.length.toLocaleString('ar-SA')} مصدر</span>
          </header>
          <p className="ex-knowledge-answer-prose">{answer.answer}</p>
        </>
      )}
      <div className="ex-knowledge-evidence">
        <h4>{answer ? 'الأدلة والاقتباسات المنفصلة' : 'نتائج البحث في الأدلة'}</h4>
        {sources.map((source) => (
          <article key={`${source.documentVersionId}-${source.pageNumber ?? 0}`}>
            <header>
              <Link to={source.sourceUrl}>{source.documentTitle}</Link>
              <span>الصلة {(source.score * 100).toFixed(0)}٪</span>
            </header>
            <blockquote>{source.excerpt}</blockquote>
            <footer>
              الإصدار {source.versionNumber}
              {source.pageNumber ? ` · الصفحة ${source.pageNumber}` : ''}
              {source.section ? ` · ${source.section}` : ''}
              {source.owningDepartment ? ` · ${source.owningDepartment}` : ''}
            </footer>
          </article>
        ))}
      </div>
      {answer && (
        <div className="ex-smart-limitations">
          <h4>التغطية والحدود</h4>
          {answer.limitations.length === 0 ? (
            <p>لم تسجل الخدمة حدودًا إضافية لهذه الإجابة.</p>
          ) : (
            <ul>
              {answer.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function ExecutiveWritingForm({
  definitions,
}: {
  definitions: ExecutiveWritingDefinition[];
}) {
  const requestRef = useRef<AbortController | null>(null);
  const [capability, setCapability] = useState(definitions[0]?.capability ?? 'QUESTION');
  const [question, setQuestion] = useState('');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [result, setResult] = useState<ExecutiveAiWritingResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const definition =
    definitions.find((item) => item.capability === capability) ?? definitions[0] ?? null;

  useEffect(() => {
    if (!definitions.some((item) => item.capability === capability) && definitions[0]) {
      setCapability(definitions[0].capability);
    }
  }, [capability, definitions]);

  useEffect(
    () => () => {
      requestRef.current?.abort();
      requestRef.current = null;
    },
    [],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!definition) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    try {
      setResult(
        await generateSmartBarWriting(
          definition,
          {
            question: question.trim(),
            recipient: recipient.trim(),
            subject: subject.trim(),
          },
          controller.signal,
        ),
      );
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(
        smartBarError(failure, 'تعذر إنشاء الصياغة. بقيت جميع المدخلات محفوظة لإعادة المحاولة.'),
      );
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (!controller.signal.aborted) setBusy(false);
      }
    }
  };

  if (!definition) {
    return (
      <ExecutiveEmptyState
        title="لا توجد صيغة كتابة متاحة"
        description="لا تتضمن صلاحياتك الحالية أي صيغة أعادتها واجهة القدرات."
        compact
      />
    );
  }

  return (
    <div className="ex-smart-writing">
      <form onSubmit={(event) => void submit(event)}>
        <label>
          <span>نمط وصيغة الكتابة المهنية</span>
          <select
            value={definition.capability}
            onChange={(event) => setCapability(event.target.value as typeof capability)}
          >
            {definitions.map((item) => (
              <option value={item.capability} key={item.capability}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {definition.needsRecipient && (
          <div className="ex-smart-writing-context">
            <label>
              <span>الجهة أو المستلم</span>
              <input
                value={recipient}
                onChange={(event) => setRecipient(event.target.value)}
                minLength={2}
                maxLength={160}
                required
              />
            </label>
            <label>
              <span>موضوع الخطاب</span>
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                minLength={2}
                maxLength={240}
                required
              />
            </label>
          </div>
        )}
        <label>
          <span>الموضوع والسياق التنفيذي</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={2}
            maxLength={1200}
            rows={4}
            required
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'جارٍ فهم المراجع وإعادة الصياغة…' : `إنشاء ${definition.label}`}
        </button>
        <small>الإنشاء صريح عند الطلب، ولا تُدمج الاقتباسات داخل الصياغة المهنية.</small>
      </form>
      {error && (
        <div className="ex-smartbar-error" role="alert">
          {error}
        </div>
      )}
      {result && <WritingResult result={result} allowFullCopy />}
    </div>
  );
}

export function ExecutiveSmartBar({ open, onClose }: { open: boolean; onClose(): void }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLElement>(null);
  const navigationInputRef = useRef<HTMLInputElement>(null);
  const modeInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const structuredRequestRef = useRef<AbortController | null>(null);
  const knowledgeRequestRef = useRef<AbortController | null>(null);
  const capabilityRequestRef = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<SmartBarMode>('navigation');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [structuredInput, setStructuredInput] = useState('');
  const [structuredResult, setStructuredResult] = useState<ExecutiveStructuredQueryResult | null>(
    null,
  );
  const [structuredReceivedAt, setStructuredReceivedAt] = useState('');
  const [structuredError, setStructuredError] = useState('');
  const [structuredBusy, setStructuredBusy] = useState(false);
  const [knowledgeInput, setKnowledgeInput] = useState('');
  const [knowledgeAction, setKnowledgeAction] = useState<'search' | 'answer'>(
    can('knowledge.ask') ? 'answer' : 'search',
  );
  const [knowledgeSearchItems, setKnowledgeSearchItems] = useState<KnowledgeSearchItem[]>([]);
  const [knowledgeAnswer, setKnowledgeAnswer] = useState<KnowledgeAnswer | null>(null);
  const [knowledgeError, setKnowledgeError] = useState('');
  const [knowledgeBusy, setKnowledgeBusy] = useState(false);
  const [capabilities, setCapabilities] = useState<ExecutiveAiCapabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState('');
  const [capabilityBusy, setCapabilityBusy] = useState(false);

  const availableModes = useMemo(
    () =>
      smartBarModeDefinitions.filter((candidate) => {
        if (candidate.key === 'navigation') {
          return navigationItems.some((item) => item.permission && can(item.permission));
        }
        if (candidate.key === 'knowledge') {
          return can('knowledge.search') || can('knowledge.ask');
        }
        return !candidate.permission || can(candidate.permission);
      }),
    [can],
  );

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ar');
    return navigationItems
      .filter((item) => allowed(item, can))
      .filter((item) => {
        if (!normalized) return true;
        return [item.label, item.description, ...item.keywords].some((value) =>
          value.toLocaleLowerCase('ar').includes(normalized),
        );
      })
      .slice(0, 10);
  }, [can, query]);

  const writingDefinitions = useMemo(
    () =>
      executiveWritingDefinitions.filter(
        (definition) =>
          capabilities?.modes.includes(definition.capability) && can(definition.permission),
      ),
    [can, capabilities],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        if (open) onClose();
        else window.dispatchEvent(new CustomEvent('executive-smartbar-open'));
      }
      if (event.key === 'Escape' && open) onClose();
      if (event.key === 'Tab' && open) {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = [
          ...dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((element) => !element.hasAttribute('hidden'));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) {
          event.preventDefault();
          dialog.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      structuredRequestRef.current?.abort();
      knowledgeRequestRef.current?.abort();
      capabilityRequestRef.current?.abort();
      structuredRequestRef.current = null;
      knowledgeRequestRef.current = null;
      capabilityRequestRef.current = null;
      setMode('navigation');
      setQuery('');
      setActiveIndex(0);
      setStructuredInput('');
      setStructuredResult(null);
      setStructuredReceivedAt('');
      setStructuredError('');
      setStructuredBusy(false);
      setKnowledgeInput('');
      setKnowledgeSearchItems([]);
      setKnowledgeAnswer(null);
      setKnowledgeError('');
      setKnowledgeBusy(false);
      setCapabilities(null);
      setCapabilityError('');
      setCapabilityBusy(false);
      return;
    }
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timer = window.setTimeout(() => navigationInputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(timer);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!availableModes.some((candidate) => candidate.key === mode)) {
      setMode(availableModes[0]?.key ?? 'navigation');
    }
  }, [availableModes, mode]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (mode === 'navigation') navigationInputRef.current?.focus();
      else modeInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [mode, open]);

  useEffect(() => {
    if (!open || mode !== 'writing' || capabilities || capabilityError) return;
    const controller = new AbortController();
    capabilityRequestRef.current = controller;
    setCapabilityBusy(true);
    void loadExecutiveAiCapabilities(controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) setCapabilities(next);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setCapabilityError(
            smartBarError(error, 'تعذر تحميل صيغ الكتابة المتاحة. أعد المحاولة لاحقًا.'),
          );
        }
      })
      .finally(() => {
        if (capabilityRequestRef.current === controller) {
          capabilityRequestRef.current = null;
          if (!controller.signal.aborted) setCapabilityBusy(false);
        }
      });
    return () => controller.abort();
  }, [capabilities, capabilityError, mode, open]);

  if (!open || availableModes.length === 0) return null;

  const choose = (item: NavigationItem) => {
    navigate(item.to);
    onClose();
  };

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, results.length - 1));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  };

  const submitStructured = async (event: FormEvent) => {
    event.preventDefault();
    structuredRequestRef.current?.abort();
    const controller = new AbortController();
    structuredRequestRef.current = controller;
    setStructuredBusy(true);
    setStructuredError('');
    try {
      const next = await runStructuredExecutiveQuery(structuredInput.trim(), controller.signal);
      if (!controller.signal.aborted) {
        setStructuredResult(next);
        setStructuredReceivedAt(new Date().toISOString());
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setStructuredError(
        smartBarError(error, 'تعذر تنفيذ الاستعلام المؤسسي. بقي السؤال محفوظًا لإعادة المحاولة.'),
      );
    } finally {
      if (structuredRequestRef.current === controller) {
        structuredRequestRef.current = null;
        if (!controller.signal.aborted) setStructuredBusy(false);
      }
    }
  };

  const submitKnowledge = async (event: FormEvent) => {
    event.preventDefault();
    knowledgeRequestRef.current?.abort();
    const controller = new AbortController();
    knowledgeRequestRef.current = controller;
    setKnowledgeBusy(true);
    setKnowledgeError('');
    try {
      if (knowledgeAction === 'search') {
        const response = await searchInstitutionalKnowledge(
          knowledgeInput.trim(),
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setKnowledgeSearchItems(response.items);
          setKnowledgeAnswer(null);
        }
      } else {
        const response = await answerFromInstitutionalKnowledge(
          knowledgeInput.trim(),
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setKnowledgeAnswer(response);
          setKnowledgeSearchItems([]);
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setKnowledgeError(
        smartBarError(error, 'تعذر الوصول إلى المعرفة. بقي السؤال محفوظًا لإعادة المحاولة.'),
      );
    } finally {
      if (knowledgeRequestRef.current === controller) {
        knowledgeRequestRef.current = null;
        if (!controller.signal.aborted) setKnowledgeBusy(false);
      }
    }
  };

  return (
    <div className="ex-smartbar-layer" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="ex-smartbar ex-smartbar-expanded"
        role="dialog"
        aria-modal="true"
        aria-labelledby="executive-smartbar-title"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ex-smartbar-heading">
          <div>
            <h2 id="executive-smartbar-title">شريط الانتقال التنفيذي</h2>
            <span className="ex-smartbar-title-badge">ذكي ومحكوم بالصلاحيات</span>
            <p>تنقل واستعلام ومعرفة وكتابة وفق صلاحياتك؛ لا ينفذ أي تغيير مباشر.</p>
          </div>
          <button className="ex-icon-button" type="button" onClick={onClose} aria-label="إغلاق">
            ×
          </button>
        </div>
        <SmartBarModeSelector modes={availableModes} value={mode} onChange={setMode} />
        <div className="ex-smartbar-workspace">
          {mode === 'navigation' && (
            <>
              <label className="ex-smartbar-search">
                <span className="sr-only">ابحث عن صفحة أو أداة</span>
                <input
                  ref={navigationInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="ابحث عن صفحة أو أداة…"
                  aria-controls="executive-smartbar-results"
                  aria-activedescendant={
                    results[activeIndex] ? `executive-smartbar-option-${activeIndex}` : undefined
                  }
                />
                <kbd>Esc</kbd>
              </label>
              <div id="executive-smartbar-results" className="ex-smartbar-results" role="listbox">
                {results.map((item, index) => (
                  <button
                    id={`executive-smartbar-option-${index}`}
                    key={item.to}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={index === activeIndex ? 'is-active' : ''}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(item)}
                  >
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <span aria-hidden="true">←</span>
                  </button>
                ))}
                {results.length === 0 && (
                  <ExecutiveEmptyState
                    title="لا توجد وجهة مطابقة"
                    description="جرّب اسم صفحة أخرى ضمن نطاق صلاحياتك."
                    compact
                  />
                )}
              </div>
            </>
          )}

          {mode === 'structured' && (
            <div className="ex-smartbar-tool">
              <form onSubmit={(event) => void submitStructured(event)}>
                <label>
                  <span>سؤال عن البيانات المؤسسية المنظمة</span>
                  <input
                    ref={modeInputRef}
                    value={structuredInput}
                    onChange={(event) => setStructuredInput(event.target.value)}
                    minLength={3}
                    maxLength={500}
                    required
                    placeholder="مثال: ما المبادرات المتأخرة؟"
                  />
                </label>
                <button type="submit" disabled={structuredBusy}>
                  {structuredBusy ? 'جارٍ الاستعلام…' : 'تنفيذ الاستعلام'}
                </button>
                <small>يدعم النطاقات المنظمة المتاحة فقط، ولا يصل إلى قاعدة البيانات مباشرة.</small>
              </form>
              {structuredError && (
                <div className="ex-smartbar-error" role="alert">
                  {structuredError}
                </div>
              )}
              {structuredResult && structuredReceivedAt && (
                <StructuredQueryResult
                  result={structuredResult}
                  receivedAt={structuredReceivedAt}
                  can={can}
                />
              )}
            </div>
          )}

          {mode === 'knowledge' && (
            <div className="ex-smartbar-tool">
              <div
                className="ex-knowledge-action-selector"
                role="group"
                aria-label="نوع طلب المعرفة"
              >
                {can('knowledge.search') && (
                  <button
                    type="button"
                    aria-pressed={knowledgeAction === 'search'}
                    className={knowledgeAction === 'search' ? 'is-active' : ''}
                    onClick={() => setKnowledgeAction('search')}
                  >
                    بحث في الأدلة
                  </button>
                )}
                {can('knowledge.ask') && (
                  <button
                    type="button"
                    aria-pressed={knowledgeAction === 'answer'}
                    className={knowledgeAction === 'answer' ? 'is-active' : ''}
                    onClick={() => setKnowledgeAction('answer')}
                  >
                    إجابة مستندة إلى الأدلة
                  </button>
                )}
              </div>
              <form onSubmit={(event) => void submitKnowledge(event)}>
                <label>
                  <span>موضوع البحث أو السؤال</span>
                  <input
                    ref={modeInputRef}
                    value={knowledgeInput}
                    onChange={(event) => setKnowledgeInput(event.target.value)}
                    minLength={2}
                    maxLength={600}
                    required
                  />
                </label>
                <button type="submit" disabled={knowledgeBusy}>
                  {knowledgeBusy
                    ? 'جارٍ استرجاع الأدلة…'
                    : knowledgeAction === 'search'
                      ? 'البحث'
                      : 'إنشاء الإجابة'}
                </button>
                <small>لا يبدأ أي بحث تلقائيًا، وتظل الاقتباسات والمصادر منفصلة.</small>
              </form>
              {knowledgeError && (
                <div className="ex-smartbar-error" role="alert">
                  {knowledgeError}
                </div>
              )}
              <KnowledgeAnswerResult answer={knowledgeAnswer} searchItems={knowledgeSearchItems} />
            </div>
          )}

          {mode === 'writing' && (
            <div className="ex-smartbar-tool">
              {capabilityBusy && (
                <div className="ex-card-loading" aria-label="جارٍ تحميل صيغ الكتابة">
                  <span />
                  <span />
                </div>
              )}
              {capabilityError && (
                <div className="ex-smartbar-error" role="alert">
                  {capabilityError}
                </div>
              )}
              {capabilities && (
                <>
                  <div className="ex-writing-capability-note">
                    <strong>Enterprise {capabilities.version}</strong>
                    <span>إعادة صياغة مهنية، والمراجع منفصلة، ولا نسخ مباشر للفقرات.</span>
                  </div>
                  <ExecutiveWritingForm definitions={writingDefinitions} />
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function MobileBottomNavigation() {
  const { can } = useAuth();
  const candidates = [
    navigationItems.find((item) => item.to === '/'),
    navigationItems.find((item) => item.to === '/executive/command-center'),
    navigationItems.find((item) => item.to === '/executive/today'),
    navigationItems.find((item) => item.to === '/executive/leadership'),
    navigationItems.find((item) => item.to === '/executive-assistant'),
  ].filter((item): item is NavigationItem => Boolean(item));
  const items = candidates.filter((item) => allowed(item, can)).slice(0, 5);

  return (
    <nav className="ex-mobile-nav" aria-label="التنقل السريع">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to}>
          <span aria-hidden="true">
            {item.to === '/'
              ? '⌂'
              : item.to === '/executive/command-center'
                ? '◎'
                : item.to === '/executive/today'
                  ? '◷'
                  : item.to === '/executive/leadership'
                    ? '◈'
                    : '✦'}
          </span>
          <small>{item.label.replace('الرئيسية التنفيذية', 'الرئيسية')}</small>
        </NavLink>
      ))}
    </nav>
  );
}

export function ExecutiveLayout({ children }: { children: ReactNode }) {
  const { can } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [smartBarOpen, setSmartBarOpen] = useState(false);
  const smartBarAvailable =
    navigationItems.some((item) => item.permission && can(item.permission)) ||
    can('executive.query') ||
    can('knowledge.search') ||
    can('knowledge.ask') ||
    can('executive_ai.use');
  const closeSmartBar = useCallback(() => setSmartBarOpen(false), []);

  useEffect(() => {
    if (!smartBarAvailable) setSmartBarOpen(false);
  }, [smartBarAvailable]);

  useEffect(() => {
    const openSmartBar = () => {
      if (smartBarAvailable) setSmartBarOpen(true);
    };
    window.addEventListener('executive-smartbar-open', openSmartBar);
    return () => window.removeEventListener('executive-smartbar-open', openSmartBar);
  }, [smartBarAvailable]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        if (smartBarAvailable) setSmartBarOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [smartBarAvailable]);

  return (
    <div className="ex-shell" dir="rtl">
      <ExecutiveSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="ex-main">
        <ExecutiveHeader
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSmartBar={() => setSmartBarOpen(true)}
          smartBarAvailable={smartBarAvailable}
        />
        {smartBarAvailable && (
          <div className="ex-smartbar-dock">
            <button
              type="button"
              onClick={() => setSmartBarOpen(true)}
              aria-label="فتح الشريط التنفيذي الذكي"
            >
              <span aria-hidden="true">⌕</span>
              <span>تنقل، استعلم، وابحث أو اكتب ضمن صلاحياتك</span>
              <kbd>⌘ / Ctrl + K</kbd>
            </button>
          </div>
        )}
        <main className="ex-content">{children}</main>
      </div>
      <MobileBottomNavigation />
      {smartBarAvailable && <ExecutiveSmartBar open={smartBarOpen} onClose={closeSmartBar} />}
    </div>
  );
}

export function ExecutiveShell({ children }: { children: ReactNode }) {
  return <ExecutiveLayout>{children}</ExecutiveLayout>;
}

export function SourceBadge({ label, to }: { label: string; to?: string }) {
  const content = (
    <>
      <span aria-hidden="true">↗</span>
      المصدر: {label}
    </>
  );
  return to ? (
    <Link className="ex-source-badge" to={to}>
      {content}
    </Link>
  ) : (
    <span className="ex-source-badge">{content}</span>
  );
}

export function FreshnessBadge({
  timestamp,
  failed = false,
}: {
  timestamp?: string | null;
  failed?: boolean;
}) {
  if (!timestamp) return <span className="ex-freshness is-unknown">تاريخ التحديث غير متاح</span>;
  const date = new Date(timestamp);
  const stale = Date.now() - date.getTime() > 5 * 60_000;
  const label = failed ? 'تعذر التحديث' : stale ? 'قد تكون البيانات قديمة' : 'بيانات حديثة';
  return (
    <span className={`ex-freshness ${failed ? 'is-error' : stale ? 'is-stale' : 'is-fresh'}`}>
      {label} · {date.toLocaleString('ar-SA')}
    </span>
  );
}

export function CoverageNotice({ coverage, missing }: { coverage: number; missing: string[] }) {
  return (
    <div className="ex-coverage-notice" aria-label={`تغطية القياس ${coverage}%`}>
      <div>
        <span>تغطية القياس</span>
        <strong>{coverage.toLocaleString('ar-SA')}٪</strong>
      </div>
      <div
        className="ex-coverage-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={coverage}
      >
        <span style={{ width: `${Math.max(0, Math.min(coverage, 100))}%` }} />
      </div>
      {missing.length > 0 && <small>غير متاح: {missing.join('، ')}</small>}
    </div>
  );
}

export function ExecutiveCard({
  title,
  description,
  source,
  sourceTo,
  freshness,
  freshnessFailed = false,
  action,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  source: string;
  sourceTo?: string;
  freshness?: string | null;
  freshnessFailed?: boolean;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`ex-card ${className}`}>
      <header className="ex-card-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </header>
      <div className="ex-card-body">{children}</div>
      <footer className="ex-card-meta">
        <SourceBadge label={source} to={sourceTo} />
        {freshness && <FreshnessBadge timestamp={freshness} failed={freshnessFailed} />}
      </footer>
    </section>
  );
}

export function ExecutiveKpiCard({
  label,
  value,
  unit,
  source,
  sourceTo,
  measuredAt,
  missing = false,
}: {
  label: string;
  value: number | string | null | undefined;
  unit?: string | null;
  source: string;
  sourceTo?: string;
  measuredAt?: string | null;
  missing?: boolean;
}) {
  return (
    <article className={`ex-kpi-card ${missing ? 'is-missing' : ''}`}>
      <span>{label}</span>
      <strong>
        {missing || value === null || value === undefined
          ? 'لا توجد بيانات معتمدة'
          : `${typeof value === 'number' ? value.toLocaleString('ar-SA') : value}${
              unit ? ` ${unit}` : ''
            }`}
      </strong>
      <div>
        <SourceBadge label={source} to={sourceTo} />
        {measuredAt && <FreshnessBadge timestamp={measuredAt} />}
      </div>
    </article>
  );
}

export function StatusSummaryStrip({
  items,
}: {
  items: Array<{
    label: string;
    value: number | string;
    tone?: 'good' | 'warn' | 'danger';
    to?: string;
  }>;
}) {
  return (
    <div className="ex-status-strip">
      {items.map((item) => {
        const content = (
          <>
            <span>{item.label}</span>
            <strong>
              {typeof item.value === 'number' ? item.value.toLocaleString('ar-SA') : item.value}
            </strong>
          </>
        );
        return item.to ? (
          <Link key={item.label} to={item.to} className={item.tone ? `is-${item.tone}` : ''}>
            {content}
          </Link>
        ) : (
          <div key={item.label} className={item.tone ? `is-${item.tone}` : ''}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

export function ExecutiveEmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`ex-state ex-empty-state ${compact ? 'is-compact' : ''}`}>
      <span aria-hidden="true">◇</span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function ExecutiveErrorState({
  title = 'تعذر تحميل البيانات',
  description = 'تحقق من الاتصال ثم أعد المحاولة.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="ex-state ex-error-state" role="alert">
      <span aria-hidden="true">!</span>
      <strong>{title}</strong>
      <p>{description}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}

export function CardStateBoundary({
  loading,
  error,
  empty,
  staleMessage,
  onRetry,
  emptyTitle = 'لا توجد بيانات معتمدة',
  emptyDescription = 'لا توجد سجلات متاحة ضمن النطاق الحالي.',
  children,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  staleMessage?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="ex-card-loading" aria-label="جارٍ تحميل البيانات" aria-busy="true">
        <span />
        <span />
        <span />
      </div>
    );
  }
  if (error && !staleMessage) {
    return <ExecutiveErrorState description={error} onRetry={onRetry} />;
  }
  if (empty) {
    return <ExecutiveEmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <>
      {staleMessage && (
        <div className="ex-inline-error" role="status">
          {staleMessage}
        </div>
      )}
      {children}
    </>
  );
}
