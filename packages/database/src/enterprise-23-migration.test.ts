import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migrationUrl = new URL(
  '../prisma/migrations/20260724_enterprise_23_executive_intelligence/migration.sql',
  import.meta.url,
);

const expectedTables = [
  'InstitutionalMetric',
  'MetricValue',
  'StrategicObjective',
  'StrategicKpi',
  'KpiMeasurement',
  'OperationalInitiative',
  'InitiativeMilestone',
  'InitiativeUpdate',
  'InitiativeEvidence',
  'InstitutionalRisk',
  'RiskTreatment',
  'RiskEvidence',
  'ExecutiveAlert',
  'ExecutiveDashboardPreference',
  'ExecutiveHealthSnapshot',
  'ExecutiveReport',
  'ExecutiveReportSection',
];

describe('Enterprise 23 production migration', () => {
  it('contains every executive intelligence table and required foreign keys', async () => {
    const migration = await readFile(fileURLToPath(migrationUrl), 'utf8');

    for (const table of expectedTables) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    expect(migration).toContain(
      'FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL',
    );
  });

  it('is additive and cannot reset or delete production data', async () => {
    const migration = await readFile(fileURLToPath(migrationUrl), 'utf8');

    expect(migration).not.toMatch(/\bDROP\s+(?:TABLE|SCHEMA|DATABASE)\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bprisma\s+(?:migrate\s+dev|db\s+push)\b/i);
  });
});
