import { describe, expect, it } from 'vitest';
import type { AnalysisProposal } from './api';
import { buildExtractionSummary, groupAnalysisProposals } from './document-analysis-view';

const proposal = (
  proposalType: string,
  proposedData: Record<string, unknown> = {},
): AnalysisProposal =>
  ({
    id: crypto.randomUUID(),
    jobId: crypto.randomUUID(),
    documentId: crypto.randomUUID(),
    documentVersionId: crypto.randomUUID(),
    proposalType,
    decision: 'PENDING',
    title: proposalType,
    proposedData,
    importTargetType: 'NONE',
    extractionRuleId: 'semantic.test',
    extractionMethod: 'RULE_BASED',
    confidence: 0.9,
  }) as AnalysisProposal;

describe('document analysis review presentation', () => {
  it('groups institutional proposals in Arabic review groups', () => {
    const groups = groupAnalysisProposals([
      proposal('KPI'),
      proposal('BENEFICIARY_GROUP'),
      proposal('BUDGET_LINE'),
      proposal('STRATEGIC_OBJECTIVE'),
    ]);
    expect(groups.map((group) => group.label)).toEqual([
      'الفئات المستهدفة',
      'الأهداف التشغيلية',
      'مؤشرات الأداء',
      'الموازنة',
    ]);
  });

  it('builds a document-level semantic extraction summary without fake values', () => {
    const summary = buildExtractionSummary(
      [
        proposal('STRATEGIC_OBJECTIVE'),
        proposal('KPI'),
        proposal('BENEFICIARY_GROUP'),
        proposal('BUDGET', { totalPlanned: 530000 }),
        proposal('BUDGET_LINE'),
      ],
      4,
      1,
    );
    expect(summary).toMatchObject({
      pageCount: 4,
      tableCount: 1,
      objectives: 1,
      kpis: 1,
      beneficiaries: 1,
      budgetLines: 1,
      budgetTotal: 530000,
    });
  });
});
