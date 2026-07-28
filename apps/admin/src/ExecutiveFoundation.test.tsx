// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { clearExecutiveDashboardCache } from './executive-dashboard-data';

const user = {
  id: '10000000-0000-4000-8000-000000000026',
  fullName: 'الرئيس التنفيذي',
  email: 'ceo@example.test',
  isActive: true,
  roles: [
    {
      id: '20000000-0000-4000-8000-000000000026',
      name: 'ceo',
      displayName: 'الرئيس التنفيذي',
      isSystem: true,
      permissions: [],
    },
  ],
};

const dashboard = {
  summary: {
    documents: { total: 12, active: 9, underReview: 2, expiring: 1, archived: 1 },
    activeUsers: 7,
    recentSystemActivity: 11,
    objectives: { total: 4, averageProgress: 68 },
    kpis: { ON_TRACK: 5, AT_RISK: 2 },
    initiatives: {
      total: 7,
      active: 4,
      delayed: 1,
      atRisk: 1,
      completed: 1,
      plannedBudget: 800_000,
      actualSpending: 420_000,
      budgetVariance: { amount: 380_000, percentage: 47.5 },
    },
    risks: { open: 3, critical: 1, averageResidualScore: 8.4 },
  },
  associationIndicators: {
    beneficiaries_total: {
      id: 'metric-1',
      nameAr: 'إجمالي المستفيدين',
      value: 1240,
      unit: 'مستفيد',
      measuredAt: '2026-07-27T08:00:00.000Z',
    },
    circles_in_person: null,
    circles_remote: null,
    memorized_pages_monthly: null,
    completed_parts: null,
    attendance_rate: null,
  },
  institutionalMetrics: {},
  health: {
    score: 74,
    coverage: 70,
    rating: 'جيد',
    components: [],
    missingData: ['تنفيذ الموازنة', 'اكتمال المعرفة'],
    explanation: 'احتُسبت الدرجة من المكونات المؤسسية المتاحة فقط.',
  },
  documentAnalysis: {
    analyzed: 8,
    awaitingReview: 2,
    awaitingApproval: 1,
    imported: 4,
    failed: 1,
    ocrRequired: 0,
    budget: { records: 1, lines: 4, totalPlanned: 220_000 },
  },
  recentDocuments: [
    {
      id: 'document-secret',
      title: 'وثيقة سرية',
      categoryId: 'category-1',
      category: { id: 'category-1', name: 'حوكمة', slug: 'governance', sortOrder: 0 },
      documentType: 'POLICY',
      versionNumber: 2,
      status: 'ACTIVE',
      confidentialityLevel: 'SECRET',
      owningDepartment: 'مجلس الإدارة',
      keywords: [],
      isArchived: false,
      hasFile: true,
      tags: [],
      createdBy: { id: user.id, fullName: user.fullName },
      updatedBy: { id: user.id, fullName: user.fullName },
      createdAt: '2026-07-20T08:00:00.000Z',
      updatedAt: '2026-07-27T08:00:00.000Z',
    },
  ],
  recentActivities: [],
  alerts: [
    {
      id: 'alert-1',
      title: 'مؤشر يتطلب المتابعة',
      message: 'تجاوز المؤشر حد التحذير المسجل.',
      severity: 'HIGH',
    },
  ],
  upcomingDeadlines: [
    {
      id: 'initiative-1',
      name: 'مبادرة تأهيل المعلمين',
      endDate: '2026-08-10T00:00:00.000Z',
      status: 'ACTIVE',
      module: 'initiatives',
    },
  ],
  quickActions: ['upload_document', 'create_report', 'knowledge_center', 'manage_users'],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function authenticatedFetch(permissions: string[], dashboardResponse: unknown = dashboard) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/auth/refresh')) {
      return json({ accessToken: 'test-token', user, permissions });
    }
    if (url.endsWith('/executive/dashboard')) return json(dashboardResponse);
    return json({ error: { code: 'NOT_FOUND' } }, 404);
  });
}

