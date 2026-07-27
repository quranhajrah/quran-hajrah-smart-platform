import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../prisma/migrations/20260727_enterprise_25_institutional_knowledge/migration.sql',
  import.meta.url,
);
const seedUrl = new URL('../prisma/seed.ts', import.meta.url);

describe('Enterprise 25 migration', () => {
  it('is additive and contains the institutional knowledge tables', async () => {
    const migration = await readFile(migrationUrl, 'utf8');
    for (const table of [
      'KnowledgeDocumentIndex',
      'KnowledgeChunk',
      'KnowledgeDocumentRelation',
      'KnowledgeQueryLog',
      'KnowledgeIndexConfiguration',
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    expect(migration).toContain('KnowledgeChunk_terms_gin_idx');
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\s+(?:TABLE|DATABASE)/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it('seeds explicit knowledge permissions without granting viewer answer access', async () => {
    const seed = await readFile(seedUrl, 'utf8');
    for (const permission of [
      'knowledge.search',
      'knowledge.ask',
      'knowledge.relations.view',
      'knowledge.index',
      'knowledge.configure',
      'knowledge.audit',
    ]) {
      expect(seed).toContain(`'${permission}'`);
    }
    expect(seed).toContain("viewer: ['knowledge.search', 'knowledge.relations.view']");
    expect(seed).not.toContain("viewer: ['knowledge.search', 'knowledge.ask'");
    expect(seed).toContain('prisma.knowledgeIndexConfiguration.upsert');
  });
});
