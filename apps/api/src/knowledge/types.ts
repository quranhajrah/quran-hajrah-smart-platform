import type { ConfidentialityLevel } from '../documents/types.js';

export const KNOWLEDGE_INDEX_VERSION = '25.0.0';
export const LOCAL_EMBEDDING_PROVIDER = 'local-arabic-hybrid-v1';
export const LOCAL_EMBEDDING_DIMENSIONS = 384;

export type KnowledgeAccessContext = {
  userId: string;
  roleIds: string[];
  allowedLevels: ConfidentialityLevel[];
};

export type KnowledgeIndexConfigurationRecord = {
  key: string;
  indexVersion: string;
  embeddingProvider: string;
  embeddingDimensions: number;
  chunkSize: number;
  chunkOverlap: number;
  minimumScore: number;
  maxResults: number;
  isActive: boolean;
};

export type IndexableDocument = {
  documentId: string;
  documentVersionId: string;
  title: string;
  description?: string | null;
  documentType: string;
  owningDepartment: string;
  keywords: string[];
  tags: string[];
  versionNumber: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
};

export type KnowledgePageSource = {
  pageNumber?: number;
  section?: string;
  text: string;
};

export type KnowledgeChunkInput = {
  sequence: number;
  pageNumber?: number;
  section?: string;
  content: string;
  contentHash: string;
  terms: string[];
  embedding: number[];
  tokenCount: number;
};

export type KnowledgeIndexCommit = {
  sourceKind: 'DOCUMENT_CONTENT' | 'DOCUMENT_METADATA' | 'ANALYSIS_TEXT';
  status: 'INDEXED' | 'PARTIAL' | 'UNSUPPORTED';
  contentHash: string;
  providerMetadata: Record<string, unknown>;
  chunks: KnowledgeChunkInput[];
};

export type KnowledgeCandidate = {
  chunkId: string;
  documentId: string;
  documentVersionId: string;
  documentTitle: string;
  documentType: string;
  owningDepartment: string;
  versionNumber: number;
  pageNumber?: number | null;
  section?: string | null;
  content: string;
  terms: string[];
  embedding: number[];
};

export type KnowledgeSearchResult = {
  documentId: string;
  documentVersionId: string;
  documentTitle: string;
  documentType: string;
  owningDepartment: string;
  versionNumber: number;
  pageNumber?: number;
  section?: string;
  excerpt: string;
  score: number;
  sourceUrl: string;
};

export type KnowledgeSourceReference = KnowledgeSearchResult & {
  reference: number;
};

export type KnowledgeAnswer = {
  status: 'ANSWERED' | 'INSUFFICIENT_EVIDENCE';
  answer: string;
  sources: KnowledgeSourceReference[];
  limitations: string[];
};

export type KnowledgeRelationRecord = {
  id: string;
  sourceDocumentId: string;
  targetDocumentId: string;
  relationType: 'SHARES_TOPIC' | 'REFERENCES' | 'SUPERSEDES' | 'RELATED';
  score: number;
  sharedTerms: string[];
  rationale?: string | null;
  relatedDocument: {
    id: string;
    title: string;
    documentType: string;
    owningDepartment: string;
  };
};

export interface KnowledgeEmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(text: string): number[];
}

export interface KnowledgeAnswerComposer {
  compose(question: string, evidence: KnowledgeSearchResult[]): KnowledgeAnswer;
}

export interface ExecutiveKnowledgeAssistant {
  answer(question: string, access: KnowledgeAccessContext): Promise<KnowledgeAnswer>;
}
