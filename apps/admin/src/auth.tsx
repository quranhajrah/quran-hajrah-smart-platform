import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setAccessToken, type AuthPayload, type User } from './api';
import { clearExecutiveDashboardCache } from './executive-dashboard-data';
import { clearExecutiveInsightCache } from './executive-insights-data';

type AuthValue = {
  user: User | null;
  permissions: string[];
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  can(permission: string): boolean;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const applyAuth = useCallback((payload: AuthPayload | null) => {
    clearExecutiveDashboardCache();
    clearExecutiveInsightCache();
    setAccessToken(payload?.accessToken ?? null);
    setUser(payload?.user ?? null);
    setPermissions(payload?.permissions ?? []);
  }, []);

  useEffect(() => {
    api<AuthPayload>('/auth/refresh', { method: 'POST' })
      .then(applyAuth)
      .catch(() => applyAuth(null))
      .finally(() => setLoading(false));
  }, [applyAuth]);

  useEffect(() => {
    const clearProtectedCaches = () => {
      clearExecutiveDashboardCache();
      clearExecutiveInsightCache();
    };
    window.addEventListener('executive-authorization-failure', clearProtectedCaches);
    return () =>
      window.removeEventListener('executive-authorization-failure', clearProtectedCaches);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      permissions,
      loading,
      async login(email, password) {
        applyAuth(
          await api<AuthPayload>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }),
        );
      },
      async logout() {
        try {
          await api('/auth/logout', { method: 'POST' });
        } finally {
          applyAuth(null);
        }
      },
      can: (permission) => permissions.includes(permission),
    }),
    [applyAuth, loading, permissions, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is missing.');
  return value;
};
