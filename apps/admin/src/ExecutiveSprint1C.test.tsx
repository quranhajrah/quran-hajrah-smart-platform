// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { clearExecutiveDashboardCache } from './executive-dashboard-data';
import { clearExecutiveInsightCache } from './executive-insights-data';

const user = {
  id: '10000000-0000-4000-8000-00000000001c',
  fullName: 'الرئيس التنفيذي',
  email: 'ceo@example.test',
  isActive: true,
  roles: [
    {
      id: '20000000-0000-4000-8000-00000000001c',
      name: 'ceo',
      displayName: 'الرئيس التنفيذي',
      isSystem: true,
      permissions: [],
    },
  ],
};

const now = '2026-07-29T08:00:00.000Z';
const stale = '2025-01-01T08:00:00.000Z';

const document = {
  id: 'document-authorized',
  title: 'تقرير الأداء المصرح',
  categoryId: 'category-1',
  category: { id: 'category-1', name: 'تقارير', slug: 'reports', sortOrder: 0 },
  documentType: 'REPORT',
  versionNumber: 3,
  status: 'ACTIVE',
  confidentialityLevel: 'CONFIDENTIAL',
  owningDepartment: 'الإدارة التنفيذية',
  keywords: [],
  isArchived: false,
  hasFile: true,
  tags: [],
  createdBy: { id: user.id, fullName: user.fullName },
  updatedBy: { id: user.id, fullName: user.fullName },
  createdAt: now,
  updatedAt: now,
};

const dashboard = {
  summary: {
    documents: { total: 10, active: 7, underReview: 1, expiring: 2, archived: 1 },
    activeUsers: 12,
    recentSystemActivity: 4,
    objectives: { total: 2, averageProgress: 62.5 },
    kpis: { NOT_STARTED: 1, ON_TRACK: 1, AT_RISK: 1, OFF_TRACK: 1, COMPLETED: 1 },
    initiatives: {
      total: 3,
      active: 1,
      delayed: 1,
      atRisk: 0,
      completed: 1,
      plannedBudget: 300_000,
      actualSpending: 250_000,
      budgetVariance: { amount: 50_000, percentage: 16.67 },
    },
    risks: { open: 2, critical: 1, averageResidualScore: 13.5 },
  },
  associationIndicators: {
    beneficiaries_total: {
      id: 'metric-beneficiaries',
      nameAr: 'إجمالي المستفيدين',
      value: 1450,
      unit: 'مستفيد',
      measuredAt: now,
    },
    attendance_rate: {
      id: 'metric-attendance',
      nameAr: 'نسبة الحضور',
      value: 88,
      unit: '%',
      measuredAt: stale,
    },
    circles_live: null,
  },
  institutionalMetrics: {
    strategic_plan_progress: {
      id: 'metric-strategic',
      nameAr: 'تقدم الخطة الاستراتيجية',
      value: 71,
      unit: '%',
      measuredAt: now,
    },
    operational_plan_progress: {
      id: 'metric-operational',
      nameAr: 'تقدم الخطة التشغيلية',
      value: null,
      unit: '%',
      measuredAt: null,
    },
    budget_execution_rate: {
      id: 'metric-budget',
      nameAr: 'تنفيذ الموازنة المؤسسية',
      value: 54,
      unit: '%',
      measuredAt: stale,
    },
  },
  health: {
    score: 78,
    coverage: 82,
    rating: 'جيد',
    components: [],
    missingData: ['المعرفة'],
    explanation: 'احتُسبت الدرجة من المكونات المعتمدة المتاحة فقط.',
  },
  documentAnalysis: {
    analyzed: 8,
    awaitingReview: 2,
    awaitingApproval: 1,
    imported: 5,
    failed: 0,
    ocrRequired: 0,
    budget: { records: 0, lines: 0, totalPlanned: 0 },
  },
  recentDocuments: [document],
  recentActivities: [],
  alerts: [
    {
      id: 'alert-critical',
      title: 'تنبيه حرج معتمد',
      severity: 'CRITICAL',
      status: 'OPEN',
    },
  ],
  upcomingDeadlines: [],
  quickActions: [],
};

