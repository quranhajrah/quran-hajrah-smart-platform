import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  'prisma/migrations/20260724_enterprise_24_document_intelligence/migration.sql',
);

describe('Enterprise 24 production migration', () => {
  it('is committed, additive, and creates every document-intelligence table', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    for (const table of [
      'DocumentAnalysisJob',
      'DocumentPage',
      'DocumentExtractedText',
      'DocumentExtractedTable',
      'DocumentTableCell',
      'ExtractionProposal',
      'ExtractionProposalField',
      'ExtractionReview',
      'ExtractionImportBatch',
      'ExtractionImportItem',
      'SourceEvidenceReference',
      'DocumentAnalysisConfiguration',
      'DocumentAnalysisAuditLog',
      'BudgetRecord',
      'BudgetLine',
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    expect(migration).toContain('CREATE TYPE "AnalysisJobStatus"');
    expect(migration).toContain('CREATE TYPE "ExtractionProposalType"');
    expect(migration).toContain('ADD CONSTRAINT "SourceEvidenceReference_sourceDocumentId_fkey"');
    expect(migration).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
  });

  it('retains idempotency and source-traceability constraints', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    expect(migration).toContain('CREATE UNIQUE INDEX "ExtractionImportBatch_idempotencyKey_key"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "SourceEvidenceReference_sourceProposalId_targetType_targetR_key"',
    );
    expect(migration).toContain('CREATE UNIQUE INDEX "DocumentAnalysisJob_fingerprint_key"');
  });
});
