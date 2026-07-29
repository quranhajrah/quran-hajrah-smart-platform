// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { clearExecutiveDashboardCache } from './executive-dashboard-data';
import { clearExecutiveInsightCache } from './executive-insights-data';
import { MISSING_VALUE, calculateInitiativeVariance, sortAlerts } from './ExecutiveInsightsShared';

const user = {
  id: '10000000-0000-4000-8000-0000000001b0',
  fullName: 'الرئيس التنفيذي',
  email: 'ceo@example.test',
  isActive: true,
  roles: [
    {
      id: '20000000-0000-4000-8000-0000000001b0',
      name: 'ceo',
      displayName: 'الرئيس التنفيذي',
      isSystem: true,
      permissions: [],
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const relativeIso = (days: number, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const recentDocument = {
  id: '40000000-0000-4000-8000-0000000001b0',
  title: 'تقرير الأداء المتاح',
  categoryId: '41000000-0000-4000-8000-0000000001b0',
  category: {
    id: '41000000-0000-4000-8000-0000000001b0',
    name: 'التقارير',
    slug: 'reports',
    sortOrder: 0,
  },
  documentType: 'REPORT',
  versionNumber: 2,
  status: 'ACTIVE',
  confidentialityLevel: 'CONFIDENTIAL',
  owningDepartment: 'الإدارة التنفيذية',
  keywords: [],
  isArchived: false,
  hasFile: true,
  tags: [],
  createdBy: { id: user.id, fullName: user.fullName },
  updatedBy: { id: user.id, fullName: user.fullName },
  createdAt: relativeIso(-3),
  updatedAt: relativeIso(0),
};

const dashboard = {
  summary: {
    documents: { total: 8, active: 6, underReview: 1, expiring: 1, archived: 1 },
    activeUsers: 12,
    recentSystemActivity: 5,
    objectives: { total: 4, averageProgress: 70 },
    kpis: { ON_TRACK: 4, AT_RISK: 2, OFF_TRACK: 1 },
    initiatives: {
      total: 5,
      active: 2,
      delayed: 2,
      atRisk: 1,
      completed: 0,
      plannedBudget: 1_000_000,
      actualSpending: 920_000,
      budgetVariance: { amount: 80_000, percentage: 8 },
    },
    risks: { open: 4, critical: 2, averageResidualScore: 12.5 },
  },
  associationIndicators: {},
  institutionalMetrics: {},
  health: {
    score: 76,
    coverage: 83,
    rating: 'جيد',
    components: [],
    missingData: ['الصحة المالية'],
    explanation: 'احتُسبت الصحة من المكونات المعتمدة المتاحة.',
  },
  documentAnalysis: {
    analyzed: 8,
    awaitingReview: 1,
    awaitingApproval: 1,
    imported: 4,
    failed: 1,
    ocrRequired: 1,
    budget: { records: 1, lines: 4, totalPlanned: 200_000 },
  },
  recentDocuments: [recentDocument],
  recentActivities: [],
  alerts: [],
  upcomingDeadlines: [
    {
      id: '50000000-0000-4000-8000-0000000001b0',
      name: 'مبادرة مستحقة اليوم',
      endDate: relativeIso(0),
      status: 'AT_RISK',
      module: 'initiatives',
    },
    {
      id: '51000000-0000-4000-8000-0000000001b0',
      riskId: '52000000-0000-4000-8000-0000000001b0',
      title: 'معالجة خطر خلال خمسة أيام',
      dueDate: relativeIso(5),
      status: 'ON_TRACK',
      module: 'risks',
    },
    {
      id: '53000000-0000-4000-8000-0000000001b0',
      name: 'مبادرة خلال عشرين يومًا',
      endDate: relativeIso(20),
      status: 'ACTIVE',
      module: 'initiatives',
    },
  ],
  quickActions: [],
};

const initiatives = [
  {
    id: '60000000-0000-4000-8000-0000000001b0',
    code: 'INI-1',
    name: 'مبادرة التحول التشغيلي',
    status: 'DELAYED',
    progress: 45,
    startDate: relativeIso(-100),
    endDate: relativeIso(-2),
    budget: 100_000,
    actualSpending: 130_000,
    owner: { id: 'owner-1', fullName: 'مدير العمليات' },
    objective: { id: 'objective-1', title: 'رفع الكفاءة' },
    updates: [{ updateDate: relativeIso(-1) }],
  },
  {
    id: '61000000-0000-4000-8000-0000000001b0',
    code: 'INI-2',
    name: 'مبادرة بلا أساس موازنة',
    status: 'AT_RISK',
    progress: 20,
    startDate: relativeIso(-30),
    endDate: relativeIso(12),
    budget: 0,
    actualSpending: 5_000,
    owner: null,
    objective: null,
    updates: [],
  },
];

const kpis = [
  {
    id: '70000000-0000-4000-8000-0000000001b0',
    code: 'KPI-1',
    title: 'نسبة اكتمال المبادرات',
    status: 'OFF_TRACK',
    currentValue: 48,
    target: 90,
    unit: '%',
    lastMeasuredAt: relativeIso(-2),
    dataSource: 'سجل المبادرات',
    owner: { id: 'owner-2', fullName: 'مدير الاستراتيجية' },
    objective: { id: 'objective-1', title: 'رفع الكفاءة' },
  },
  {
    id: '71000000-0000-4000-8000-0000000001b0',
    code: 'KPI-2',
    title: 'مؤشر بلا قياس حالي',
    status: 'AT_RISK',
    currentValue: null,
    target: null,
    unit: '%',
    lastMeasuredAt: null,
    dataSource: null,
    owner: null,
    objective: null,
  },
];

const criticalRisks = [
  {
    id: '80000000-0000-4000-8000-0000000001b0',
    code: 'R-1',
    title: 'خطر استمرارية الخدمة',
    status: 'OPEN',
    residualLikelihood: 'POSSIBLE',
    residualImpact: 'MAJOR',
    residualScore: 16,
    reviewDate: relativeIso(3),
    owner: { id: 'owner-3', fullName: 'مدير المخاطر' },
  },
  {
    id: '81000000-0000-4000-8000-0000000001b0',
    code: 'R-2',
    title: 'خطر تعطل مورد',
    status: 'UNDER_TREATMENT',
    residualLikelihood: 'LIKELY',
    residualImpact: 'SEVERE',
    residualScore: 20,
    reviewDate: relativeIso(5),
    owner: null,
  },
];

const criticalAlert = {
  id: '90000000-0000-4000-8000-0000000001b0',
  severity: 'CRITICAL',
  title: 'تنبيه حرج للتدخل',
  description: 'يتطلب تدخل القيادة.',
  sourceModule: 'risks',
  sourceRecordId: criticalRisks[0]!.id,
  dueDate: relativeIso(0),
  createdAt: relativeIso(0, 8),
  status: 'OPEN',
};

const dailyAlert = {
  id: '91000000-0000-4000-8000-0000000001b0',
  severity: 'HIGH',
  title: 'تنبيه يومي مرتفع',
  description: 'أُنشئ اليوم ويتطلب المتابعة.',
  sourceModule: 'initiatives',
  sourceRecordId: initiatives[0]!.id,
  dueDate: relativeIso(-1),
  createdAt: relativeIso(0, 7),
  status: 'OPEN',
};

const analysisJob = {
  id: 'a0000000-0000-4000-8000-0000000001b0',
  documentId: recentDocument.id,
  documentVersionId: 'a1000000-0000-4000-8000-0000000001b0',
  status: 'UNDER_REVIEW',
  extractionVersion: '24.2.0',
  pageCount: 10,
  tableCount: 2,
  proposalCount: 6,
  reviewDueAt: relativeIso(1),
  createdAt: relativeIso(-1),
  updatedAt: relativeIso(0),
  document: {
    id: recentDocument.id,
    title: recentDocument.title,
    confidentialityLevel: recentDocument.confidentialityLevel,
    documentType: recentDocument.documentType,
    versionNumber: recentDocument.versionNumber,
  },
};

const writingResponse = {
  version: '26.1.0',
  status: 'ANSWERED',
  answer: 'توصي الإدارة التنفيذية بتركيز التدخل على معالجة الخطر الأعلى أثرًا.',
  executiveRecommendation: 'اعتماد خطة معالجة مرحلية ومتابعة أثرها أسبوعيًا.',
  sources: [
    {
      reference: 1,
      documentId: recentDocument.id,
      documentTitle: recentDocument.title,
      versionNumber: 2,
      pageNumber: 4,
      sourceUrl: `/documents/${recentDocument.id}`,
    },
  ],
  supportingReferences: [
    { reference: 1, quote: 'ورد في التقرير ما يدعم أولوية المعالجة.', relevance: 'يدعم الأولوية' },
  ],
  writing: {
    style: 'CEO',
    audience: 'الرئيس التنفيذي',
    purpose: 'التوصية',
    method: 'PROFESSIONAL_REWRITE',
  },
  evidence: { chunkCount: 2, documentCount: 1, combinedMultipleDocuments: false },
  limitations: ['تقتصر النتيجة على الوثائق المتاحة.'],
};

type FetchOptions = {
  fail?: Set<string>;
  dashboardFailureAfter?: number;
  writingStatus?: number;
  insufficientEvidence?: boolean;
};

function createFetch(permissions: string[], options: FetchOptions = {}) {
  let dashboardCalls = 0;
  let alertStatus = 'OPEN';
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/^\/api/, '');
    if (path === '/auth/refresh') {
      return json({ accessToken: 'test-token', user, permissions });
    }
    if (path === '/auth/login') {
      return json({ accessToken: 'test-token', user, permissions });
    }
    if (path === '/auth/logout') {
      return json({ ok: true });
    }
    if (options.fail?.has(path)) {
      return json({ error: { code: 'INTERNAL_ERROR', message: `تعذر تحميل ${path}` } }, 500);
    }
    if (path === '/executive/dashboard') {
      dashboardCalls += 1;
      if (options.dashboardFailureAfter && dashboardCalls > options.dashboardFailureAfter) {
        return json({ error: { code: 'INTERNAL_ERROR', message: 'تعذر تحديث التجميع' } }, 500);
      }
      return json(dashboard);
    }
    if (path === '/executive/deadlines') {
      return json({
        items: dashboard.upcomingDeadlines,
        total: dashboard.upcomingDeadlines.length,
        page: Number(url.searchParams.get('page') ?? 1),
        pageSize: Number(url.searchParams.get('pageSize') ?? 100),
      });
    }
    if (path === '/executive/alerts' && init?.method !== 'POST') {
      const items = url.searchParams.has('severity')
        ? [{ ...criticalAlert, status: alertStatus }]
        : [{ ...criticalAlert, status: alertStatus }, dailyAlert];
      return json({ items, total: items.length, page: 1, pageSize: 100 });
    }
    if (path.match(/^\/executive\/alerts\/[^/]+\/(acknowledge|resolve|dismiss)$/)) {
      const action = path.split('/').at(-1);
      alertStatus =
        action === 'acknowledge' ? 'ACKNOWLEDGED' : action === 'resolve' ? 'RESOLVED' : 'DISMISSED';
      return json({ ...criticalAlert, status: alertStatus });
    }
    if (path === '/executive/initiatives') {
      return json({ items: initiatives, total: initiatives.length, page: 1, pageSize: 100 });
    }
    if (path === '/executive/kpis') {
      return json({ items: kpis, total: kpis.length, page: 1, pageSize: 100 });
    }
    if (path.match(/^\/executive\/kpis\/[^/]+\/trend$/)) {
      const id = path.split('/')[3];
      const items =
        id === kpis[0]!.id
          ? [
              { id: 'measurement-2', value: 48, measuredAt: relativeIso(-2) },
              { id: 'measurement-1', value: 55, measuredAt: relativeIso(-30) },
            ]
          : [];
      return json({ items, total: items.length, page: 1, pageSize: 2 });
    }
    if (path === '/executive/risks/heat-matrix') {
      return json({
        scope: 'RESIDUAL',
        criticalThreshold: 15,
        likelihoods: ['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN'],
        impacts: ['INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE'],
        matrix: [
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [0, 0, 0, 1, 0],
          [0, 0, 0, 0, 1],
          [0, 0, 0, 0, 0],
        ],
      });
    }
    if (path === '/executive/risks/critical') {
      return json({
        items: criticalRisks,
        total: criticalRisks.length,
        page: 1,
        pageSize: 100,
      });
    }
    if (path === '/executive/activity') {
      const page = Number(url.searchParams.get('page') ?? 1);
      const item = {
        id: `b0000000-0000-4000-8000-0000000001b${page}`,
        action: page === 1 ? 'risks.update' : 'initiatives.update_progress',
        entityType: page === 1 ? 'InstitutionalRisk' : 'OperationalInitiative',
        entityId: page === 1 ? criticalRisks[0]!.id : initiatives[0]!.id,
        description: page === 1 ? 'تحديث معالجة خطر' : 'تحديث تقدم مبادرة',
        createdAt: relativeIso(0, page === 1 ? 9 : 8),
        user: { id: user.id, fullName: user.fullName },
      };
      return json({ items: [item], total: 2, page, pageSize: 10 });
    }
    if (path === '/document-analysis/jobs') {
      return json({ items: [analysisJob], total: 1, page: 1, pageSize: 100 });
    }
    if (path === '/executive-ai/recommendations' || path === '/executive-ai/executive-report') {
      if (options.writingStatus) {
        return json(
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
        );
      }
      if (options.insufficientEvidence) {
        return json({
          ...writingResponse,
          status: 'INSUFFICIENT_EVIDENCE',
          answer: 'لا تتوفر أدلة مؤسسية كافية لإعداد صياغة مسؤولة.',
          executiveRecommendation: '',
          sources: [],
          supportingReferences: [],
          evidence: { chunkCount: 0, documentCount: 0, combinedMultipleDocuments: false },
        });
      }
      return json(writingResponse);
    }
    return json({ error: { code: 'NOT_FOUND', message: path } }, 404);
  });
}

function renderRoute(path: string, permissions: string[], options?: FetchOptions) {
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
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
  window.history.replaceState({}, '', '/');
});