afterEach(() => {
  cleanup();
  clearExecutiveDashboardCache();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('Sprint 1A executive foundation and home dashboard', () => {
  it('preserves the layout while loading and renders an authorized empty card state', async () => {
    let releaseDashboard!: (response: Response) => void;
    const pendingDashboard = new Promise<Response>((resolve) => {
      releaseDashboard = resolve;
    });
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return json({
          accessToken: 'test-token',
          user,
          permissions: ['dashboard.view', 'alerts.view'],
        });
      }
      if (url.endsWith('/executive/dashboard')) return pendingDashboard;
      return json({ error: { code: 'NOT_FOUND' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByLabelText('جارٍ تحميل لوحة القيادة')).toBeTruthy();
    releaseDashboard(json({ ...dashboard, alerts: [] }));

    expect(await screen.findByText('لا توجد تنبيهات مفتوحة')).toBeTruthy();
    expect(
      screen.getByText('لم تُعد واجهة لوحة القيادة تنبيهات مفتوحة ضمن النطاق الحالي.'),
    ).toBeTruthy();
  });

  it('binds the executive home to one aggregate request and exposes provenance and coverage', async () => {
    const fetchMock = authenticatedFetch([
      'dashboard.view',
      'metrics.view',
      'strategy.view',
      'initiatives.view',
      'risks.view',
      'alerts.view',
      'documents.view',
      'executive_ai.use',
      'knowledge.search',
      'reports.create',
    ]);
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' })).toBeTruthy();
    expect(screen.getAllByText('٧٤')).toHaveLength(2);
    expect(screen.getByLabelText('تغطية القياس 70%')).toBeTruthy();
    expect(screen.getByText(/تنفيذ الموازنة/)).toBeTruthy();
    expect(screen.getByText('١٬٢٤٠ مستفيد')).toBeTruthy();
    expect(screen.getAllByText('لا توجد بيانات معتمدة').length).toBeGreaterThan(0);
    expect(screen.getByText('مبادرة تأهيل المعلمين')).toBeTruthy();
    expect(screen.getByText('مبادرة تأهيل المعلمين').closest('a')?.getAttribute('href')).toBe(
      '/executive/initiatives/initiative-1',
    );
    expect(screen.getAllByText(/المصدر:/).length).toBeGreaterThan(5);

    const aggregateCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith('/executive/dashboard'),
    );
    expect(aggregateCalls).toHaveLength(1);
  });

  it('does not render confidential knowledge or unauthorized smart-bar destinations', async () => {
    const fetchMock = authenticatedFetch(['dashboard.view']);
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });

    expect(screen.queryByText('وثيقة سرية')).toBeNull();
    expect(screen.queryByRole('link', { name: 'الملفات والمعرفة' })).toBeNull();
    expect(screen.queryByText('مساعد تنفيذي — إصدار البيانات المؤسسية')).toBeNull();
    expect(screen.queryByText('مؤشر يتطلب المتابعة')).toBeNull();
    expect(screen.queryByText('مبادرة تأهيل المعلمين')).toBeNull();
    expect(screen.queryByText('١٬٢٤٠ مستفيد')).toBeNull();

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' });
    expect(within(dialog).getByText('حسابي')).toBeTruthy();
    expect(within(dialog).queryByText('الملفات والمعرفة')).toBeNull();
    expect(within(dialog).queryByText('المساعد التنفيذي')).toBeNull();
  });

  it('keeps the last successful snapshot and marks it when a manual refresh fails', async () => {
    let dashboardCalls = 0;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return json({ accessToken: 'test-token', user, permissions: ['dashboard.view'] });
      }
      if (url.endsWith('/executive/dashboard')) {
        dashboardCalls += 1;
        return dashboardCalls === 1
          ? json(dashboard)
          : json({ error: { code: 'INTERNAL_ERROR' } }, 500);
      }
      return json({ error: { code: 'NOT_FOUND' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    const interaction = userEvent.setup();

    render(<App />);
    expect(await screen.findAllByText('٧٤')).toHaveLength(2);
    await interaction.click(screen.getByRole('button', { name: 'تحديث البيانات' }));

    expect(await screen.findByText('تعذر التحديث', { selector: 'strong' })).toBeTruthy();
    expect(screen.getAllByText('٧٤')).toHaveLength(2);
    expect(dashboardCalls).toBe(2);
  });

  it('provides a retryable full-page error without fabricating dashboard values', async () => {
    const fetchMock = authenticatedFetch(['dashboard.view'], { error: { code: 'INTERNAL_ERROR' } });
    fetchMock.mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return json({ accessToken: 'test-token', user, permissions: ['dashboard.view'] });
      }
      return json({ error: { code: 'INTERNAL_ERROR' } }, 500);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(
      await screen.findByText('تعذر تحميل المشهد التنفيذي. تحقق من الاتصال ثم أعد المحاولة.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'إعادة المحاولة' })).toBeTruthy();
    expect(screen.queryByText('٧٤')).toBeNull();
  });

  it('renders the responsive navigation affordances and keeps smart bar routing-only', async () => {
    const fetchMock = authenticatedFetch([
      'dashboard.view',
      'metrics.view',
      'documents.view',
      'executive_ai.use',
    ]);
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' });

    expect(screen.getByRole('navigation', { name: 'التنقل الرئيسي' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'التنقل السريع' })).toBeTruthy();
    const requestCountBeforeSmartBar = fetchMock.mock.calls.length;
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(await screen.findByRole('dialog', { name: 'شريط الانتقال التنفيذي' })).toBeTruthy();
    expect(fetchMock.mock.calls).toHaveLength(requestCountBeforeSmartBar);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/executive/dashboard')),
      ).toHaveLength(1),
    );
  });
});
