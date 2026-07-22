export type AppConfig = {
  nodeEnv: string;
  corsOrigins: string[];
  accessTokenSecret: string;
  accessTokenMinutes: number;
  refreshTokenDays: number;
  cookieName: string;
  bcryptRounds: number;
};

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

export const loadConfig = (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const accessTokenSecret = required('JWT_ACCESS_SECRET');
  if (accessTokenSecret.length < 32) throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters.');
  return {
    nodeEnv,
    corsOrigins: required('CORS_ORIGINS').split(',').map((origin) => origin.trim()),
    accessTokenSecret,
    accessTokenMinutes: Number(process.env.ACCESS_TOKEN_MINUTES ?? 15),
    refreshTokenDays: Number(process.env.REFRESH_TOKEN_DAYS ?? 7),
    cookieName: process.env.REFRESH_COOKIE_NAME ?? 'qh_refresh',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  };
};
