// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

const admin = {
  id: '10000000-0000-4000-8000-000000000001',
  fullName: 'مدير الاختبار',
  email: 'admin@example.test',
  isActive: true,
  roles: [{ id: '20000000-0000-4000-8000-000000000001', name: 'super_admin', displayName: 'مدير النظام العام', isSystem: true, permissions: ['users.view'] }],
};

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });

describe('admin authentication flow', () => {
  it('logs in, passes the route guard, and loads users from the API', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) return new Response(JSON.stringify({ error: {} }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      if (url.endsWith('/auth/login')) return new Response(JSON.stringify({ accessToken: 'test-access-token', user: admin, permissions: ['users.view'] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.includes('/users?')) return new Response(JSON.stringify({ items: [admin], total: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: {} }), { status: 404, headers: { 'Content-Type': 'application/json' } });
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
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/users?'), expect.any(Object)));
  });
});
