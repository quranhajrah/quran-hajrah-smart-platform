import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { loadConfig, type AppConfig } from './config.js';

const temporaryDirectories: string[] = [];
const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  nodeEnv: 'production', isProduction: true, port: 3000,
  adminOrigin: 'https://app.example.test', portalOrigin: 'https://app.example.test',
  corsOrigins: ['https://app.example.test'],
  accessTokenSecret: 'test-only-access-secret-that-is-longer-than-32-characters',
  refreshTokenSecret: 'test-only-refresh-and-session-secret-that-is-longer-than-64-characters-total',
  accessTokenTtl: '15m', refreshTokenTtlMs: 604_800_000,
  cookieName: 'test_refresh', cookieSecure: true, cookieSameSite: 'lax', bcryptRounds: 4,
  trustProxy: 1, logLevel: 'silent', rateLimitWindowMs: 60_000, rateLimitMax: 300,
  adminDistPath: 'missing-admin-dist', portalDistPath: 'missing-portal-dist',
  ...overrides,
});

const productionEnvironment = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'test-only-access-secret-that-is-longer-than-32-characters',
  JWT_REFRESH_SECRET: 'test-only-refresh-secret-that-is-longer-than-32-characters',
  SESSION_SECRET: 'test-only-session-secret-that-is-longer-than-32-characters',
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:5432/test',
  DIRECT_URL: 'postgresql://test:test@127.0.0.1:5432/test',
  ADMIN_ORIGIN: 'https://app.example.test',
  PORTAL_ORIGIN: 'https://app.example.test',
  CORS_ORIGINS: 'https://app.example.test',
  COOKIE_SECURE: 'true',
  COOKIE_SAME_SITE: 'lax',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '7d',
  TRUST_PROXY: '1',
  LOG_LEVEL: 'silent',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX: '300',
};

const stubProductionEnvironment = () => {
  for (const [name, value] of Object.entries(productionEnvironment)) vi.stubEnv(name, value);
};

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('production runtime', () => {
  it('fails startup when production secrets are missing', () => {
    const names = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET', 'DATABASE_URL', 'DIRECT_URL', 'ADMIN_ORIGIN', 'PORTAL_ORIGIN', 'CORS_ORIGINS'];
    for (const name of names) vi.stubEnv(name, '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => loadConfig()).toThrow('JWT_ACCESS_SECRET is required.');
  });

  it('defaults to port 3000 when PORT is missing in production', () => {
    stubProductionEnvironment();
    vi.stubEnv('PORT', undefined);
    expect(loadConfig().port).toBe(3000);
  });

  it('maps TRUST_PROXY=true to one trusted proxy hop', () => {
    stubProductionEnvironment();
    vi.stubEnv('TRUST_PROXY', 'true');
    expect(loadConfig().trustProxy).toBe(1);
  });

  it('reports liveness without querying the database', async () => {
    const readinessCheck = vi.fn(async () => undefined);
    const response = await request(createApp({ config: config(), readinessCheck })).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(readinessCheck).not.toHaveBeenCalled();
  });

  it('returns 503 when PostgreSQL is unavailable', async () => {
    const response = await request(createApp({ config: config(), readinessCheck: async () => { throw new Error('unavailable'); } })).get('/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready' });
  });

  it('returns 200 when the readiness database check succeeds', async () => {
    const response = await request(createApp({ config: config(), readinessCheck: async () => undefined })).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
  });

  it('uses the forwarded client IP behind one proxy and still enforces rate limits', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createApp({
      config: config({ trustProxy: 1, rateLimitMax: 2 }),
      readinessCheck: async () => undefined,
      logger,
    });
    const forwardedFor = '203.0.113.42';

    const health = await request(app).get('/health').set('X-Forwarded-For', forwardedFor);
    const ready = await request(app).get('/ready').set('X-Forwarded-For', forwardedFor);
    const limited = await request(app).get('/health').set('X-Forwarded-For', forwardedFor);

    expect(health.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: 'http_request', ip: forwardedFor }));
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain('ERR_ERL_PERMISSIVE_TRUST_PROXY');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('allows only configured CORS origins with credentials', async () => {
    const app = createApp({ config: config(), readinessCheck: async () => undefined });
    const allowed = await request(app).get('/health').set('Origin', 'https://app.example.test');
    const rejected = await request(app).get('/health').set('Origin', 'https://attacker.example');
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.test');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    expect(rejected.status).toBe(403);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves admin and portal SPA fallbacks without intercepting API paths', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'qh-production-'));
    temporaryDirectories.push(root);
    const adminDistPath = path.join(root, 'admin');
    const portalDistPath = path.join(root, 'portal');
    await Promise.all([mkdir(adminDistPath, { recursive: true }), mkdir(portalDistPath, { recursive: true })]);
    await writeFile(path.join(adminDistPath, 'index.html'), '<main>admin-spa</main>');
    await writeFile(path.join(portalDistPath, 'index.html'), '<main>portal-spa</main>');
    const app = createApp({ config: config({ adminDistPath, portalDistPath }), readinessCheck: async () => undefined });

    const admin = await request(app).get('/users/deep-link');
    const portal = await request(app).get('/portal/public/deep-link');
    const api = await request(app).get('/api/not-a-route');
    expect(admin.status).toBe(200);
    expect(admin.text).toContain('admin-spa');
    expect(admin.headers['cache-control']).toBe('no-store');
    expect(portal.status).toBe(200);
    expect(portal.text).toContain('portal-spa');
    expect(api.status).toBe(404);
    expect(api.body.error.code).toBe('NOT_FOUND');
  });
});