const health = {
  score: 78,
  coverage: 82,
  rating: 'جيد',
  components: [
    {
      key: 'strategic',
      label: 'التقدم الاستراتيجي',
      weight: 25,
      score: 71,
      contribution: 17.75,
      missing: false,
      explanation: 'من القياس الاستراتيجي المعتمد.',
    },
    {
      key: 'knowledge',
      label: 'اكتمال المعرفة',
      weight: 15,
      score: null,
      contribution: null,
      missing: true,
      explanation: 'لا تتوفر تغطية مكتملة.',
    },
  ],
  missingData: ['المعرفة'],
  explanation: 'احتُسبت الدرجة وفق صيغة الصحة القائمة وتغطية المكونات المتاحة.',
  history: [{ id: 'snapshot-1', score: 76, coverage: 80, createdAt: stale }],
};

const metrics = [
  {
    id: 'metric-strategic',
    key: 'strategic_plan_progress',
    nameAr: 'تقدم الخطة الاستراتيجية',
    numericValue: 71,
    unit: '%',
    measuredAt: now,
  },
  {
    id: 'metric-beneficiaries',
    key: 'beneficiaries_total',
    nameAr: 'إجمالي المستفيدين',
    numericValue: 1450,
    unit: 'مستفيد',
    measuredAt: now,
  },
];

const objectives = [
  {
    id: 'objective-1',
    code: 'OBJ-01',
    title: 'تعزيز الأثر القرآني',
    strategicAxis: 'الأثر',
    owner: { id: 'owner-1', fullName: 'مدير الاستراتيجية' },
    weight: 60,
    progress: 70,
    status: 'ON_TRACK',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
    _count: { kpis: 3, initiatives: 2 },
  },
];

const kpis = [
  {
    id: 'kpi-not-started',
    code: 'KPI-1',
    title: 'مؤشر لم يبدأ',
    status: 'NOT_STARTED',
    currentValue: null,
  },
  { id: 'kpi-on-track', code: 'KPI-2', title: 'مؤشر ناجح', status: 'ON_TRACK', currentValue: 92 },
  { id: 'kpi-at-risk', code: 'KPI-3', title: 'مؤشر معرض', status: 'AT_RISK', currentValue: 61 },
  {
    id: 'kpi-off-track',
    code: 'KPI-4',
    title: 'مؤشر خارج المسار',
    status: 'OFF_TRACK',
    currentValue: 31,
  },
  {
    id: 'kpi-completed',
    code: 'KPI-5',
    title: 'مؤشر مكتمل',
    status: 'COMPLETED',
    currentValue: 100,
  },
];

const initiatives = [
  {
    id: 'initiative-delayed',
    code: 'INI-1',
    name: 'مبادرة متأخرة',
    status: 'DELAYED',
    progress: 40,
    budget: 100_000,
    actualSpending: 120_000,
    updatedAt: now,
    objective: { id: 'objective-1', title: 'تعزيز الأثر القرآني' },
  },
  {
    id: 'initiative-active',
    code: 'INI-2',
    name: 'مبادرة نشطة',
    status: 'ACTIVE',
    progress: 65,
    budget: 150_000,
    actualSpending: 80_000,
    updatedAt: now,
  },
  {
    id: 'initiative-completed',
    code: 'INI-3',
    name: 'مبادرة مكتملة',
    status: 'COMPLETED',
    progress: 100,
    budget: 50_000,
    actualSpending: 50_000,
    updatedAt: now,
  },
];

const risks = [
  {
    id: 'risk-critical',
    code: 'R-1',
    title: 'خطر استمرارية الخدمة',
    status: 'UNDER_TREATMENT',
    residualLikelihood: 'LIKELY',
    residualImpact: 'MAJOR',
    residualScore: 16,
    reviewDate: now,
    treatments: [{ id: 'treatment-1', status: 'IN_PROGRESS' }],
  },
  {
    id: 'risk-low',
    code: 'R-2',
    title: 'خطر منخفض',
    status: 'OPEN',
    residualLikelihood: 'UNLIKELY',
    residualImpact: 'MINOR',
    residualScore: 4,
    reviewDate: now,
  },
];

