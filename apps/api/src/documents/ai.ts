import type { Readable } from 'node:stream';

export type ExtractedDocumentText = {
  text: string;
  language?: string;
  pageCount?: number;
};

export type DocumentChunk = {
  id: string;
  documentId: string;
  versionId: string;
  text: string;
  sequence: number;
  pageNumber?: number;
};

export type SemanticSearchResult = {
  documentId: string;
  versionId: string;
  chunkId: string;
  score: number;
  excerpt: string;
};

export type SourceCitation = {
  documentId: string;
  versionId: string;
  title: string;
  pageNumber?: number;
  excerpt: string;
};

export interface DocumentTextExtractor {
  extract(input: { content: Readable; mimeType: string }): Promise<ExtractedDocumentText>;
}

export interface DocumentChunker {
  chunk(input: { documentId: string; versionId: string; text: string }): Promise<DocumentChunk[]>;
}

export interface DocumentEmbeddingProvider {
  embed(chunks: DocumentChunk[]): Promise<Array<{ chunkId: string; vector: number[] }>>;
}

export interface DocumentSemanticSearch {
  search(query: string, limit: number): Promise<SemanticSearchResult[]>;
}

export interface KnowledgeAssistant {
  answer(input: {
    question: string;
    results: SemanticSearchResult[];
  }): Promise<{ answer: string; citations: SourceCitation[] }>;
}

// Enterprise 22 intentionally provides contracts only. No external AI provider is instantiated.
