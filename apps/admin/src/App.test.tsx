// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const admin = {
  id: '10000000-0000-4000-8000-000000000001',
  fullName: 'مدير الاختبار',
  email: 'admin@example.test',
  isActive: true,
  roles: [
    {
      id: '20000000-0000-4000-8000-000000000001',
      name: 'super_admin',
      displayName: 'مدير النظام العام',
      isSystem: true,
      permissions: ['dashboard.view', 'users.view'],
    },
  ],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('admin authentication flow', () => {
  it('logs in, passes the route guard, and loads users from the API', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ error: {} }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/auth/login')) {
        return new Response(
          JSON.stringify({
            accessToken: 'test-access-token',
            user: admin,
            permissions: ['dashboard.view', 'users.view'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.includes('/users?')) {
        return new Response(JSON.stringify({ items: [admin], total: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.endsWith('/executive/dashboard')) {
        return new Response(
          JSON.stringify({
            summary: {
              documents: { total: 0, active: 0, underReview: 0, expiring: 0, archived: 0 },
              activeUsers: 1,
              recentSystemActivity: 0,
              objectives: { total: 0, averageProgress: null },
              kpis: {},
              initiatives: {
                total: 0,
                active: 0,
                delayed: 0,
                atRisk: 0,
                completed: 0,
                plannedBudget: 0,
                actualSpending: 0,
                budgetVariance: { amount: 0, percentage: null },
              },
              risks: { open: 0, critical: 0, averageResidualScore: null },
            },
            associationIndicators: {},
            institutionalMetrics: {},
            health: {
              score: null,
              coverage: 0,
              rating: null,
              components: [],
              missingData: ['governance'],
              explanation: 'البيانات غير مكتملة.',
            },
            recentDocuments: [],
            recentActivities: [],
            alerts: [],
            upcomingDeadlines: [],
            quickActions: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ error: {} }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText('البريد الإلكتروني'), admin.email);
    await user.type(screen.getByLabelText('كلمة المرور'), 'ValidPassword123');
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    await user.click(await screen.findByRole('link', { name: 'المستخدمون' }));

    expect(await screen.findByRole('heading', { name: 'المستخدمون' })).toBeTruthy();
    expect(await screen.findByText(admin.email)).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/users?'),
        expect.any(Object),
      ),
    );
  });

  it('renders the Arabic Knowledge Center from live API responses', async () => {
    window.history.replaceState({}, '', '/documents');
    const category = {
      id: '30000000-0000-4000-8000-000000000001',
      name: 'التقارير',
      slug: 'reports',
      sortOrder: 0,
    };
    const owningDepartment = {
      id: '31000000-0000-4000-8000-000000000001',
      name: 'الإدارة التنفيذية',
      slug: 'executive-management',
      sortOrder: 0,
    };
    const document = {
      id: '40000000-0000-4000-8000-000000000001',
      title: 'التقرير السنوي',
      categoryId: category.id,
      category,
      documentType: 'REPORT',
      versionNumber: 1,
      status: 'ACTIVE',
      confidentialityLevel: 'INTERNAL',
      owningDepartment: 'الإدارة التنفيذية',
      keywords: [],
      isArchived: false,
      hasFile: true,
      tags: [],
      createdBy: { id: admin.id, fullName: admin.fullName },
      updatedBy: { id: admin.id, fullName: admin.fullName },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.endsWith('/auth/refresh')) {
        return json({
          accessToken: 'test-access-token',
          user: admin,
          permissions: ['documents.view', 'documents.create'],
        });
      }
      if (url.endsWith('/documents/dashboard')) {
        return json({
          total: 1,
          active: 1,
          underReview: 0,
          expiring: 0,
          archived: 0,
          recent: [document],
        });
      }
      if (url.endsWith('/document-lookups')) {
        return json({ categories: [category], owningDepartments: [owningDepartment] });
      }
      if (url.includes('/documents?')) return json({ items: [document], total: 1 });
      if (url.endsWith('/documents') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'تعذر التحقق من بيانات الطلب. راجع الحقول الموضحة.',
              fields: [
                {
                  field: 'categoryId',
                  label: 'التصنيف',
                  code: 'invalid_string',
                  message: 'التصنيف: التنسيق غير صحيح.',
                },
              ],
            },
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ error: {} }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'مركز المعرفة المؤسسية' })).toBeTruthy();
    expect(await screen.findAllByText('التقرير السنوي')).not.toHaveLength(0);
    const uploadButton = await screen.findByRole('button', { name: '+ رفع مستند' });
    expect(uploadButton).not.toHaveProperty('disabled', true);
    await user.click(uploadButton);
    expect(screen.getByLabelText('التصنيف').querySelectorAll('option')).toHaveLength(2);
    expect(screen.getByLabelText('الإدارة المالكة').querySelectorAll('option')).toHaveLength(2);
    expect(screen.getByRole('option', { name: 'الإدارة التنفيذية' })).toBeTruthy();
    await user.type(screen.getByLabelText('عنوان المستند'), 'الخطة الاستراتيجية');
    await user.selectOptions(screen.getByLabelText('التصنيف'), category.id);
    await user.selectOptions(screen.getByLabelText('نوع المستند'), 'STRATEGIC_PLAN');
    await user.selectOptions(screen.getByLabelText('الإدارة المالكة'), owningDepartment.name);
    await user.type(screen.getByLabelText('رقم المستند'), 'SP-2026-01');
    await user.selectOptions(screen.getByLabelText('الحالة'), 'ACTIVE');
    await user.type(screen.getByLabelText('الوصف'), 'الخطة الاستراتيجية المعتمدة.');
    await user.type(
      screen.getByLabelText('الكلمات المفتاحية'),
      'الخطة الاستراتيجية، الأهداف المؤسسية',
    );
    await user.type(screen.getByLabelText('الوسوم'), 'استراتيجية; اعتماد');
    await user.upload(
      screen.getByLabelText(/الملف/),
      new window.File(['%PDF-1.7\nstrategic-plan'], 'الخطة الاستراتيجية.pdf', {
        type: 'application/pdf',
      }),
    );
    const submitButton = screen.getByRole('button', { name: 'حفظ ورفع المستند' });
    fireEvent.submit(submitButton.closest('form')!);
    expect(await screen.findByText('التصنيف: التنسيق غير صحيح.')).toBeTruthy();
    const createCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).endsWith('/documents') && init?.method === 'POST',
    );
    expect(JSON.parse(String(createCall?.[1]?.body))).toEqual({
      title: 'الخطة الاستراتيجية',
      description: 'الخطة الاستراتيجية المعتمدة.',
      categoryId: category.id,
      documentType: 'STRATEGIC_PLAN',
      documentNumber: 'SP-2026-01',
      status: 'ACTIVE',
      confidentialityLevel: 'INTERNAL',
      owningDepartment: owningDepartment.name,
      keywords: ['الخطة الاستراتيجية', 'الأهداف المؤسسية'],
      tags: ['استراتيجية', 'اعتماد'],
    });
  });

  it('renders the executive dashboard without invented association statistics', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.endsWith('/auth/refresh')) {
        return json({
          accessToken: 'test-access-token',
          user: admin,
          permissions: ['dashboard.view', 'executive.query', 'executive_ai.use'],
        });
      }
      if (url.endsWith('/executive/dashboard')) {
        return json({
          summary: {
            documents: { total: 3, active: 2, underReview: 1, expiring: 0, archived: 0 },
            activeUsers: 1,
            recentSystemActivity: 0,
            objectives: { total: 0, averageProgress: null },
            kpis: {},
            initiatives: {
              total: 0,
              active: 0,
              delayed: 0,
              atRisk: 0,
              completed: 0,
              plannedBudget: 0,
              actualSpending: 0,
              budgetVariance: { amount: 0, percentage: null },
            },
            risks: { open: 0, critical: 0, averageResidualScore: null },
          },
          associationIndicators: {
            beneficiaries_total: null,
            students_male: null,
            students_female: null,
            teachers_male: null,
            teachers_female: null,
            circles_in_person: null,
            circles_remote: null,
            memorized_pages_weekly: null,
            memorized_pages_monthly: null,
            completed_parts: null,
            attendance_rate: null,
            retention_rate: null,
          },
          institutionalMetrics: {},
          health: {
            score: null,
            coverage: 0,
            rating: null,
            components: [],
            missingData: ['governance'],
            explanation: 'لا تتوفر بيانات كافية.',
          },
          recentDocuments: [],
          recentActivities: [],
          alerts: [],
          upcomingDeadlines: [],
          quickActions: [],
        });
      }
      return new Response(JSON.stringify({ error: {} }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'لوحة القيادة التنفيذية' })).toBeTruthy();
    expect(await screen.findByText('مساعد تنفيذي — إصدار البيانات المؤسسية')).toBeTruthy();
    expect((await screen.findAllByText('لا توجد بيانات معتمدة')).length).toBeGreaterThan(0);
  });

  it('applies and preserves governed registry filters from executive journey links', async () => {
    const objectiveId = '30000000-0000-4000-8000-000000000026';
    window.history.replaceState(
      {},
      '',
      `/executive/kpis?status=OFF_TRACK&objectiveId=${objectiveId}`,
    );
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.endsWith('/auth/refresh')) {
        return json({
          accessToken: 'test-access-token',
          user: admin,
          permissions: ['kpi.view'],
        });
      }
      if (url.includes('/executive/kpis?')) {
        return json({ items: [], total: 0, page: 1, pageSize: 20 });
      }
      return json({ error: { code: 'NOT_FOUND' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const interaction = userEvent.setup();

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'إدارة مؤشرات الأداء' })).toBeTruthy();
    expect((screen.getByLabelText('تصفية الحالة') as HTMLSelectElement).value).toBe('OFF_TRACK');
    expect(screen.getByText('يعرض السجل العناصر المرتبطة بالهدف المحدد.')).toBeTruthy();
    await waitFor(() => {
      const registryCall = fetchMock.mock.calls.find(([input]) =>
        String(input).includes('/executive/kpis?'),
      );
      const url = new URL(String(registryCall?.[0]));
      expect(url.searchParams.get('status')).toBe('OFF_TRACK');
      expect(url.searchParams.get('objectiveId')).toBe(objectiveId);
    });

    await interaction.type(screen.getByLabelText('بحث في السجل'), 'الحضور');
    await waitFor(() => expect(window.location.search).toContain('search=%D8%A7%D9%84%D8%AD'));
    await interaction.click(screen.getByRole('button', { name: 'إلغاء عامل ارتباط الهدف' }));
    await waitFor(() => expect(window.location.search).not.toContain('objectiveId'));
    expect(window.location.search).toContain('status=OFF_TRACK');
  });

  it('keeps an authorized source record visible when optional evidence loading fails', async () => {
    const riskId = '30000000-0000-4000-8000-00000000001d';
    window.history.replaceState({}, '', `/executive/risks/${riskId}`);
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      if (url.endsWith('/auth/refresh')) {
        return json({
          accessToken: 'test-access-token',
          user: admin,
          permissions: ['risks.view', 'document_analysis.view'],
        });
      }
      if (url.endsWith(`/executive/risks/${riskId}`)) {
        return json({
          id: riskId,
          code: 'R-1D',
          title: 'خطر تحقق تشغيلي',
          status: 'UNDER_TREATMENT',
          residualScore: 16,
        });
      }
      if (url.includes('/document-analysis/sources/RISK/')) {
        return json({ error: { code: 'INTERNAL_ERROR' } }, 500);
      }
      return json({ error: { code: 'NOT_FOUND' } }, 404);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'خطر تحقق تشغيلي' })).toBeTruthy();
    expect(
      screen.getByText('تعذر تحميل الأدلة المؤسسية المرتبطة. يستمر عرض السجل الأساسي المصرح به.'),
    ).toBeTruthy();
    expect(screen.queryByText('تعذر تحميل تفاصيل السجل.')).toBeNull();
  });
});