const reports = [
  {
    id: 'report-draft',
    title: 'تقرير مسودة',
    status: 'DRAFT',
    reportType: 'EXECUTIVE',
    preparedBy: { id: user.id, fullName: user.fullName },
    updatedAt: now,
  },
  {
    id: 'report-generated',
    title: 'تقرير مولد',
    status: 'GENERATED',
    reportType: 'BOARD',
    preparedBy: { id: user.id, fullName: user.fullName },
    updatedAt: now,
  },
  {
    id: 'report-approved',
    title: 'تقرير معتمد',
    status: 'APPROVED',
    reportType: 'EXECUTIVE',
    preparedBy: { id: user.id, fullName: user.fullName },
    updatedAt: now,
  },
  {
    id: 'report-archived',
    title: 'تقرير مؤرشف',
    status: 'ARCHIVED',
    reportType: 'EXECUTIVE',
    preparedBy: { id: user.id, fullName: user.fullName },
    updatedAt: stale,
  },
];

const structuredResult = {
  mode: 'structured-data',
  title: 'المبادرات المتأخرة',
  summary: 'توجد مبادرة متأخرة واحدة ضمن النطاق المصرح.',
  data: [initiatives[0]],
  missingData: ['لا تشمل النتيجة وحدات غير مطبقة.'],
  sources: [
    {
      module: 'initiatives',
      recordId: initiatives[0]!.id,
      label: initiatives[0]!.name,
      route: '/executive/initiatives',
    },
  ],
  suggestedActions: [
    {
      label: 'فتح سجل المبادرات',
      route: '/executive/initiatives?status=DELAYED',
      permission: 'initiatives.view',
    },
    {
      label: 'اقتراح محجوب',
      route: '/executive/risks',
      permission: 'risks.view',
    },
  ],
};

const knowledgeSource = {
  documentId: document.id,
  documentVersionId: 'version-1',
  documentTitle: document.title,
  documentType: 'REPORT',
  owningDepartment: document.owningDepartment,
  versionNumber: 3,
  pageNumber: 5,
  section: 'الأداء',
  excerpt: 'يبين التقرير تحسن أثر البرامج خلال فترة القياس.',
  score: 0.91,
  sourceUrl: `/documents/${document.id}`,
};

const writingResult = {
  version: '26.1.0',
  status: 'ANSWERED',
  answer: 'توصي الإدارة التنفيذية بتثبيت مسار المتابعة ورفع نتائج الأثر إلى المجلس.',
  executiveRecommendation: 'اعتماد متابعة شهرية موثقة.',
  sources: [
    {
      reference: 1,
      documentId: document.id,
      documentTitle: document.title,
      versionNumber: 3,
      pageNumber: 5,
      sourceUrl: `/documents/${document.id}`,
    },
  ],
  supportingReferences: [
    {
      reference: 1,
      quote: 'تحسن أثر البرامج خلال فترة القياس.',
      relevance: 'يدعم قرار الاستمرار.',
    },
  ],
  writing: {
    style: 'CEO',
    audience: 'الرئيس التنفيذي',
    purpose: 'التوصية',
    method: 'PROFESSIONAL_REWRITE',
  },
  evidence: { chunkCount: 2, documentCount: 1, combinedMultipleDocuments: false },
  limitations: ['تعتمد الصياغة على الوثائق المتاحة فقط.'],
};

const allPermissions = [
  'dashboard.view',
  'dashboard.configure',
  'metrics.view',
  'strategy.view',
  'kpi.view',
  'kpi.measure',
  'initiatives.view',
  'initiatives.manage',
  'risks.view',
  'reports.view',
  'reports.create',
  'reports.approve',
  'documents.view',
  'document_analysis.view',
  'knowledge.search',
  'knowledge.ask',
  'alerts.view',
  'executive.query',
  'executive_ai.use',
  'executive_ai.recommendations',
  'executive_ai.reports',
  'executive_ai.letters',
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const page = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 100 });

type FetchOptions = {
  queryFailure?: boolean;
  knowledgeInsufficient?: boolean;
  knowledgeAnswerResponse?: Promise<Response>;
  writingStatus?: number;
};

