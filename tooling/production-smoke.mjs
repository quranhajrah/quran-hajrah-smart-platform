import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const omitPort = process.env.SMOKE_OMIT_PORT === 'true';
const port = omitPort ? 3000 : 3399;
const secret = () => randomBytes(32).toString('hex');
const child = spawn(process.execPath, ['apps/api/dist/server.js'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    ...(!omitPort ? { PORT: String(port) } : {}),
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
let stdout = '';
child.stdout.on('data', (chunk) => {
  stdout = `${stdout}${chunk}`.slice(-8_000);
});
child.stderr.on('data', (chunk) => {
  stderr = `${stderr}${chunk}`.slice(-4_000);
});

const checkStaticAssets = async (baseUrl, html) => {
  const assetPaths = [...html.matchAll(/(?:src|href)="([^"]*assets\/[^"]+)"/g)].map(
    (match) => match[1],
  );
  if (assetPaths.length === 0)
    throw new Error(`No hashed static assets were referenced by ${baseUrl}.`);
  for (const assetPath of assetPaths) {
    const asset = await fetch(new URL(assetPath, baseUrl));
    if (asset.status !== 200)
      throw new Error(`Static asset ${assetPath} returned ${asset.status}.`);
  }
};

try {
  let response;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      response = await fetch(`http://127.0.0.1:${port}/health`);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (!response || response.status !== 200)
    throw new Error(`Production health smoke failed. stdout=${stdout} stderr=${stderr}`);
  const body = await response.json();
  if (body.status !== 'ok') throw new Error('Production health returned an unexpected body.');

  const ready = await fetch(`http://127.0.0.1:${port}/ready`);
  if (ready.status !== 503 || (await ready.json()).status !== 'not_ready') {
    throw new Error('Readiness must return a sanitized 503 when PostgreSQL is unavailable.');
  }

  const admin = await fetch(`http://127.0.0.1:${port}/login`, { redirect: 'manual' });
  const adminHtml = await admin.text();
  if (admin.status !== 200 || !adminHtml.includes('id="root"')) {
    throw new Error('Admin SPA fallback failed.');
  }
  await checkStaticAssets(`http://127.0.0.1:${port}/login`, adminHtml);

  const knowledgeCenter = await fetch(`http://127.0.0.1:${port}/documents`);
  const knowledgeCenterHtml = await knowledgeCenter.text();
  if (knowledgeCenter.status !== 200 || !knowledgeCenterHtml.includes('id="root"')) {
    throw new Error('Knowledge Center SPA fallback failed.');
  }

  const portal = await fetch(`http://127.0.0.1:${port}/portal/`, { redirect: 'manual' });
  const portalHtml = await portal.text();
  if (portal.status !== 200 || !portalHtml.includes('id="root"')) {
    throw new Error(
      `Portal production entry failed with status ${portal.status} and location ${portal.headers.get('location') ?? 'none'}.`,
    );
  }
  await checkStaticAssets(`http://127.0.0.1:${port}/portal/`, portalHtml);

  const protectedRoute = await fetch(`http://127.0.0.1:${port}/api/users`);
  if (protectedRoute.status !== 401)
    throw new Error('Protected API route did not reject anonymous access.');
  const protectedDocuments = await fetch(`http://127.0.0.1:${port}/api/documents`);
  if (protectedDocuments.status !== 401) {
    throw new Error('Knowledge Center API did not reject anonymous access.');
  }

  const missingApi = await fetch(`http://127.0.0.1:${port}/api/not-a-route`);
  if (
    missingApi.status !== 404 ||
    !(missingApi.headers.get('content-type') ?? '').includes('application/json')
  ) {
    throw new Error('Unknown API route was intercepted by the SPA fallback.');
  }

  if (!stdout.includes('"event":"startup_initializing"'))
    throw new Error('Immediate startup log was not written to stdout.');
  const startupRecords = stdout.split(/\r?\n/).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });
  const databaseConfiguration = startupRecords.find(
    (record) => record.event === 'prisma_connection_configuration',
  );
  if (
    databaseConfiguration?.database?.host !== '127.0.0.1' ||
    databaseConfiguration.database.port !== 5432 ||
    databaseConfiguration.database.source !== 'process.env' ||
    databaseConfiguration.database.defaultUsed !== false
  ) {
    throw new Error('The safe Prisma connection target startup log is missing or incorrect.');
  }
  if (JSON.stringify(databaseConfiguration).includes('postgresql://')) {
    throw new Error('The Prisma connection startup log exposed a connection string.');
  }
  if (!stdout.includes('"event":"server_started"') || !stdout.includes('"host":"0.0.0.0"')) {
    throw new Error('Listening startup log did not confirm host 0.0.0.0.');
  }

  console.log(
    'Production runtime, logs, health, readiness, SPAs, Knowledge Center, static assets, and protected routes passed.',
  );
} finally {
  child.kill('SIGTERM');
}
