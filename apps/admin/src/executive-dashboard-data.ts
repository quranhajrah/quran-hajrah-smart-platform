import { api, ApiRequestError, type ExecutiveDashboard } from './api';

type DashboardCacheEntry = {
  userId: string;
  value: ExecutiveDashboard;
  loadedAt: string;
  expiresAt: number;
};

export type ExecutiveDashboardSnapshot = {
  value: ExecutiveDashboard;
  loadedAt: string;
};

const CACHE_DURATION_MS = 30_000;
let cache: DashboardCacheEntry | null = null;
let pending: {
  userId: string;
  request: Promise<ExecutiveDashboardSnapshot>;
} | null = null;

export function clearExecutiveDashboardCache() {
  cache = null;
  pending = null;
}

export function loadExecutiveDashboard(
  userId: string,
  options: { force?: boolean } = {},
): Promise<ExecutiveDashboardSnapshot> {
  if (!options.force && cache?.userId === userId && cache.expiresAt > Date.now()) {
    return Promise.resolve({ value: cache.value, loadedAt: cache.loadedAt });
  }

  if (!options.force && pending?.userId === userId) return pending.request;

  const request = api<ExecutiveDashboard>('/executive/dashboard')
    .then((value) => {
      const loadedAt = new Date().toISOString();
      cache = {
        userId,
        value,
        loadedAt,
        expiresAt: Date.now() + CACHE_DURATION_MS,
      };
      return { value, loadedAt };
    })
    .catch((error: unknown) => {
      if (
        error instanceof ApiRequestError &&
        ['FORBIDDEN', 'INVALID_SESSION', 'AUTHENTICATION_REQUIRED'].includes(error.code ?? '')
      ) {
        clearExecutiveDashboardCache();
        window.dispatchEvent(new Event('executive-authorization-failure'));
      }
      throw error;
    })
    .finally(() => {
      if (pending?.request === request) pending = null;
    });

  pending = { userId, request };
  return request;
}