function createFetch(permissions: string[], options: FetchOptions = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api/, '');
    if (path === '/auth/refresh') {
      return json({ accessToken: 'test-token', user, permissions });
    }
    if (path === '/auth/logout') return json({ ok: true });
    if (path === '/executive/dashboard') return json(dashboard);
    if (path === '/executive/health' && init?.method !== 'POST') return json(health);
    if (path === '/executive/health/snapshots') {
      return json({ id: 'snapshot-2', score: 78, coverage: 82, createdAt: now });
    }
    if (path === '/executive/metrics') return json(page(metrics));
    if (path.match(/^\/executive\/metrics\/[^/]+\/trend$/)) {
      return json(page([{ id: 'measurement-1', numericValue: 1450, measuredAt: now }]));
    }
    if (path === '/executive/objectives') return json(page(objectives));
    if (path === '/executive/kpis/summary') {
      return json({ NOT_STARTED: 1, ON_TRACK: 1, AT_RISK: 1, OFF_TRACK: 1, COMPLETED: 1 });
    }
    if (path === '/executive/kpis') return json(page(kpis));
    if (path === '/executive/initiatives') return json(page(initiatives));
    if (path === '/executive/risks/heat-matrix') {
      return json({
        scope: 'RESIDUAL',
        criticalThreshold: 15,
        likelihoods: ['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN'],
        impacts: ['INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE'],
        matrix: [
          [0, 0, 0, 0, 0],
          [0, 1, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 1, 0],
          [0, 0, 0, 0, 0],
        ],
      });
    }
    if (path === '/executive/risks/critical') return json(page([risks[0]]));
    if (path === '/executive/risks/trend') {
      return json([{ id: 'trend-1', month: '2026-07', total: 2, open: 1, critical: 1 }]);
    }
    if (path === '/executive/risks') return json(page(risks));
    if (path === '/knowledge/summary') {
      return json({
        indexedDocuments: 7,
        queuedDocuments: 1,
        failedDocuments: 1,
        chunkCount: 24,
        relationCount: 8,
      });
    }
    if (path === '/executive/reports') return json(page(reports));
    if (path === '/executive/query') {
      return options.queryFailure
        ? json(
            {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'تعذر تنفيذ الاستعلام مؤقتًا.',
              },
            },
            500,
          )
        : json(structuredResult);
    }
    if (path === '/knowledge/search') return json({ items: [knowledgeSource] });
    if (path === '/knowledge/answer') {
      if (options.knowledgeAnswerResponse) return options.knowledgeAnswerResponse;
      return options.knowledgeInsufficient
        ? json({
            status: 'INSUFFICIENT_EVIDENCE',
            answer: 'لا تتوفر أدلة كافية للإجابة.',
            sources: [],
            limitations: ['لم تتحقق تغطية كافية.'],
          })
        : json({
            status: 'ANSWERED',
            answer: 'تظهر الأدلة تحسن أثر البرامج.',
            sources: [{ ...knowledgeSource, reference: 1 }],
            limitations: ['النتيجة مقيدة بالمستندات المصرح بها.'],
          });
    }
    if (path === '/executive-ai/capabilities') {
      return json({
        version: '26.1.0',
        language: 'ar',
        evidenceRequired: true,
        externalGenerativeProvider: false,
        professionalRewrite: true,
        directParagraphCopying: false,
        referencesPresentedSeparately: true,
        modes: ['QUESTION', 'CEO_RECOMMENDATIONS', 'OFFICIAL_LETTER', 'EXECUTIVE_REPORT'],
      });
    }
    if (
      [
        '/executive-ai/ask',
        '/executive-ai/recommendations',
        '/executive-ai/official-letter',
      ].includes(path)
    ) {
      return options.writingStatus
        ? json(
            {
              error: {
                code: options.writingStatus === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR',
                message:
                  options.writingStatus === 429
                    ? 'تم بلوغ حد الطلبات. أعد المحاولة لاحقًا.'
                    : 'تعذر إنشاء الصياغة.',
              },
            },
            options.writingStatus,
          )
        : json(writingResult);
    }
    return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
  });
}

