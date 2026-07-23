import path from 'node:path';

export type SameSite = 'lax' | 'strict' | 'none';
export type AppConfig = {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  adminOrigin: string;
  portalOrigin: string;
  corsOrigins: string[];
  accessTokenSecret: string;
  refreshTokenSecret: string;
  accessTokenTtl: string;
  refreshTokenTtlMs: number;
  cookieName: string;
  cookieDomain?: string;
  cookieSecure: boolean;
  cookieSameSite: SameSite;
  bcryptRounds: number;
  trustProxy: false | number;
  logLevel: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  adminDistPath: string;
  portalDistPath: string;
  documentStorageRoot: string;
  documentMaxFileSizeBytes: number;
};

const value = (name: string, production: boolean, developmentDefault?: string) => {
  const configured = process.env[name]?.trim();
  if (configured) return configured;
  if (!production && developmentDefault !== undefined) return developmentDefault;
  throw new Error(`${name} is required.`);
};

const positiveNumber = (name: string, raw: string) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive number.`);
  return parsed;
};

const durationMs = (name: string, raw: string) => {
  const match = /^(\d+)(s|m|h|d)$/.exec(raw);
  if (!match) throw new Error(`${name} must use a duration such as 15m or 7d.`);
  const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
  return Number(match[1]) * multipliers[match[2] as keyof typeof multipliers];
};

const parseBoolean = (name: string, raw: string) => {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false.`);
};

const parseTrustProxy = (raw: string): false | number => {
  if (raw === 'false') return false;
  if (raw === 'true') return 1;
  if (/^[1-9]\d*$/.test(raw)) return Number(raw);
  throw new Error('TRUST_PROXY must be false or a positive proxy hop count.');
};

const validateOrigin = (name: string, origin: string) => {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error();
    return origin;
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) origin without a path.`);
  }
};

export const loadConfig = (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const accessTokenSecret = value(
    'JWT_ACCESS_SECRET',
    isProduction,
    'development-access-secret-at-least-32-characters',
  );
  const jwtRefreshSecret = value(
    'JWT_REFRESH_SECRET',
    isProduction,
    'development-refresh-secret-at-least-32-characters',
  );
  const sessionSecret = value(
    'SESSION_SECRET',
    isProduction,
    'development-session-secret-at-least-32-characters',
  );
  if ([accessTokenSecret, jwtRefreshSecret, sessionSecret].some((secret) => secret.length < 32)) {
    throw new Error('Authentication secrets must each contain at least 32 characters.');
  }
  const refreshTokenSecret = `${jwtRefreshSecret}:${sessionSecret}`;

  const adminOrigin = validateOrigin(
    'ADMIN_ORIGIN',
    value('ADMIN_ORIGIN', isProduction, 'http://localhost:5173'),
  );
  const portalOrigin = validateOrigin(
    'PORTAL_ORIGIN',
    value('PORTAL_ORIGIN', isProduction, 'http://localhost:5174'),
  );
  const corsOrigins = value('CORS_ORIGINS', isProduction, `${adminOrigin},${portalOrigin}`)
    .split(',')
    .map((origin) => validateOrigin('CORS_ORIGINS', origin.trim()));
  if (corsOrigins.includes('*')) throw new Error('CORS_ORIGINS cannot contain a wildcard.');

  const cookieSecure = parseBoolean('COOKIE_SECURE', value('COOKIE_SECURE', isProduction, 'false'));
  const cookieSameSite = value('COOKIE_SAME_SITE', isProduction, 'lax') as SameSite;
  if (!['lax', 'strict', 'none'].includes(cookieSameSite))
    throw new Error('COOKIE_SAME_SITE must be lax, strict, or none.');
  if (isProduction && !cookieSecure) throw new Error('COOKIE_SECURE must be true in production.');
  if (cookieSameSite === 'none' && !cookieSecure)
    throw new Error('SameSite=None requires secure cookies.');

  if (isProduction) {
    value('DATABASE_URL', true);
    value('DIRECT_URL', true);
  }

  const trustProxy = parseTrustProxy(value('TRUST_PROXY', isProduction, 'false'));
  if (isProduction && trustProxy === false)
    throw new Error('TRUST_PROXY must be enabled in production.');

  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isFinite(port) || port <= 0) throw new Error('PORT must be a positive number.');
  if (!Number.isInteger(port) || port > 65_535)
    throw new Error('PORT must be an integer between 1 and 65535.');
  const accessTokenTtl = value('ACCESS_TOKEN_TTL', isProduction, '15m');
  durationMs('ACCESS_TOKEN_TTL', accessTokenTtl);

  return {
    nodeEnv,
    isProduction,
    port,
    adminOrigin,
    portalOrigin,
    corsOrigins: [...new Set(corsOrigins)],
    accessTokenSecret,
    refreshTokenSecret,
    accessTokenTtl,
    refreshTokenTtlMs: durationMs(
      'REFRESH_TOKEN_TTL',
      value('REFRESH_TOKEN_TTL', isProduction, '7d'),
    ),
    cookieName: process.env.REFRESH_COOKIE_NAME?.trim() || 'qh_refresh',
    ...(process.env.COOKIE_DOMAIN?.trim()
      ? { cookieDomain: process.env.COOKIE_DOMAIN.trim() }
      : {}),
    cookieSecure,
    cookieSameSite,
    bcryptRounds: positiveNumber('BCRYPT_ROUNDS', process.env.BCRYPT_ROUNDS ?? '12'),
    trustProxy,
    logLevel: value('LOG_LEVEL', isProduction, 'info'),
    rateLimitWindowMs: positiveNumber(
      'RATE_LIMIT_WINDOW_MS',
      value('RATE_LIMIT_WINDOW_MS', isProduction, '60000'),
    ),
    rateLimitMax: positiveNumber('RATE_LIMIT_MAX', value('RATE_LIMIT_MAX', isProduction, '300')),
    adminDistPath: path.resolve(process.cwd(), 'apps/admin/dist'),
    portalDistPath: path.resolve(process.cwd(), 'apps/portal/dist'),
    documentStorageRoot: path.resolve(
      process.env.DOCUMENT_STORAGE_ROOT?.trim() || path.join(process.cwd(), '.data', 'documents'),
    ),
    documentMaxFileSizeBytes:
      positiveNumber('DOCUMENT_MAX_FILE_SIZE_MB', process.env.DOCUMENT_MAX_FILE_SIZE_MB ?? '25') *
      1024 *
      1024,
  };
};
