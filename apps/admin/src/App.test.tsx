// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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
          permissions: ['dashboard.view', 'executive.query'],
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
    expect((await screen.findAllByText('لا توجد بيانات')).length).toBeGreaterThan(0);
  });
});
