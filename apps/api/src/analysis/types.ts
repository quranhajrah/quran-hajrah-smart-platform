import type { DocumentType } from '../documents/types.js';

export const analysisJobStatuses = [
  'QUEUED',
  'PROCESSING',
  'TEXT_EXTRACTED',
  'PROPOSALS_READY',
  'UNDER_REVIEW',
  'PARTIALLY_APPROVED',
  'APPROVED',
  'IMPORTING',
  'IMPORTED',
  'FAILED',
  'OCR_REQUIRED',
  'CANCELLED',
] as const;

export const extractionProposalTypes = [
  'STRATEGIC_OBJECTIVE',
  'KPI',
  'METRIC',
  'INITIATIVE',
  'MILESTONE',
  'RISK',
  'RISK_TREATMENT',
  'BUDGET',
  'BUDGET_LINE',
  'BENEFICIARY_GROUP',
  'RESPONSIBLE_DEPARTMENT',
  'DOCUMENT_DATE',
  'DOCUMENT_NUMBER',
  'POLICY_REQUIREMENT',
  'GOVERNANCE_SCORE',
  'FINANCIAL_VALUE',
  'REPORTING_PERIOD',
  'OTHER',
] as const;

export const proposalDecisions = ['PENDING', 'APPROVED', 'REJECTED', 'EDITED'] as const;

export const importTargetTypes = [
  'STRATEGIC_OBJECTIVE',
  'KPI',
  'METRIC',
  'METRIC_VALUE',
  'INITIATIVE',
  'MILESTONE',
  'RISK',
  'RISK_TREATMENT',
  'EXECUTIVE_ALERT',
  'EXECUTIVE_REPORT_SECTION',
  'BUDGET_RECORD',
  'BUDGET_LINE',
  'NONE',
] as const;

export type AnalysisJobStatus = (typeof analysisJobStatuses)[number];
export type ExtractionProposalType = (typeof extractionProposalTypes)[number];
export type ProposalDecision = (typeof proposalDecisions)[number];
export type ImportTargetType = (typeof importTargetTypes)[number];
export type ConflictAction = 'skip' | 'update' | 'create' | 'merge';

export type PositionedTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExtractedTableData = {
  pageNumber: number;
  tableIndex: number;
  title?: string;
  sourceSection?: string;
  rows: string[][];
  confidence: number;
  extractionMethod: string;
};

export type ExtractedPageData = {
  pageNumber: number;
  text: string;
  hasEmbeddedText: boolean;
  width?: number;
  height?: number;
  quality: number;
  positionedItems?: PositionedTextItem[];
  tables: ExtractedTableData[];
};

export type DocumentExtractionInput = {
  fileName: string;
  mimeType: string;
  data: Buffer;
  maximumBytes: number;
  maximumPages: number;
  maximumTables: number;
};

export type DocumentExtractionResult = {
  provider: string;
  providerVersion: string;
  extractionMethod: string;
  pages: ExtractedPageData[];
  metadata: Record<string, string | number | boolean | null>;
};

export interface DocumentTextExtractionProvider {
  readonly name: string;
  readonly version: string;
  canHandle(input: Pick<DocumentExtractionInput, 'fileName' | 'mimeType'>): boolean;
  extractDocument(input: DocumentExtractionInput): Promise<DocumentExtractionResult>;
  extractPages(input: DocumentExtractionInput): Promise<ExtractedPageData[]>;
  extractTables(pages: ExtractedPageData[], maximumTables: number): ExtractedTableData[];
  getMetadata(result: DocumentExtractionResult): Record<string, string | number | boolean | null>;
}

export type ProposalFieldCandidate = {
  key: string;
  labelAr: string;
  dataType: 'string' | 'number' | 'date' | 'percentage' | 'currency' | 'array';
  value: string | number | string[] | null;
  sourceValue?: string;
  confidence?: number;
};

export type ExtractionProposalCandidate = {
  proposalType: ExtractionProposalType;
  title: string;
  proposedData: Record<string, unknown>;
  importTargetType: ImportTargetType;
  extractionRuleId: string;
  extractionMethod: string;
  confidence: number;
  sourcePage?: number;
  sourceSection?: string;
  evidenceSnippet?: string;
  fields: ProposalFieldCandidate[];
};

export type InstitutionalExtractionInput = {
  documentType: DocumentType;
  pages: ExtractedPageData[];
  tables: ExtractedTableData[];
};

export interface SpecializedInstitutionalExtractor {
  readonly name: string;
  supports(documentType: DocumentType): boolean;
  extract(input: InstitutionalExtractionInput): ExtractionProposalCandidate[];
}

