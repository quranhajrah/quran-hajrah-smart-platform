import type {
  IndexableDocument,
  KnowledgeAccessContext,
  KnowledgeCandidate,
  KnowledgeIndexCommit,
  KnowledgeIndexConfigurationRecord,
  KnowledgePageSource,
  KnowledgeRelationRecord,
} from './types.js';

export type RelationCandidate = {
  sourceDocumentId: string;
  targetDocumentId: string;
  sourceVersionId: string;
  targetVersionId: string;
  score: number;
  sharedTerms: string[];
  rationale: string;
};

export interface KnowledgeStore {
  getConfiguration(): Promise<KnowledgeIndexConfigurationRecord>;
  listIndexableDocuments(): Promise<IndexableDocument[]>;
  findIndexableDocument(
    documentId: string,
    documentVersionId?: string,
  ): Promise<IndexableDocument | null>;
  findExtractedPages(documentVersionId: string): Promise<KnowledgePageSource[]>;
  queueIndex(documentId: string, documentVersionId: string): Promise<string>;
  markProcessing(indexId: string): Promise<void>;
  commitIndex(indexId: string, input: KnowledgeIndexCommit): Promise<void>;
  failIndex(indexId: string, reason: string): Promise<void>;
  listCandidates(access: KnowledgeAccessContext, limit: number): Promise<KnowledgeCandidate[]>;
  replaceRelations(documentId: string, relations: RelationCandidate[]): Promise<void>;
  listRelations(
    documentId: string,
    access: KnowledgeAccessContext,
  ): Promise<KnowledgeRelationRecord[]>;
  getIndexSummary(access: KnowledgeAccessContext): Promise<{
    indexedDocuments: number;
    queuedDocuments: number;
    failedDocuments: number;
    chunkCount: number;
    relationCount: number;
  }>;
  logQuery(input: {
    userId: string;
    queryHash: string;
    resultCount: number;
    answerStatus: 'ANSWERED' | 'INSUFFICIENT_EVIDENCE';
    latencyMs: number;
  }): Promise<void>;
}
