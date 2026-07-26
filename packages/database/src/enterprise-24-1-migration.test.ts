import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  'prisma/migrations/20260726_enterprise_24_1_semantic_extraction/migration.sql',
);

describe('Enterprise 24.1 semantic extraction migration', () => {
  it('is additive and creates proposal relationships without rewriting data', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE "ExtractionProposalRelation"');
    expect(migration).toContain('ADD COLUMN "rawText" TEXT');
    expect(migration).toContain('ADD COLUMN "objectiveLevel" TEXT NOT NULL');
    expect(migration).toContain('ExtractionProposalRelation_parentProposalId_fkey');
    expect(migration).toContain('ExtractionProposalRelation_childProposalId_fkey');
    expect(migration).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM|ALTER COLUMN)\b/i);
  });
});
