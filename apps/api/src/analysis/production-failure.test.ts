import { describe, expect, it } from 'vitest';
import { analysisPersistenceTransactionOptions } from './prisma-store.js';
import { analysisFailureDetails } from './service.js';
import { AnalysisPipelineError } from './types.js';

describe('production document-analysis failure diagnostics', () => {
  it('preserves the exact sanitized Prisma timeout and returns an Arabic stage message', () => {
    const cause = Object.assign(
      new Error(
        'Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction.',
      ),
      { code: 'P2028' },
    );

    const details = analysisFailureDetails(
      new AnalysisPipelineError('page_creation', cause),
      'proposal_generation',
    );

    expect(details).toMatchObject({
      stage: 'page_creation',
      stageLabel: 'حفظ الصفحات والجداول المستخرجة',
      code: 'ANALYSIS_PERSISTENCE_TIMEOUT',
      errorName: 'Error',
      diagnosticMessage:
        'Transaction API error: Transaction already closed: A query cannot be executed on an expired transaction.',
    });
    expect(details.userMessage).toContain('انتهت مهلة حفظ النتائج');
    expect(details.userMessage).toContain('معرّف التشخيص');
    expect(details.diagnosticId).toMatch(/^[a-f0-9]{12}$/);
  });

  it('redacts connection credentials and local paths from diagnostic logs', () => {
    const details = analysisFailureDetails(
      new Error(
        'failed postgresql://admin:secret@example.test:5432/db at C:\\private\\documents\\plan.pdf',
      ),
      'file_retrieval',
    );

    expect(details.diagnosticMessage).not.toContain('secret');
    expect(details.diagnosticMessage).not.toContain('C:\\private');
    expect(details.diagnosticMessage).toContain('postgresql://[redacted]@');
    expect(details.diagnosticMessage).toContain('[redacted-path]');
  });

  it('allows a bounded production persistence window for multi-page plans', () => {
    expect(analysisPersistenceTransactionOptions).toEqual({
      maxWait: 15_000,
      timeout: 120_000,
    });
  });
});
