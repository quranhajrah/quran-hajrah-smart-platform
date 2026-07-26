import { describe, expect, it } from 'vitest';
import type { AnalysisProposal } from './api';
import {
  analysisJobDiagnostics,
  analysisRequestPath,
  analysisReviewPath,
  buildExtractionSummary,
  forcedReanalysisLabel,
  groupAnalysisProposals,
  sameJobRetryLabel,
  shouldShowAnalysisFailure,
} from './document-analysis-view';

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

  it('shows failure details only for failed or OCR-required jobs', () => {
    expect(shouldShowAnalysisFailure('FAILED')).toBe(true);
    expect(shouldShowAnalysisFailure('OCR_REQUIRED')).toBe(true);
    expect(shouldShowAnalysisFailure('PROPOSALS_READY')).toBe(false);
    expect(shouldShowAnalysisFailure('IMPORTED')).toBe(false);
  });

  it('keeps forced reanalysis and same-job retry lifecycle semantics distinct', () => {
    const documentId = crypto.randomUUID();
    const currentJobId = crypto.randomUUID();
    const newJobId = crypto.randomUUID();

    expect(analysisRequestPath(documentId, true)).toBe(
      `/documents/${documentId}/analyze?force=true`,
    );
    expect(analysisReviewPath(newJobId)).toBe(`/document-analysis/jobs/${newJobId}`);
    expect(analysisReviewPath(newJobId)).not.toBe(analysisReviewPath(currentJobId));
    expect(forcedReanalysisLabel).toBe('إعادة التحليل');
    expect(sameJobRetryLabel).toBe('إعادة المحاولة');
  });

  it('builds explicit review diagnostics from the newly selected job', () => {
    const jobId = crypto.randomUUID();
    const createdAt = '2026-07-27T06:00:00.000Z';
    expect(
      analysisJobDiagnostics({
        id: jobId,
        documentId: crypto.randomUUID(),
        documentVersionId: crypto.randomUUID(),
        status: 'PROPOSALS_READY',
        extractionVersion: '24.2.1',
        pageCount: 3,
        tableCount: 1,
        proposalCount: 10,
        createdAt,
        updatedAt: createdAt,
        document: {
          id: crypto.randomUUID(),
          title: 'خطة تشغيلية',
          confidentialityLevel: 'CONFIDENTIAL',
          documentType: 'OPERATIONAL_PLAN',
          versionNumber: 1,
        },
      }),
    ).toEqual({
      jobId,
      extractionVersion: '24.2.1',
      createdAt,
      documentType: 'OPERATIONAL_PLAN',
    });
  });
});
