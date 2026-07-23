import { describe, expect, it } from 'vitest';
import { environmentSource, shouldLoadDotenv, summarizeDatabaseUrl } from './database-environment.js';

describe('database runtime environment', () => {
  it('never loads dotenv in production', () => {
    expect(shouldLoadDotenv('production')).toBe(false);
    expect(shouldLoadDotenv('development')).toBe(true);
  });

  it('reports a process environment target without exposing credentials', () => {
    const summary = summarizeDatabaseUrl(
      'DATABASE_URL',
      'postgresql://service_user:very-secret@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require',
      'process.env',
    );

    expect(summary).toEqual({
      variable: 'DATABASE_URL',
      configured: true,
      host: 'aws-1-ap-south-1.pooler.supabase.com',
      port: 6543,
      source: 'process.env',
      defaultUsed: false,
    });
    expect(JSON.stringify(summary)).not.toContain('very-secret');
    expect(JSON.stringify(summary)).not.toContain('service_user');
  });

  it('distinguishes dotenv from a missing value without providing a fallback', () => {
    expect(environmentSource(false, 'postgresql://localhost/database')).toBe('.env');
    expect(environmentSource(false, undefined)).toBe('missing');
    expect(summarizeDatabaseUrl('DIRECT_URL', undefined, 'missing')).toEqual({
      variable: 'DIRECT_URL',
      configured: false,
      host: null,
      port: null,
      source: 'missing',
      defaultUsed: false,
    });
  });
});