function renderRoute(path: string, permissions = allPermissions, options?: FetchOptions) {
  window.history.replaceState({}, '', path);
  const fetchMock = createFetch(permissions, options);
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  clearExecutiveDashboardCache();
  clearExecutiveInsightCache();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('Sprint 1C executive leadership dashboard', () => {
  it('protects the route and does not fetch leadership data without dashboard permission', async () => {
    const fetchMock = renderRoute('/executive/leadership', ['executive.query']);

    expect(await screen.findByText('لا تملك صلاحية الوصول إلى هذه الصفحة.')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/executive/health')),
    ).toBe(false);
  });

  it('renders all nine governed sections without automatic AI or trend calls', async () => {
    const fetchMock = renderRoute('/executive/leadership');

    expect(
      await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية القيادية' }),
    ).toBeTruthy();
    [
      'الصحة والتغطية',
      'التقدم الاستراتيجي والتشغيلي',
      'محفظة الأهداف',
      'توزيع مؤشرات الأداء',
      'محفظة المبادرات',
      'ملف المخاطر',
      'مؤشرات الأثر القرآني',
      'امتثال المعرفة والوثائق',
      'مسار التقارير التنفيذية',
    ].forEach((title) => expect(screen.getByRole('heading', { name: title })).toBeTruthy());

    expect(screen.getByLabelText('درجة الصحة 78 من 100، التغطية 82%')).toBeTruthy();
    expect(screen.getByText('غير متاح: المعرفة')).toBeTruthy();
    expect(
      screen.getAllByText('لا توجد بيانات معتمدة', { selector: 'strong' }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/قد تكون البيانات قديمة/).length).toBeGreaterThan(0);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/executive/dashboard')),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        /executive-ai|knowledge\/(search|answer)|risks\/trend|metrics\/.+\/trend/.test(
          String(input),
        ),
      ),
    ).toBe(false);
  });

  it('keeps portfolio formulas separate, preserves missing values, and exposes governed links', async () => {
    renderRoute('/executive/leadership');
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية القيادية' });

    expect(
      screen.getByText(/تنفيذ الموازنة المؤسسية قياس مستقل ولا يساوي فروق إنفاق المبادرات/),
    ).toBeTruthy();
    expect(
      screen.getByText(/متوسط التقدم = مجموع قيم التقدم المسجلة ÷ عدد المبادرات ذات القيمة/),
    ).toBeTruthy();
    expect(screen.getByText(/القيم المفقودة: ١/)).toBeTruthy();
    expect(
      screen.getByText(/توزيع مؤشرات الأداء: الإجمالي ٥، وهو مجموع الحالات الظاهرة/),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'فتح الهدف' }).getAttribute('href')).toBe(
      '/executive/objectives/objective-1',
    );
    expect(screen.getByText('مبادرة متأخرة').closest('a')?.getAttribute('href')).toBe(
      '/executive/initiatives/initiative-delayed',
    );
  });

  it('provides numeric risk alternatives and loads risk and Quran trends only on request', async () => {
    const fetchMock = renderRoute('/executive/leadership');
    const interaction = userEvent.setup();
    await screen.findByRole('heading', { name: 'ملف المخاطر' });

    expect(screen.getByText('الحد الحرج: 15 من 25')).toBeTruthy();
    expect(screen.getByText('المقياس: احتمال 1–5 × أثر 1–5')).toBeTruthy();
    expect(screen.getByText('خطر استمرارية الخدمة')).toBeTruthy();
    await interaction.click(screen.getByRole('button', { name: 'تحميل التوزيع حسب شهر التسجيل' }));
    expect(
      await screen.findByLabelText('توزيع المخاطر حسب شهر التسجيل وحالتها الحالية'),
    ).toBeTruthy();
    expect(screen.getByText(/لا يمثل سجلًا تاريخيًا لتغير الحالة/)).toBeTruthy();
    await interaction.click(screen.getAllByRole('button', { name: 'تحميل سجل الاتجاه' })[0]!);
    expect(await screen.findByLabelText('سجل قياسات إجمالي المستفيدين')).toBeTruthy();
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes('/executive/risks/trend')),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([input]) =>
        String(input).includes('/executive/metrics/metric-beneficiaries/trend'),
      ),
    ).toHaveLength(1);
  });

  it('scopes document, knowledge, objective, and report UI to exact permissions', async () => {
    const permissions = ['dashboard.view', 'reports.view'];
    const fetchMock = renderRoute('/executive/leadership', permissions);
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية القيادية' });

    expect(screen.queryByText(document.title)).toBeNull();
    expect(screen.queryByRole('heading', { name: 'محفظة الأهداف' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'امتثال المعرفة والوثائق' })).toBeNull();
    expect(screen.getByText('تقرير مسودة')).toBeTruthy();
    expect(screen.queryByText('توليد/تحرير')).toBeNull();
    expect(screen.queryByText('مراجعة للاعتماد')).toBeNull();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        /executive\/objectives|knowledge\/summary/.test(String(input)),
      ),
    ).toBe(false);
  });

  it('shows CEO mode from authorized evidence and never generates recommendations automatically', async () => {
    const fetchMock = renderRoute('/executive/leadership?mode=ceo');

    expect(await screen.findByRole('heading', { name: 'أهم المشكلات' })).toBeTruthy();
    expect(screen.getByText('تنبيه حرج معتمد')).toBeTruthy();
    expect(screen.getByText('مبادرة مكتملة')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'إنشاء التوصيات التنفيذية' })).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/executive-ai/recommendations'),
      ),
    ).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'التحليل التفصيلي' }));
    expect(window.location.search).toBe('');
    expect(await screen.findByRole('heading', { name: 'الصحة والتغطية' })).toBeTruthy();
  });
});

