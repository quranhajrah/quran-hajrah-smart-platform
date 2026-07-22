export type Role = { id: string; name: string; displayName: string; isSystem: boolean; permissions: string[] };
export type User = { id: string; fullName: string; email: string; phone?: string; jobTitle?: string; isActive: boolean; roles: Role[] };
export type AuthPayload = { accessToken: string; user: User; permissions: string[] };

const baseUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '/api' : 'http://localhost:3000/api');
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => { accessToken = token; };

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? 'تعذر إكمال الطلب.');
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