describe('Sprint 1B executive command center and today view', () => {
  it('protects both routes and exposes them only through governed navigation', async () => {
    const fetchMock = renderRoute('/executive/command-center', []);
    expect(await screen.findByText('لا تملك صلاحية الوصول إلى هذه الصفحة.')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/executive/dashboard')),
    ).toBe(false);

    cleanup();
    clearExecutiveDashboardCache();
    clearExecutiveInsightCache();
    renderRoute('/executive/today', ['dashboard.view']);
    expect(await screen.findByRole('heading', { name: 'اليوم في الجمعية' })).toBeTruthy();
    expect(screen.getAllByText('مركز القيادة التنفيذي').length).toBeGreaterThan(0);
    expect(screen.getAllByText('لوحة القيادة القيادية').length).toBeGreaterThan(0);
  });

  it('omits restricted exception counts and makes one dashboard aggregate request', async () => {
    const fetchMock = renderRoute('/executive/command-center', [
      'dashboard.view',
      'initiatives.view',
    ]);
    expect(await screen.findByRole('heading', { name: 'مركز القيادة التنفيذي' })).toBeTruthy();
    expect(screen.getByText('مبادرات متأخرة')).toBeTruthy();
    expect(screen.getByText('مبادرات معرضة للخطر')).toBeTruthy();
    expect(screen.queryByText('مخاطر حرجة مفتوحة')).toBeNull();
    expect(screen.queryByText('تنبيهات حرجة')).toBeNull();
    expect(screen.queryByText('مؤشرات خارج المسار')).toBeNull();
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/executive/dashboard')),
    ).toHaveLength(1);
  });

  it('sorts alerts deterministically and permits audited actions only with alerts.manage', async () => {
    expect(
      sortAlerts([
        { ...criticalAlert, id: 'low', severity: 'LOW' },
        { ...criticalAlert, id: 'critical', severity: 'CRITICAL' },
        { ...criticalAlert, id: 'high', severity: 'HIGH' },
      ]).map((item) => item.id),
    ).toEqual(['critical', 'high', 'low']);

    const fetchMock = renderRoute('/executive/command-center', [
      'dashboard.view',
      'alerts.view',
      'alerts.manage',
      'risks.view',
    ]);
    const interaction = userEvent.setup();
    expect(await screen.findByText('تنبيه حرج للتدخل')).toBeTruthy();
    await interaction.click(screen.getByRole('button', { name: 'إثبات الاطلاع' }));
    expect(await screen.findByText('تم تحديث التنبيه وتسجيل الإجراء بنجاح.')).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) =>
          String(input).includes(`/executive/alerts/${criticalAlert.id}/acknowledge`) &&
          init?.method === 'POST',
      ),
    ).toBe(true);

    cleanup();
    clearExecutiveDashboardCache();
    clearExecutiveInsightCache();
    renderRoute('/executive/command-center', ['dashboard.view', 'alerts.view']);
    expect(await screen.findByText('تنبيه حرج للتدخل')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'إثبات الاطلاع' })).toBeNull();
  });

  it('renders initiative and KPI exceptions without inferring missing values', async () => {
    renderRoute('/executive/command-center', [
      'dashboard.view',
      'initiatives.view',
      'initiatives.manage',
      'kpi.view',
      'kpi.measure',
    ]);
    expect((await screen.findAllByText('مبادرة التحول التشغيلي')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('رفع الكفاءة').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'تحديث التقدم' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('نسبة اكتمال المبادرات').length).toBeGreaterThan(0);
    expect(screen.getAllByText('مؤشر بلا قياس حالي').length).toBeGreaterThan(0);
    expect(screen.getAllByText(MISSING_VALUE).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'تسجيل قياس' }).length).toBeGreaterThan(0);
  });

  it('supports keyboard and touch risk-cell selection and filters the critical list', async () => {
    renderRoute('/executive/command-center', ['dashboard.view', 'risks.view']);
    const interaction = userEvent.setup();
    const cell = await screen.findByRole('button', {
      name: /ممكن، جسيم: 1 مخاطر، درجة 12/,
    });
    expect(screen.getByText('خطر استمرارية الخدمة')).toBeTruthy();
    expect(screen.getByText('خطر تعطل مورد')).toBeTruthy();
    await interaction.click(cell);
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText('خطر استمرارية الخدمة')).toBeTruthy();
    expect(screen.queryByText('خطر تعطل مورد')).toBeNull();
    fireEvent.keyDown(cell, { key: 'ArrowDown' });
    expect((document.activeElement as HTMLElement).getAttribute('aria-label')).toContain(
      'مرجح، جسيم',
    );
    expect(screen.getByText(/حد الخطر الحرج المعتمد.*١٥/)).toBeTruthy();
  });

  it('groups only approved deadlines and calculates initiative variance safely', async () => {
    expect(calculateInitiativeVariance(100, 130)).toEqual({
      amount: -30,
      percentage: -30,
    });
    expect(calculateInitiativeVariance(0, 5)).toEqual({ amount: -5, percentage: null });
    expect(calculateInitiativeVariance(null, 5)).toEqual({
      amount: null,
      percentage: null,
    });

    renderRoute('/executive/command-center', ['dashboard.view', 'initiatives.view', 'risks.view']);
    expect(await screen.findByText('مبادرة مستحقة اليوم')).toBeTruthy();
    expect(screen.getByText('معالجة خطر خلال خمسة أيام')).toBeTruthy();
    expect(screen.getByText('مبادرة خلال عشرين يومًا')).toBeTruthy();
    expect(
      screen.getByText('التغطية المعتمدة محصورة في المبادرات التشغيلية ومعالجات المخاطر.'),
    ).toBeTruthy();
    expect(screen.getByText(/ولا تُحسب عندما يساوي المقام صفرًا/)).toBeTruthy();
  });

  it('renders recommendation success and insufficient-evidence separation', async () => {
    const interaction = userEvent.setup();
    renderRoute('/executive/command-center', ['dashboard.view', 'executive_ai.recommendations']);
    await screen.findByRole('heading', { name: 'مركز القيادة التنفيذي' });
    await interaction.type(
      screen.getByLabelText('موضوع التوصيات التنفيذية'),
      'معالجة مخاطر الاستمرارية',
    );
    await interaction.click(screen.getByRole('button', { name: 'إنشاء التوصيات التنفيذية' }));
    expect(await screen.findByText('الصياغة التنفيذية المهنية')).toBeTruthy();
    expect(screen.getByText('الاقتباسات الداعمة — منفصلة عن الصياغة')).toBeTruthy();
    expect(screen.getByRole('link', { name: /تقرير الأداء المتاح/ })).toBeTruthy();

    cleanup();
    clearExecutiveDashboardCache();
    clearExecutiveInsightCache();
    renderRoute('/executive/command-center', ['dashboard.view', 'executive_ai.recommendations'], {
      insufficientEvidence: true,
    });
    await interaction.type(
      await screen.findByLabelText('موضوع التوصيات التنفيذية'),
      'موضوع بلا أدلة',
    );
    await interaction.click(screen.getByRole('button', { name: 'إنشاء التوصيات التنفيذية' }));
    expect(await screen.findByText('الأدلة غير كافية')).toBeTruthy();
    expect(screen.getByText('لا تتوفر أدلة مؤسسية كافية لإعداد صياغة مسؤولة.')).toBeTruthy();
  });

  it('retains the writing input on rate limits and isolates partial API failures', async () => {
    const interaction = userEvent.setup();
    renderRoute(
      '/executive/command-center',
      ['dashboard.view', 'initiatives.view', 'risks.view', 'executive_ai.recommendations'],
      {
        fail: new Set(['/executive/risks/heat-matrix']),
        writingStatus: 429,
      },
    );
    expect((await screen.findAllByText('مبادرة التحول التشغيلي')).length).toBeGreaterThan(0);
    expect(screen.getByText('تعذر تحميل /executive/risks/heat-matrix')).toBeTruthy();
    const field = screen.getByLabelText('موضوع التوصيات التنفيذية');
    await interaction.type(field, 'موضوع محفوظ عند الخطأ');
    await interaction.click(screen.getByRole('button', { name: 'إنشاء التوصيات التنفيذية' }));
    expect(await screen.findByText('تم بلوغ حد الطلبات. أعد المحاولة لاحقًا.')).toBeTruthy();
    expect((field as HTMLTextAreaElement).value).toBe('موضوع محفوظ عند الخطأ');
  });

  it('retains approved values and timestamps when manual refresh partially fails', async () => {
    const interaction = userEvent.setup();
    renderRoute('/executive/command-center', ['dashboard.view', 'initiatives.view'], {
      dashboardFailureAfter: 1,
    });
    expect((await screen.findAllByText('مبادرة التحول التشغيلي')).length).toBeGreaterThan(0);
    await interaction.click(screen.getByRole('button', { name: 'تحديث المركز' }));
    expect(await screen.findByText('تعذر التحديث', { selector: 'strong' })).toBeTruthy();
    expect(screen.getAllByText('مبادرة التحول التشغيلي').length).toBeGreaterThan(0);
    expect(screen.getByText(/تم الاحتفاظ بآخر قيم ناجحة/)).toBeTruthy();
  });

  it('builds the factual Today brief with local-day grouping and confidentiality-safe queues', async () => {
    renderRoute('/executive/today', [
      'dashboard.view',
      'alerts.view',
      'risks.view',
      'initiatives.view',
      'document_analysis.view',
      'documents.view',
      'audit.view',
    ]);
    expect(await screen.findByRole('heading', { name: 'اليوم في الجمعية' })).toBeTruthy();
    expect(screen.getByText('٧٦')).toBeTruthy();
    expect(screen.getByLabelText('تغطية القياس 83%')).toBeTruthy();
    expect(screen.getByText('تنبيه يومي مرتفع')).toBeTruthy();
    expect(screen.getByText('معالجة خطر خلال خمسة أيام')).toBeTruthy();
    expect(screen.getAllByText('تقرير الأداء المتاح').length).toBeGreaterThan(0);
    expect(screen.queryByText('وثيقة شديدة السرية')).toBeNull();
    expect(screen.getByText('بانتظار المراجعة')).toBeTruthy();
    expect(screen.getByText('تحديث معالجة خطر')).toBeTruthy();
    expect(screen.getByText(`بواسطة ${user.fullName}`)).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'نطاق الموجز اليومي المعتمد' })).toBeTruthy();
    expect(screen.getByText(/لا يدّعي هذا الإصدار تغطية الاجتماعات/)).toBeTruthy();
  });

  it('paginates activity and renders daily brief success, refusal, and error retention', async () => {
    const interaction = userEvent.setup();
    renderRoute('/executive/today', ['dashboard.view', 'executive_ai.reports']);
    expect(await screen.findByText('تحديث معالجة خطر')).toBeTruthy();
    await interaction.click(screen.getByRole('button', { name: 'تحميل نشاط إضافي' }));
    expect(await screen.findByText('تحديث تقدم مبادرة')).toBeTruthy();
    const field = screen.getByLabelText('موضوع الموجز التنفيذي اليومي');
    await interaction.type(field, 'موجز اليوم لاتخاذ القرار');
    await interaction.click(screen.getByRole('button', { name: 'إنشاء الموجز التنفيذي اليومي' }));
    expect(await screen.findByText('الصياغة التنفيذية المهنية')).toBeTruthy();

    cleanup();
    clearExecutiveDashboardCache();
    clearExecutiveInsightCache();
    renderRoute('/executive/today', ['dashboard.view', 'executive_ai.reports'], {
      writingStatus: 500,
    });
    const retained = await screen.findByLabelText('موضوع الموجز التنفيذي اليومي');
    await interaction.type(retained, 'يبقى هذا الموضوع بعد الخطأ');
    await interaction.click(screen.getByRole('button', { name: 'إنشاء الموجز التنفيذي اليومي' }));
    expect(await screen.findByText('تعذر إنشاء الصياغة.')).toBeTruthy();
    expect((retained as HTMLTextAreaElement).value).toBe('يبقى هذا الموضوع بعد الخطأ');

    cleanup();
    clearExecutiveDashboardCache();
    clearExecutiveInsightCache();
    renderRoute('/executive/today', ['dashboard.view', 'executive_ai.reports'], {
      insufficientEvidence: true,
    });
    const refused = await screen.findByLabelText('موضوع الموجز التنفيذي اليومي');
    await interaction.type(refused, 'موضوع لا تدعمه الأدلة المؤسسية');
    await interaction.click(screen.getByRole('button', { name: 'إنشاء الموجز التنفيذي اليومي' }));
    expect(await screen.findByText('الأدلة غير كافية')).toBeTruthy();
    expect(screen.getByText('لا تتوفر أدلة مؤسسية كافية لإعداد صياغة مسؤولة.')).toBeTruthy();
  });

  it('clears protected insight data on logout before a new authenticated navigation', async () => {
    const interaction = userEvent.setup();
    const fetchMock = renderRoute('/executive/command-center', [
      'dashboard.view',
      'initiatives.view',
    ]);
    expect((await screen.findAllByText('مبادرة التحول التشغيلي')).length).toBeGreaterThan(0);
    const initialInitiativeCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/executive/initiatives'),
    ).length;
    expect(initialInitiativeCalls).toBeGreaterThan(0);

    await interaction.click(screen.getAllByRole('button', { name: 'تسجيل الخروج' })[0]!);
    await interaction.type(await screen.findByLabelText('البريد الإلكتروني'), 'ceo@example.test');
    await interaction.type(screen.getByLabelText('كلمة المرور'), 'secure-password');
    await interaction.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    await interaction.click(
      (await screen.findAllByRole('link', { name: /مركز القيادة التنفيذي/ }))[0]!,
    );
    expect((await screen.findAllByText('مبادرة التحول التشغيلي')).length).toBeGreaterThan(0);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes('/executive/initiatives')),
    ).toHaveLength(initialInitiativeCalls * 2);
  });

  it('renders the executive shell in RTL with the governed mobile navigation', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 360 });
    window.dispatchEvent(new Event('resize'));
    renderRoute('/executive/today', ['dashboard.view']);
    await screen.findByRole('heading', { name: 'اليوم في الجمعية' });
    expect(document.querySelector('.ex-shell')?.getAttribute('dir')).toBe('rtl');
    expect(screen.getByRole('navigation', { name: 'التنقل السريع' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'فتح قائمة التنقل' })).toBeTruthy();
  });

  it('integrates both routes in sidebar, mobile navigation, Smart Bar, and Home drill-downs', async () => {
    renderRoute('/', ['dashboard.view', 'alerts.view', 'initiatives.view', 'risks.view']);
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });
    expect(screen.getAllByRole('link', { name: /مركز القيادة التنفيذي/ }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByRole('link', { name: /اليوم في الجمعية/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'فتح موجز اليوم' }).getAttribute('href')).toBe(
      '/executive/today',
    );
    expect(screen.getByRole('link', { name: 'فتح مركز القيادة' }).getAttribute('href')).toBe(
      '/executive/command-center?queue=alerts',
    );
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    expect(within(dialog).getByText('مركز القيادة التنفيذي')).toBeTruthy();
    expect(within(dialog).getByText('اليوم في الجمعية')).toBeTruthy();
  });
});