export type AnalysisConfigurationRecord = {
  id: string;
  key: string;
  isActive: boolean;
  providerVersion: string;
  maxFileSizeBytes: number;
  maxPages: number;
  maxTables: number;
  minimumTextCharacters: number;
  proposalConfidence: number;
  reviewSlaHours: number;
  enabledDocumentTypes: string[];
  enabledRuleIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type AnalysisJobRecord = {
  id: string;
  documentId: string;
  documentVersionId: string;
  fingerprint: string;
  status: AnalysisJobStatus;
  extractionProvider?: string | null;
  extractionVersion: string;
  extractionMethod?: string | null;
  requestedById: string;
  startedAt?: Date | null;
  completedAt?: Date | null;
  reviewDueAt?: Date | null;
  failureReason?: string | null;
  providerMetadata?: Record<string, unknown> | null;
  pageCount: number;
  tableCount: number;
  proposalCount: number;
  createdAt: Date;
  updatedAt: Date;
  document?: {
    id: string;
    title: string;
    confidentialityLevel: string;
    documentType: DocumentType;
    versionNumber: number;
  };
};

export type AnalysisPageRecord = {
  id: string;
  jobId: string;
  documentId: string;
  pageNumber: number;
  hasEmbeddedText: boolean;
  textLength: number;
  extractionQuality?: number | null;
  width?: number | null;
  height?: number | null;
  text?: string;
};

export type AnalysisTableRecord = {
  id: string;
  jobId: string;
  pageId: string;
  pageNumber: number;
  tableIndex: number;
  title?: string | null;
  sourceSection?: string | null;
  rowCount: number;
  columnCount: number;
  extractionMethod: string;
  confidence?: number | null;
  rows: string[][];
};

export type ProposalRecord = {
  id: string;
  jobId: string;
  documentId: string;
  documentVersionId: string;
  proposalType: ExtractionProposalType;
  decision: ProposalDecision;
  title: string;
  proposedData: Record<string, unknown>;
  editedData?: Record<string, unknown> | null;
  importTargetType: ImportTargetType;
  extractionRuleId: string;
  extractionMethod: string;
  confidence: number;
  sourcePage?: number | null;
  sourceSection?: string | null;
  evidenceSnippet?: string | null;
  reviewedById?: string | null;
  reviewedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fields?: ProposalFieldCandidate[];
};

export type AnalysisListQuery = {
  page: number;
  pageSize: number;
  documentId?: string;
  status?: AnalysisJobStatus;
  search?: string;
};

export type ProposalListQuery = {
  page: number;
  pageSize: number;
  decision?: ProposalDecision;
  proposalType?: ExtractionProposalType;
  pageNumber?: number;
  minimumConfidence?: number;
};

export type ConflictResult = {
  proposalId: string;
  targetType: ImportTargetType;
  status: 'ready' | 'conflict' | 'incomplete' | 'already_imported';
  reason?: string;
  existingRecordId?: string;
  allowedActions: ConflictAction[];
  defaultAction: ConflictAction;
};

export type ImportDecision = {
  proposalId: string;
  action: ConflictAction;
  selectedFields?: string[];
};

export type ImportBatchRecord = {
  id: string;
  jobId: string;
  idempotencyKey: string;
  status: 'PREVIEW' | 'IMPORTING' | 'IMPORTED' | 'FAILED' | 'ROLLED_BACK';
  importedById: string;
  summary?: Record<string, unknown> | null;
  failureReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  items?: Array<Record<string, unknown>>;
};

export type SourceEvidenceRecord = {
  id: string;
  sourceDocumentId: string;
  sourceDocumentVersionId: string;
  sourceProposalId: string;
  targetType: ImportTargetType;
  targetRecordId: string;
  sourcePage?: number | null;
  sourceSection?: string | null;
  sourceEvidence?: string | null;
  extractionMethod: string;
  importedAt: Date;
  importedById: string;
  document?: { id: string; title: string; confidentialityLevel: string };
};

export interface SemanticDocumentExtractor {
  extract(input: InstitutionalExtractionInput): Promise<ExtractionProposalCandidate[]>;
}

export interface LlmStructuredExtractionProvider extends SemanticDocumentExtractor {
  readonly providerName: string;
}

export interface OcrProvider {
  canHandle(mimeType: string): boolean;
  extractImages(_data: Buffer): Promise<never>;
}

export interface EmbeddingProvider {
  embed(_texts: string[]): Promise<number[][]>;
}

export interface RerankingProvider {
  rerank(_query: string, _items: string[]): Promise<number[]>;
}
