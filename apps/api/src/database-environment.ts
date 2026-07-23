export type DatabaseUrlSource = 'process.env' | '.env' | 'missing';

export type DatabaseConnectionSummary = {
  variable: 'DATABASE_URL' | 'DIRECT_URL';
  configured: boolean;
  host: string | null;
  port: number | null;
  source: DatabaseUrlSource;
  defaultUsed: false;
};

export const shouldLoadDotenv = (nodeEnv: string | undefined) => (nodeEnv ?? 'development') !== 'production';

export const environmentSource = (wasProvidedByProcess: boolean, value: string | undefined): DatabaseUrlSource => {
  if (wasProvidedByProcess) return 'process.env';
  return value?.trim() ? '.env' : 'missing';
};

export const summarizeDatabaseUrl = (
  variable: DatabaseConnectionSummary['variable'],
  value: string | undefined,
  source: DatabaseUrlSource,
): DatabaseConnectionSummary => {
  if (!value?.trim()) return { variable, configured: false, host: null, port: null, source: 'missing', defaultUsed: false };

  try {
    const url = new URL(value);
    return {
      variable,
      configured: true,
      host: url.hostname || null,
      port: url.port ? Number(url.port) : 5432,
      source,
      defaultUsed: false,
    };
  } catch {
    return { variable, configured: true, host: 'invalid', port: null, source, defaultUsed: false };
  }
};
