import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, type ReadinessChecks } from './app.js';
import { loadConfig, type AppConfig } from './config.js';

const temporaryDirectories: string[] = [];
const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  nodeEnv: 'production',
  isProduction: true,
  port: 3000,
  adminOrigin: 'https://app.example.test',
  portalOrigin: 'https://app.example.test',
  corsOrigins: ['https://app.example.test'],
  accessTokenSecret: 'test-only-access-secret-that-is-longer-than-32-characters',
  refreshTokenSecret:
    'test-only-refresh-and-session-secret-that-is-longer-than-64-characters-total',
  accessTokenTtl: '15m',
  refreshTokenTtlMs: 604_800_000,
  cookieName: 'test_refresh',
  cookieSecure: true,
  cookieSameSite: 'lax',
  bcryptRounds: 4,
  trustProxy: 1,
  logLevel: 'silent',
  rateLimitWindowMs: 60_000,
  rateLimitMax: 300,
  adminDistPath: 'missing-admin-dist',
  portalDistPath: 'missing-portal-dist',
  documentStorageRoot: 'missing-document-storage',
  documentMaxFileSizeBytes: 25 * 1024 * 1024,
  ...overrides,
});

const readinessChecks = (overrides: Partial<ReadinessChecks> = {}): ReadinessChecks => ({
  prisma: vi.fn(async () => undefined),
  database: vi.fn(async () => undefined),
  migrations: vi.fn(async () => undefined),
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
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('production runtime', () => {
  it('fails startup when production secrets are missing', () => {
    const names = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'SESSION_SECRET',
      'DATABASE_URL',
      'DIRECT_URL',
      'ADMIN_ORIGIN',
      'PORTAL_ORIGIN',
      'CORS_ORIGINS',
    ];
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
    const checks = readinessChecks();
    const response = await request(createApp({ config: config(), readinessChecks: checks })).get(
      '/health',
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(checks.prisma).not.toHaveBeenCalled();
    expect(checks.database).not.toHaveBeenCalled();
    expect(checks.migrations).not.toHaveBeenCalled();
  });

  it.each([
    ['production', true],
    ['development', false],
  ])('returns detailed healthy checks in %s', async (nodeEnv, isProduction) => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const response = await request(
      createApp({
        config: config({ nodeEnv, isProduction }),
        readinessChecks: readinessChecks(),
        logger,
      }),
    ).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ready',
      checks: { prisma: 'ok', database: 'ok', migrations: 'ok' },
    });
    for (const check of ['prisma', 'database', 'migrations']) {
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'readiness_check_step',
          check,
          status: 'started',
        }),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'readiness_check_step',
          check,
          status: 'ok',
        }),
      );
    }
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'readiness_check_completed' }),
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('returns and logs a failed database check', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const response = await request(
      createApp({
        config: config(),
        readinessChecks: readinessChecks({
          database: async () => {
            throw new Error('connection refused');
          },
        }),
        logger,
      }),
    ).get('/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'not_ready',
      checks: { prisma: 'ok', database: 'failed', migrations: 'failed' },
      reason: 'database: connection refused',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'readiness_check_failed',
        check: 'database',
        errorMessage: 'connection refused',
      }),
    );
  });

  it('returns and logs a failed Prisma initialization', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const response = await request(
      createApp({
        config: config(),
        readinessChecks: readinessChecks({
          prisma: async () => {
            throw new Error('client initialization failed');
          },
        }),
        logger,
      }),
    ).get('/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'not_ready',
      checks: { prisma: 'failed', database: 'failed', migrations: 'failed' },
      reason: 'prisma: client initialization failed',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ check: 'prisma', errorMessage: 'client initialization failed' }),
    );
  });

  it('returns and logs pending migrations', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const response = await request(
      createApp({
        config: config(),
        readinessChecks: readinessChecks({
          migrations: async () => {
            throw new Error('Pending database migrations: 202607230001_example.');
          },
        }),
        logger,
      }),
    ).get('/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: 'not_ready',
      checks: { prisma: 'ok', database: 'ok', migrations: 'failed' },
      reason: 'migrations: Pending database migrations: 202607230001_example.',
    });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ check: 'migrations' }));
  });

  it('uses the forwarded client IP behind one proxy and still enforces rate limits', async () => {
    const logger = { info: vi.fn(), error: vi.fn() };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = createApp({
      config: config({ trustProxy: 1, rateLimitMax: 2 }),
      readinessChecks: readinessChecks(),
      logger,
    });
    const forwardedFor = '203.0.113.42';

    const health = await request(app).get('/health').set('X-Forwarded-For', forwardedFor);
    const ready = await request(app).get('/ready').set('X-Forwarded-For', forwardedFor);
    const limited = await request(app).get('/health').set('X-Forwarded-For', forwardedFor);

    expect(health.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(limited.status).toBe(429);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'http_request', ip: forwardedFor }),
    );
    expect(consoleError.mock.calls.flat().join(' ')).not.toContain(
      'ERR_ERL_PERMISSIVE_TRUST_PROXY',
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('allows only configured CORS origins with credentials', async () => {
    const app = createApp({ config: config(), readinessChecks: readinessChecks() });
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
    await Promise.all([
      mkdir(adminDistPath, { recursive: true }),
      mkdir(portalDistPath, { recursive: true }),
    ]);
    await writeFile(path.join(adminDistPath, 'index.html'), '<main>admin-spa</main>');
    await writeFile(path.join(portalDistPath, 'index.html'), '<main>portal-spa</main>');
    const app = createApp({
      config: config({ adminDistPath, portalDistPath }),
      readinessChecks: readinessChecks(),
    });

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
