import { createHash } from 'node:crypto';
import { knowledgeTerms } from './embedding.js';
import type { KnowledgeEmbeddingProvider, KnowledgePageSource } from './types.js';

export const buildKnowledgeChunks = (
  pages: KnowledgePageSource[],
  chunkSize: number,
  overlap: number,
  embeddingProvider: KnowledgeEmbeddingProvider,
) => {
  const chunks: Array<{
    sequence: number;
    pageNumber?: number;
    section?: string;
    content: string;
    contentHash: string;
    terms: string[];
    embedding: number[];
    tokenCount: number;
  }> = [];
  let sequence = 0;
  const safeSize = Math.max(200, chunkSize);
  const safeOverlap = Math.min(Math.max(0, overlap), Math.floor(safeSize / 2));

  for (const page of pages) {
    const evidenceText = page.text.normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (!evidenceText) continue;
    const words = evidenceText.split(' ');
    const step = Math.max(1, safeSize - safeOverlap);
    for (let start = 0; start < words.length; start += step) {
      const part = words.slice(start, start + safeSize);
      if (part.length === 0) break;
      const content = part.join(' ');
      chunks.push({
        sequence,
        ...(page.pageNumber === undefined ? {} : { pageNumber: page.pageNumber }),
        ...(page.section ? { section: page.section } : {}),
        content,
        contentHash: createHash('sha256').update(content).digest('hex'),
        terms: knowledgeTerms(content),
        embedding: embeddingProvider.embed(content),
        tokenCount: part.length,
      });
      sequence += 1;
      if (start + safeSize >= words.length) break;
    }
  }
  return chunks;
};
