import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { api, type Role, type User } from './api';
import { AuthProvider, useAuth } from './auth';
import { DocumentDetails, DocumentsCenter } from './Documents';

function Guard({ children, permission }: { children: ReactNode; permission?: string }) {
  const { user, loading, can } = useAuth();
  if (loading) return <Status text="جارٍ التحقق من الجلسة…" />;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !can(permission))
    return <Status text="لا تملك صلاحية الوصول إلى هذه الصفحة." error />;
  return children;
}

function Status({ text, error = false }: { text: string; error?: boolean }) {
  return <div className={error ? 'status error' : 'status'}>{text}</div>;
}

function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await login(String(form.get('email')), String(form.get('password')));
      navigate('/');
    } catch {
      setError('تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">ق</div>
        <h1>منصة قرآن الهجرة الذكية</h1>
        <p>بوابة الإدارة الآمنة</p>
        <form onSubmit={submit}>
          <label>
            البريد الإلكتروني
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            كلمة المرور
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          {error && <Status text={error} error />}
          <button disabled={busy}>{busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}</button>
        </form>
      </section>
    </main>
  );
}

function Layout({ children }: { children: ReactNode }) {
  const { user, can, logout } = useAuth();
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span>ق</span>
          <strong>قرآن الهجرة</strong>
        </div>
        <nav>
          <NavLink to="/">الرئيسية</NavLink>
          {can('documents.view') && <NavLink to="/documents">مركز المعرفة</NavLink>}
          <NavLink to="/account">حسابي</NavLink>
          {can('users.view') && <NavLink to="/users">المستخدمون</NavLink>}
          {can('roles.view') && <NavLink to="/roles">الأدوار والصلاحيات</NavLink>}
          {can('audit.view') && <NavLink to="/audit">سجل العمليات</NavLink>}
        </nav>
        <button className="secondary" onClick={() => void logout()}>
          تسجيل الخروج
        </button>
      </aside>
      <main className="content">
        <header>
          <div>
            <small>مرحبًا</small>
            <strong>{user?.fullName}</strong>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="page">
      <div className="page-title">
        <h1>{title}</h1>
      </div>
      {children}
    </section>
  );
}

function Welcome() {
  const { can } = useAuth();
  return (
    <Page title="مرحبًا بك">
      <div className="welcome">
        <h2>منصة الإدارة المؤسسية</h2>
        <p>اختر من القائمة للوصول إلى الخدمات المتاحة لك.</p>
        {can('documents.view') && (
          <NavLink className="welcome-action" to="/documents">
            فتح مركز المعرفة المؤسسية
          </NavLink>
        )}
      </div>
    </Page>
  );
}

function Account() {
  const { user } = useAuth();
  return (
    <Page title="حسابي">
      <div className="card details">
        <div>
          <span>الاسم</span>
          <strong>{user?.fullName}</strong>
        </div>
        <div>
          <span>البريد</span>
          <strong>{user?.email}</strong>
        </div>
        <div>
          <span>المسمى الوظيفي</span>
          <strong>{user?.jobTitle || 'غير محدد'}</strong>
        </div>
        <div>
          <span>الأدوار</span>
          <strong>{user?.roles.map((role) => role.displayName).join('، ') || 'لا يوجد'}</strong>
        </div>
      </div>
    </Page>
  );
}

function Users() {
  const [items, setItems] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const query = new URLSearchParams({
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError('');
      api<{ items: User[] }>(`/users?${query}`)
        .then((data) => setItems(data.items))
        .catch(() => setError('تعذر تحميل المستخدمين.'))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search, status]);
  return (
    <Page title="المستخدمون">
      <div className="filters">
        <input
          aria-label="بحث"
          placeholder="بحث بالاسم أو البريد"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          aria-label="الحالة"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">معطل</option>
        </select>
      </div>
      {loading ? (
        <Status text="جارٍ التحميل…" />
      ) : error ? (
        <Status text={error} error />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>المسمى</th>
                <th>الأدوار</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {items.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.fullName}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>{user.jobTitle || '—'}</td>
                  <td>{user.roles.map((role) => role.displayName).join('، ') || '—'}</td>
                  <td>
                    <span className={user.isActive ? 'badge active' : 'badge'}>
                      {user.isActive ? 'نشط' : 'معطل'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Status text="لا توجد نتائج." />}
        </div>
      )}
    </Page>
  );
}

function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<
    Array<{ id: string; code: string; displayName: string; module: string }>
  >([]);
  const [error, setError] = useState('');
  useEffect(() => {
    Promise.all([
      api<Role[]>('/roles'),
      api<Array<{ id: string; code: string; displayName: string; module: string }>>('/permissions'),
    ])
      .then(([nextRoles, nextPermissions]) => {
        setRoles(nextRoles);
        setPermissions(nextPermissions);
      })
      .catch(() => setError('تعذر تحميل الأدوار والصلاحيات.'));
  }, []);
  return (
    <Page title="الأدوار والصلاحيات">
      {error ? (
        <Status text={error} error />
      ) : (
        <div className="role-grid">
          {roles.map((role) => (
            <article className="card" key={role.id}>
              <div className="role-heading">
                <h2>{role.displayName}</h2>
                {role.isSystem && <span className="badge active">نظامي</span>}
              </div>
              <small>{role.name}</small>
              <ul>
                {role.permissions.map((code) => (
                  <li key={code}>
                    {permissions.find((permission) => permission.code === code)?.displayName ??
                      code}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </Page>
  );
}

function Audit() {
  const [items, setItems] = useState<
    Array<{
      id: string;
      action: string;
      description: string;
      createdAt: string;
      user?: { fullName: string };
    }>
  >([]);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ items: typeof items }>('/audit')
      .then((data) => setItems(data.items))
      .catch(() => setError('تعذر تحميل سجل العمليات.'));
  }, []);
  return (
    <Page title="سجل العمليات">
      {error ? (
        <Status text={error} error />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>العملية</th>
                <th>الوصف</th>
                <th>المستخدم</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.action}</td>
                  <td>{item.description}</td>
                  <td>{item.user?.fullName || 'النظام'}</td>
                  <td>{new Date(item.createdAt).toLocaleString('ar-SA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Status text="لا توجد عمليات مسجلة." />}
        </div>
      )}
    </Page>
  );
}

function ProtectedPage({ children, permission }: { children: ReactNode; permission?: string }) {
  return (
    <Guard permission={permission}>
      <Layout>{children}</Layout>
    </Guard>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedPage>
                <Welcome />
              </ProtectedPage>
            }
          />
          <Route
            path="/documents"
            element={
              <ProtectedPage permission="documents.view">
                <DocumentsCenter />
              </ProtectedPage>
            }
          />
          <Route
            path="/documents/:id"
            element={
              <ProtectedPage permission="documents.view">
                <DocumentDetails />
              </ProtectedPage>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedPage>
                <Account />
              </ProtectedPage>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedPage permission="users.view">
                <Users />
              </ProtectedPage>
            }
          />
          <Route
            path="/roles"
            element={
              <ProtectedPage permission="roles.view">
                <Roles />
              </ProtectedPage>
            }
          />
          <Route
            path="/audit"
            element={
              <ProtectedPage permission="audit.view">
                <Audit />
              </ProtectedPage>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