describe('Sprint 1C governed executive Smart Bar', () => {
  it('filters modes and routes by permission and supports keyboard navigation', async () => {
    renderRoute('/', ['dashboard.view', 'executive.query']);
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });

    expect(within(dialog).getByRole('tab', { name: 'التنقل' })).toBeTruthy();
    expect(within(dialog).getByRole('tab', { name: 'استعلام مؤسسي' })).toBeTruthy();
    expect(within(dialog).queryByRole('tab', { name: 'المعرفة والأدلة' })).toBeNull();
    expect(within(dialog).queryByRole('tab', { name: 'الكتابة التنفيذية' })).toBeNull();

    const search = within(dialog).getByPlaceholderText('ابحث عن صفحة أو أداة…');
    await userEvent.type(search, 'القيادية');
    expect(within(dialog).getByRole('option', { name: /لوحة القيادة القيادية/ })).toBeTruthy();
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(window.location.pathname).toBe('/executive/leadership');
  });

  it('traps dialog focus, closes with Escape, and restores the invoking control', async () => {
    renderRoute('/', ['dashboard.view', 'executive.query']);
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    const interaction = userEvent.setup();
    const trigger = screen.getAllByRole('button', {
      name: 'فتح الشريط التنفيذي الذكي',
    })[0]!;
    await interaction.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ];
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    last.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(window.document.activeElement).toBe(first);

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.document.activeElement).toBe(trigger);
  });

  it('runs structured queries explicitly, reports source and limitations, and retains input on error', async () => {
    const fetchMock = renderRoute('/', ['dashboard.view', 'executive.query', 'initiatives.view'], {
      queryFailure: true,
    });
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    const interaction = userEvent.setup();
    await interaction.click(within(dialog).getByRole('tab', { name: 'استعلام مؤسسي' }));
    const input = within(dialog).getByLabelText('سؤال عن البيانات المؤسسية المنظمة');
    await interaction.type(input, 'ما المبادرات المتأخرة؟');

    expect(
      fetchMock.mock.calls.some(([request]) => String(request).includes('/executive/query')),
    ).toBe(false);
    await interaction.click(within(dialog).getByRole('button', { name: 'تنفيذ الاستعلام' }));
    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'تعذر تنفيذ الاستعلام مؤقتًا.',
    );
    expect((input as HTMLInputElement).value).toBe('ما المبادرات المتأخرة؟');
  });

  it('renders structured-query sources, freshness, limitations, and only authorized actions', async () => {
    renderRoute('/', ['dashboard.view', 'executive.query', 'initiatives.view']);
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    const interaction = userEvent.setup();
    await interaction.click(within(dialog).getByRole('tab', { name: 'استعلام مؤسسي' }));
    await interaction.type(
      within(dialog).getByLabelText('سؤال عن البيانات المؤسسية المنظمة'),
      'ما المبادرات المتأخرة؟',
    );
    await interaction.click(within(dialog).getByRole('button', { name: 'تنفيذ الاستعلام' }));

    expect(await within(dialog).findByRole('heading', { name: 'المبادرات المتأخرة' })).toBeTruthy();
    expect(within(dialog).getByText('توجد مبادرة متأخرة واحدة ضمن النطاق المصرح.')).toBeTruthy();
    expect(within(dialog).getByText('لا تشمل النتيجة وحدات غير مطبقة.')).toBeTruthy();
    expect(within(dialog).getByText(/وقت الاستعلام:/)).toBeTruthy();
    expect(
      within(dialog).getByRole('link', { name: 'فتح سجل المبادرات' }).getAttribute('href'),
    ).toBe('/executive/initiatives?status=DELAYED');
    expect(within(dialog).queryByRole('link', { name: 'اقتراح محجوب' })).toBeNull();
  });

  it('returns evidence search and insufficient answers without automatic or restricted content', async () => {
    const fetchMock = renderRoute('/', ['dashboard.view', 'knowledge.search', 'knowledge.ask'], {
      knowledgeInsufficient: true,
    });
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    const interaction = userEvent.setup();
    await interaction.click(within(dialog).getByRole('tab', { name: 'المعرفة والأدلة' }));

    expect(
      fetchMock.mock.calls.some(([input]) => /knowledge\/(search|answer)/.test(String(input))),
    ).toBe(false);
    await interaction.click(within(dialog).getByRole('button', { name: 'بحث في الأدلة' }));
    await interaction.type(within(dialog).getByLabelText('موضوع البحث أو السؤال'), 'أثر البرامج');
    await interaction.click(within(dialog).getByRole('button', { name: 'البحث' }));
    expect(await within(dialog).findByText(document.title)).toBeTruthy();
    expect(within(dialog).getByText('الصلة 91٪')).toBeTruthy();
    expect(within(dialog).queryByText('وثيقة محجوبة')).toBeNull();

    await interaction.click(
      within(dialog).getByRole('button', { name: 'إجابة مستندة إلى الأدلة' }),
    );
    await interaction.click(within(dialog).getByRole('button', { name: 'إنشاء الإجابة' }));
    expect(await within(dialog).findByRole('heading', { name: 'الأدلة غير كافية' })).toBeTruthy();
    expect(within(dialog).getByText('لم تتحقق تغطية كافية.')).toBeTruthy();
  });

  it('aborts in-flight knowledge work and cannot restore protected results after closing', async () => {
    let releaseAnswer!: (response: Response) => void;
    const knowledgeAnswerResponse = new Promise<Response>((resolve) => {
      releaseAnswer = resolve;
    });
    const fetchMock = renderRoute('/', ['dashboard.view', 'knowledge.ask'], {
      knowledgeAnswerResponse,
    });
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    const interaction = userEvent.setup();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    let dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    await interaction.click(within(dialog).getByRole('tab', { name: 'المعرفة والأدلة' }));
    await interaction.type(
      within(dialog).getByLabelText('موضوع البحث أو السؤال'),
      'نتيجة يجب مسحها',
    );
    await interaction.click(within(dialog).getByRole('button', { name: 'إنشاء الإجابة' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => String(input).includes('/knowledge/answer')),
      ).toBe(true),
    );
    const answerCall = fetchMock.mock.calls.find(([input]) =>
      String(input).includes('/knowledge/answer'),
    );

    await interaction.click(within(dialog).getByRole('button', { name: 'إغلاق' }));
    expect((answerCall?.[1]?.signal as AbortSignal | undefined)?.aborted).toBe(true);
    releaseAnswer(
      json({
        status: 'ANSWERED',
        answer: 'نتيجة محمية متأخرة',
        sources: [{ ...knowledgeSource, reference: 1 }],
        limitations: [],
      }),
    );
    await Promise.resolve();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    await interaction.click(within(dialog).getByRole('tab', { name: 'المعرفة والأدلة' }));
    expect((within(dialog).getByLabelText('موضوع البحث أو السؤال') as HTMLInputElement).value).toBe(
      '',
    );
    expect(within(dialog).queryByText('نتيجة محمية متأخرة')).toBeNull();
  });

  it('loads Enterprise 26.1 capabilities on demand and separates prose, quotations, sources, and limits', async () => {
    const fetchMock = renderRoute('/', [
      'dashboard.view',
      'executive_ai.use',
      'executive_ai.recommendations',
      'executive_ai.letters',
    ]);
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    const interaction = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();

    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/executive-ai/capabilities')),
    ).toBe(false);
    await interaction.click(within(dialog).getByRole('tab', { name: 'الكتابة التنفيذية' }));
    expect(await within(dialog).findByText('Enterprise 26.1.0')).toBeTruthy();
    const formats = within(dialog).getByLabelText('نمط وصيغة الكتابة المهنية');
    expect(within(formats).getByRole('option', { name: 'إجابة تنفيذية مهنية' })).toBeTruthy();
    expect(within(formats).getByRole('option', { name: 'توصيات الرئيس التنفيذي' })).toBeTruthy();
    expect(within(formats).getByRole('option', { name: 'خطاب رسمي' })).toBeTruthy();
    expect(within(formats).queryByRole('option', { name: 'تقرير تنفيذي' })).toBeNull();

    await interaction.type(
      within(dialog).getByLabelText('الموضوع والسياق التنفيذي'),
      'استمرار برنامج الأثر',
    );
    await interaction.click(
      within(dialog).getByRole('button', { name: 'إنشاء إجابة تنفيذية مهنية' }),
    );
    expect(
      await within(dialog).findByRole('heading', { name: 'الصياغة التنفيذية المهنية' }),
    ).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'التوصية التنفيذية' })).toBeTruthy();
    expect(
      within(dialog).getByRole('heading', { name: 'الاقتباسات الداعمة — منفصلة عن الصياغة' }),
    ).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'المصادر المصرح بها' })).toBeTruthy();
    expect(within(dialog).getByRole('heading', { name: 'الحدود' })).toBeTruthy();
    await interaction.click(within(dialog).getByRole('button', { name: 'نسخ الصياغة فقط' }));
    await waitFor(() =>
      expect(copy).toHaveBeenCalledWith(
        `${writingResult.answer}\n\n${writingResult.executiveRecommendation}`,
      ),
    );
  });

  it('retains writing inputs after rate limiting and clears protected Smart Bar state on logout', async () => {
    renderRoute('/', ['dashboard.view', 'executive_ai.use'], { writingStatus: 429 });
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    const interaction = userEvent.setup();
    await interaction.click(within(dialog).getByRole('tab', { name: 'الكتابة التنفيذية' }));
    await within(dialog).findByText('Enterprise 26.1.0');
    const input = within(dialog).getByLabelText('الموضوع والسياق التنفيذي');
    await interaction.type(input, 'موضوع محفوظ عند الخطأ');
    await interaction.click(
      within(dialog).getByRole('button', { name: 'إنشاء إجابة تنفيذية مهنية' }),
    );

    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'تم بلوغ حد الطلبات. أعد المحاولة لاحقًا.',
    );
    expect((input as HTMLTextAreaElement).value).toBe('موضوع محفوظ عند الخطأ');
    await interaction.click(screen.getAllByRole('button', { name: 'تسجيل الخروج' })[0]!);
    expect(await screen.findByRole('heading', { name: 'منصة قرآن الهجرة الذكية' })).toBeTruthy();
    expect(screen.queryByText('موضوع محفوظ عند الخطأ')).toBeNull();
  });

  it('keeps the full CEO journey connected without dead-end cards', async () => {
    renderRoute('/');
    const interaction = userEvent.setup();
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    await interaction.click(screen.getByRole('link', { name: 'فتح موجز اليوم' }));
    expect(await screen.findByRole('heading', { name: 'اليوم في الجمعية' })).toBeTruthy();
    await interaction.click(screen.getByRole('link', { name: 'مركز القيادة' }));
    expect(await screen.findByRole('heading', { name: 'مركز القيادة التنفيذي' })).toBeTruthy();
    await interaction.click(screen.getByRole('link', { name: 'اللوحة القيادية' }));
    expect(
      await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية القيادية' }),
    ).toBeTruthy();
    expect(screen.getByText('خطر استمرارية الخدمة').closest('a')?.getAttribute('href')).toBe(
      '/executive/risks/risk-critical',
    );
    expect(screen.getByRole('navigation', { name: 'مسار الصفحة' })).toBeTruthy();
  });
});
