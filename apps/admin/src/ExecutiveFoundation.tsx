import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { useAuth } from './auth';
import { Link, NavLink, useNavigate } from './router';
import './executive-foundation.css';

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
}: {
  onOpenSidebar(): void;
  onOpenSmartBar(): void;
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
      <button
        className="ex-smart-trigger"
        type="button"
        onClick={onOpenSmartBar}
        aria-label="فتح شريط الانتقال التنفيذي"
      >
        <span aria-hidden="true">⌕</span>
        <span>انتقل إلى صفحة أو أداة</span>
        <kbd>⌘ / Ctrl + K</kbd>
      </button>
      <button className="ex-header-signout" type="button" onClick={() => void logout()}>
        تسجيل الخروج
      </button>
    </header>
  );
}

export function ExecutiveSmartBar({ open, onClose }: { open: boolean; onClose(): void }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

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
      .slice(0, 9);
  }, [can, query]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        onClose();
        if (!open) {
          window.dispatchEvent(new CustomEvent('executive-smartbar-open'));
        }
      }
      if (event.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  if (!open) return null;

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

  return (
    <div className="ex-smartbar-layer" role="presentation" onMouseDown={onClose}>
      <section
        className="ex-smartbar"
        role="dialog"
        aria-modal="true"
        aria-labelledby="executive-smartbar-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ex-smartbar-heading">
          <div>
            <h2 id="executive-smartbar-title">شريط الانتقال التنفيذي</h2>
            <p>ينقلك إلى الصفحات المصرح بها فقط، ولا ينفذ أي إجراء أو تغيير.</p>
          </div>
          <button className="ex-icon-button" type="button" onClick={onClose} aria-label="إغلاق">
            ×
          </button>
        </div>
        <label className="ex-smartbar-search">
          <span className="sr-only">ابحث عن صفحة أو أداة</span>
          <input
            ref={inputRef}
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
      </section>
    </div>
  );
}

export function MobileBottomNavigation() {
  const { can } = useAuth();
  const candidates = [
    navigationItems.find((item) => item.to === '/'),
    navigationItems.find((item) => item.to === '/executive/metrics'),
    navigationItems.find((item) => item.to === '/documents'),
    navigationItems.find((item) => item.to === '/executive-assistant'),
    navigationItems.find((item) => item.to === '/account'),
  ].filter((item): item is NavigationItem => Boolean(item));
  const items = candidates.filter((item) => allowed(item, can)).slice(0, 5);

  return (
    <nav className="ex-mobile-nav" aria-label="التنقل السريع">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to}>
          <span aria-hidden="true">
            {item.to === '/'
              ? '⌂'
              : item.to === '/executive/metrics'
                ? '◫'
                : item.to === '/documents'
                  ? '▤'
                  : item.to === '/executive-assistant'
                    ? '✦'
                    : '●'}
          </span>
          <small>{item.label.replace('الرئيسية التنفيذية', 'الرئيسية')}</small>
        </NavLink>
      ))}
    </nav>
  );
}

export function ExecutiveLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [smartBarOpen, setSmartBarOpen] = useState(false);

  useEffect(() => {
    const openSmartBar = () => setSmartBarOpen(true);
    window.addEventListener('executive-smartbar-open', openSmartBar);
    return () => window.removeEventListener('executive-smartbar-open', openSmartBar);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault();
        setSmartBarOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  return (
    <div className="ex-shell" dir="rtl">
      <ExecutiveSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="ex-main">
        <ExecutiveHeader
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenSmartBar={() => setSmartBarOpen(true)}
        />
        <div className="ex-smartbar-dock">
          <button
            type="button"
            onClick={() => setSmartBarOpen(true)}
            aria-label="فتح شريط الانتقال التنفيذي"
          >
            <span aria-hidden="true">⌕</span>
            <span>انتقل إلى صفحة أو أداة ضمن صلاحياتك</span>
            <kbd>⌘ / Ctrl + K</kbd>
          </button>
        </div>
        <main className="ex-content">{children}</main>
      </div>
      <MobileBottomNavigation />
      <ExecutiveSmartBar open={smartBarOpen} onClose={() => setSmartBarOpen(false)} />
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
