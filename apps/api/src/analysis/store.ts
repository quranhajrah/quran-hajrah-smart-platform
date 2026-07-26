import type { RequestMeta } from '../identity/types.js';
import type {
  AnalysisConfigurationRecord,
  AnalysisJobRecord,
  AnalysisJobStatus,
  AnalysisListQuery,
  AnalysisPageRecord,
  AnalysisTableRecord,
  ConflictResult,
  ExtractionProposalCandidate,
  ImportBatchRecord,
  ImportDecision,
  ProposalDecision,
  ProposalListQuery,
  ProposalRecord,
  SourceEvidenceRecord,
  AnalysisPipelineStage,
} from './types.js';

export type SaveExtractionInput = {
  provider: string;
  providerVersion: string;
  extractionMethod: string;
  metadata: Record<string, unknown>;
  pages: Array<{
    pageNumber: number;
    rawText?: string;
    text: string;
    hasEmbeddedText: boolean;
    quality: number;
    width?: number;
    height?: number;
    tables: Array<{
      tableIndex: number;
      title?: string;
      sourceSection?: string;
      rows: string[][];
      confidence: number;
      extractionMethod: string;
    }>;
  }>;
  proposals: ExtractionProposalCandidate[];
  reportStage?: (stage: AnalysisPipelineStage) => void;
};

export type AnalysisAuditInput = RequestMeta & {
  jobId?: string;
  proposalId?: string;
  importBatchId?: string;
  userId?: string;
  action: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export interface AnalysisStore {
  getConfiguration(): Promise<AnalysisConfigurationRecord>;
  updateConfiguration(
    input: Partial<
      Pick<
        AnalysisConfigurationRecord,
        | 'isActive'
        | 'maxFileSizeBytes'
        | 'maxPages'
        | 'maxTables'
        | 'minimumTextCharacters'
        | 'proposalConfidence'
        | 'reviewSlaHours'
        | 'enabledDocumentTypes'
        | 'enabledRuleIds'
      >
    >,
    userId: string,
  ): Promise<AnalysisConfigurationRecord>;

  findJobByFingerprint(fingerprint: string): Promise<AnalysisJobRecord | null>;
  createJob(input: {
    documentId: string;
    documentVersionId: string;
    fingerprint: string;
    extractionVersion: string;
    requestedById: string;
    reviewDueAt: Date;
  }): Promise<AnalysisJobRecord>;
  getJob(id: string): Promise<AnalysisJobRecord | null>;
  listJobs(
    query: AnalysisListQuery,
  ): Promise<{ items: AnalysisJobRecord[]; total: number; page: number; pageSize: number }>;
  updateJob(
    id: string,
    input: Partial<{
      status: AnalysisJobStatus;
      extractionProvider: string | null;
      extractionVersion: string;
      extractionMethod: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      failureReason: string | null;
      providerMetadata: Record<string, unknown> | null;
      pageCount: number;
      tableCount: number;
      proposalCount: number;
    }>,
  ): Promise<AnalysisJobRecord>;
  saveExtraction(jobId: string, input: SaveExtractionInput): Promise<AnalysisJobRecord>;
  clearJobForRetry(jobId: string): Promise<AnalysisJobRecord>;

  listPages(jobId: string): Promise<AnalysisPageRecord[]>;
  listTables(jobId: string): Promise<AnalysisTableRecord[]>;
  listProposals(
    jobId: string,
    query: ProposalListQuery,
  ): Promise<{ items: ProposalRecord[]; total: number; page: number; pageSize: number }>;
  getProposal(id: string): Promise<ProposalRecord | null>;
  updateProposal(
    id: string,
    input: {
      title?: string;
      editedData?: Record<string, unknown>;
      importTargetType?: ProposalRecord['importTargetType'];
    },
  ): Promise<ProposalRecord>;
  reviewProposal(
    id: string,
    decision: ProposalDecision,
    reviewerId: string,
    comment?: string,
    editedData?: Record<string, unknown>,
  ): Promise<ProposalRecord>;
  reviewProposals(
    ids: string[],
    decision: Exclude<ProposalDecision, 'EDITED'>,
    reviewerId: string,
    comment?: string,
  ): Promise<ProposalRecord[]>;
  refreshJobReviewStatus(jobId: string): Promise<AnalysisJobRecord>;

  detectConflicts(jobId: string): Promise<ConflictResult[]>;
  importApproved(
    jobId: string,
    idempotencyKey: string,
    decisions: ImportDecision[],
    importedById: string,
  ): Promise<ImportBatchRecord>;
  getImportBatch(id: string): Promise<ImportBatchRecord | null>;
  listSourceReferences(
    targetType: ProposalRecord['importTargetType'],
    targetRecordId: string,
  ): Promise<SourceEvidenceRecord[]>;

  summary(): Promise<{
    analyzed: number;
    awaitingReview: number;
    awaitingApproval: number;
    imported: number;
    failed: number;
    ocrRequired: number;
    budget: {
      records: number;
      lines: number;
      totalPlanned: number;
    };
  }>;
  createAudit(input: AnalysisAuditInput): Promise<void>;
  listAudit(
    jobId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number }>;
}
