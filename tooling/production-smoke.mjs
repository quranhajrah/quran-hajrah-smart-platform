import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const port = 3399;
const secret = () => randomBytes(32).toString('hex');
const child = spawn(process.execPath, ['apps/api/dist/server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    DATABASE_URL: 'postgresql://smoke@127.0.0.1:5432/smoke',
    DIRECT_URL: 'postgresql://smoke@127.0.0.1:5432/smoke',
    ADMIN_ORIGIN: `http://127.0.0.1:${port}`,
    PORTAL_ORIGIN: `http://127.0.0.1:${port}`,
    CORS_ORIGINS: `http://127.0.0.1:${port}`,
    JWT_ACCESS_SECRET: secret(),
    JWT_REFRESH_SECRET: secret(),
    SESSION_SECRET: secret(),
    COOKIE_SECURE: 'true',
    COOKIE_SAME_SITE: 'lax',
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '7d',
    TRUST_PROXY: '1',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX: '300',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let stderr = '';
child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-4_000); });

try {
  let response;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/health`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!response || response.status !== 200) throw new Error(`Production health smoke failed. ${stderr}`);
  const body = await response.json();
  if (body.status !== 'ok') throw new Error('Production health returned an unexpected body.');

  const ready = await fetch(`http://127.0.0.1:${port}/ready`);
  if (ready.status !== 503 || (await ready.json()).status !== 'not_ready') {
    throw new Error('Readiness must return a sanitized 503 when PostgreSQL is unavailable.');
  }

  const admin = await fetch(`http://127.0.0.1:${port}/login`, { redirect: 'manual' });
  if (admin.status !== 200 || !(await admin.text()).includes('id="root"')) {
    throw new Error('Admin SPA fallback failed.');
  }

  const portal = await fetch(`http://127.0.0.1:${port}/portal/`, { redirect: 'manual' });
  if (portal.status !== 200 || !(await portal.text()).includes('id="root"')) {
    throw new Error(`Portal production entry failed with status ${portal.status} and location ${portal.headers.get('location') ?? 'none'}.`);
  }

  const protectedRoute = await fetch(`http://127.0.0.1:${port}/api/users`);
  if (protectedRoute.status !== 401) throw new Error('Protected API route did not reject anonymous access.');

  const missingApi = await fetch(`http://127.0.0.1:${port}/api/not-a-route`);
  if (missingApi.status !== 404 || !(missingApi.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('Unknown API route was intercepted by the SPA fallback.');
  }

  console.log('Production start, health, readiness, SPAs, and protected-route smoke passed.');
} finally {
  child.kill('SIGTERM');
}
