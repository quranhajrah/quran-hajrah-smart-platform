import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { AppError } from '../http.js';
import { ExtractionProviderRegistry } from '../analysis/providers.js';
import type { IdentityStore } from '../identity/store.js';
import type { IdentityUser, RequestMeta } from '../identity/types.js';
import { allowedConfidentialityLevels, requireDocumentAccess } from '../documents/security.js';
import type { StorageProvider } from '../documents/storage.js';
import type { DocumentStore } from '../documents/store.js';
import { buildKnowledgeChunks } from './chunking.js';
import {
  cosineSimilarity,
  knowledgeTerms,
  lexicalOverlap,
  LocalArabicHybridEmbeddingProvider,
  normalizeKnowledgeText,
} from './embedding.js';
import type { KnowledgeStore, RelationCandidate } from './store.js';
import type {
  ExecutiveKnowledgeAssistant,
  IndexableDocument,
  KnowledgeAccessContext,
  KnowledgeAnswer,
  KnowledgeAnswerComposer,
  KnowledgeSearchResult,
} from './types.js';

const accessContext = (user: IdentityUser): KnowledgeAccessContext => ({
  userId: user.id,
  roleIds: user.roles.map((role) => role.id),
  allowedLevels: [...allowedConfidentialityLevels(user)],
});

const safeIndexFailure = (error: unknown) => {
  if (error instanceof AppError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return 'Knowledge indexing failed.';
};

const streamToBuffer = async (stream: Readable, maximumBytes: number) => {
  const parts: Buffer[] = [];
  let total = 0;
  for await (const value of stream) {
    const part = Buffer.isBuffer(value) ? value : Buffer.from(value);
    total += part.length;
    if (total > maximumBytes)
      throw new AppError(413, 'Document is too large to index.', 'KNOWLEDGE_FILE_TOO_LARGE');
    parts.push(part);
  }
  return Buffer.concat(parts);
};

const evidenceExcerpt = (content: string, maximum = 420) =>
  content.length <= maximum ? content : `${content.slice(0, maximum).trimEnd()}…`;

export class ExtractiveKnowledgeAnswerComposer implements KnowledgeAnswerComposer {
  compose(_question: string, evidence: KnowledgeSearchResult[]): KnowledgeAnswer {
    if (evidence.length === 0) {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        answer: 'لا تتوفر أدلة مؤسسية كافية في المستندات المفهرسة للإجابة عن هذا السؤال.',
        sources: [],
        limitations: ['لم تُنشأ إجابة لأن الأدلة المتاحة لم تتجاوز حد المطابقة المعتمد.'],
      };
    }
    const sources = evidence.slice(0, 5).map((item, index) => ({ ...item, reference: index + 1 }));
    return {
      status: 'ANSWERED',
      answer: sources
        .map((source) => `• ${evidenceExcerpt(source.excerpt, 260)} [${source.reference}]`)
        .join('\n'),
      sources,
      limitations: [
        'هذه إجابة استخراجية من النصوص المؤسسية وليست استنتاجًا مولدًا.',
        'يجب الرجوع إلى المستند الأصلي وسياقه قبل اتخاذ قرار تنفيذي.',
      ],
    };
  }
}

export class InstitutionalKnowledgeService implements ExecutiveKnowledgeAssistant {
  constructor(
    private readonly store: KnowledgeStore,
    private readonly documentStore: DocumentStore,
    private readonly storage: StorageProvider,
    private readonly identityStore: IdentityStore,
    private readonly maximumFileBytes: number,
    private readonly embeddings = new LocalArabicHybridEmbeddingProvider(),
    private readonly answerComposer: KnowledgeAnswerComposer = new ExtractiveKnowledgeAnswerComposer(),
    private readonly providers = new ExtractionProviderRegistry(),
  ) {}

  summary(user: IdentityUser) {
    return this.store.getIndexSummary(accessContext(user));
  }

  async queueUploadedVersion(documentId: string, documentVersionId: string) {
    const indexId = await this.store.queueIndex(documentId, documentVersionId);
    setImmediate(() => {
      void this.store
        .findIndexableDocument(documentId, documentVersionId)
        .then((source) => {
          if (!source) throw new Error('Uploaded document version is unavailable for indexing.');
          return this.indexSource(source);
        })
        .catch((error) => {
          console.error(
            JSON.stringify({
              event: 'knowledge_background_index_failed',
              documentId,
              documentVersionId,
              errorName: error instanceof Error ? error.name : 'UnknownError',
            }),
          );
        });
    });
    return indexId;
  }

  async indexDocument(
    documentId: string,
    user: IdentityUser,
    context: RequestMeta,
    documentVersionId?: string,
  ) {
    const document = await this.documentStore.findDocument(documentId);
    if (!document) throw new AppError(404, 'Document not found.', 'NOT_FOUND');
    await requireDocumentAccess(this.documentStore, document, user, 'view');
    const source = await this.store.findIndexableDocument(documentId, documentVersionId);
    if (!source) throw new AppError(404, 'Document file not found.', 'FILE_NOT_FOUND');
    const result = await this.indexSource(source);
    await this.identityStore.createAudit({
      userId: user.id,
      action: 'KNOWLEDGE_DOCUMENT_INDEXED',
      entityType: 'Document',
      entityId: documentId,
      description: 'Document indexed in the institutional knowledge layer.',
      metadata: {
        documentVersionId: source.documentVersionId,
        indexVersion: result.indexVersion,
        status: result.status,
        chunkCount: result.chunkCount,
      },
      ...context,
    });
    return result;
  }

  async indexAll() {
    const documents = await this.store.listIndexableDocuments();
    const results: Array<{ documentId: string; status: string; chunkCount?: number }> = [];
    for (const document of documents) {
      try {
        const result = await this.indexSource(document);
        results.push({
          documentId: document.documentId,
          status: result.status,
          chunkCount: result.chunkCount,
        });
      } catch {
        results.push({ documentId: document.documentId, status: 'FAILED' });
      }
    }
    return {
      total: documents.length,
      indexed: results.filter(
        (result) => result.status === 'INDEXED' || result.status === 'PARTIAL',
      ).length,
      failed: results.filter((result) => result.status === 'FAILED').length,
      results,
    };
  }

  async search(question: string, user: IdentityUser, requestedLimit?: number) {
    const startedAt = Date.now();
    const configuration = await this.store.getConfiguration();
    const query = normalizeKnowledgeText(question);
    if (query.length < 2) throw new AppError(400, 'Search query is too short.', 'QUERY_TOO_SHORT');
    const queryEmbedding = this.embeddings.embed(query);
    const queryTerms = knowledgeTerms(query);
    const candidates = await this.store.listCandidates(accessContext(user), 1200);
    const limit = Math.min(
      requestedLimit ?? configuration.maxResults,
      configuration.maxResults,
      20,
    );
    const results = candidates
      .map((candidate) => {
        const semantic = Math.max(0, cosineSimilarity(queryEmbedding, candidate.embedding));
        const lexical = lexicalOverlap(queryTerms, candidate.terms);
        const score = semantic * 0.72 + lexical * 0.28;
        return {
          documentId: candidate.documentId,
          documentVersionId: candidate.documentVersionId,
          documentTitle: candidate.documentTitle,
          documentType: candidate.documentType,
          owningDepartment: candidate.owningDepartment,
          versionNumber: candidate.versionNumber,
          ...(candidate.pageNumber ? { pageNumber: candidate.pageNumber } : {}),
          ...(candidate.section ? { section: candidate.section } : {}),
          excerpt: evidenceExcerpt(candidate.content),
          score: Number(score.toFixed(4)),
          sourceUrl: `/documents/${candidate.documentId}${candidate.pageNumber ? `?page=${candidate.pageNumber}` : ''}`,
        } satisfies KnowledgeSearchResult;
      })
      .filter((result) => result.score >= configuration.minimumScore)
      .sort((left, right) => right.score - left.score)
      .filter(
        (result, index, all) =>
          all.findIndex(
            (candidate) =>
              candidate.documentVersionId === result.documentVersionId &&
              candidate.pageNumber === result.pageNumber &&
              candidate.excerpt === result.excerpt,
          ) === index,
      )
      .slice(0, limit);
    await this.store.logQuery({
      userId: user.id,
      queryHash: createHash('sha256').update(query).digest('hex'),
      resultCount: results.length,
      answerStatus: results.length > 0 ? 'ANSWERED' : 'INSUFFICIENT_EVIDENCE',
      latencyMs: Date.now() - startedAt,
    });
    return results;
  }

  async answer(question: string, access: KnowledgeAccessContext): Promise<KnowledgeAnswer>;
  async answer(question: string, user: IdentityUser): Promise<KnowledgeAnswer>;
  async answer(question: string, actor: KnowledgeAccessContext | IdentityUser) {
    const user = 'roles' in actor ? actor : await this.identityStore.findUserById(actor.userId);
    if (!user) throw new AppError(401, 'Authentication required.', 'UNAUTHENTICATED');
    return this.answerComposer.compose(question, await this.search(question, user, 6));
  }

  async listRelations(documentId: string, user: IdentityUser) {
    const document = await this.documentStore.findDocument(documentId);
    if (!document) throw new AppError(404, 'Document not found.', 'NOT_FOUND');
    await requireDocumentAccess(this.documentStore, document, user, 'view');
    return this.store.listRelations(documentId, accessContext(user));
  }

  private async indexSource(source: IndexableDocument) {
    const configuration = await this.store.getConfiguration();
    const indexId = await this.store.queueIndex(source.documentId, source.documentVersionId);
    await this.store.markProcessing(indexId);
    try {
      const metadataText = [
        source.title,
        source.description,
        source.documentType,
        source.owningDepartment,
        ...source.keywords,
        ...source.tags,
      ]
        .filter(Boolean)
        .join('\n');
      let pages = await this.store.findExtractedPages(source.documentVersionId);
      let sourceKind: 'DOCUMENT_CONTENT' | 'DOCUMENT_METADATA' | 'ANALYSIS_TEXT' =
        pages.length > 0 ? 'ANALYSIS_TEXT' : 'DOCUMENT_METADATA';
      const providerMetadata: Record<string, unknown> = {
        knowledgeIndexVersion: configuration.indexVersion,
        embeddingProvider: this.embeddings.name,
      };
      if (pages.length === 0) {
        try {
          const provider = this.providers.resolve({
            fileName: source.fileName,
            mimeType: source.mimeType,
          });
          const stream = await this.storage.read(source.storagePath);
          const data = await streamToBuffer(stream, this.maximumFileBytes);
          const extraction = await provider.extractDocument({
            fileName: source.fileName,
            mimeType: source.mimeType,
            data,
            maximumBytes: this.maximumFileBytes,
            maximumPages: 500,
            maximumTables: 200,
          });
          pages = extraction.pages.map((page) => ({
            pageNumber: page.pageNumber,
            text: page.text,
          }));
          sourceKind = pages.length > 0 ? 'DOCUMENT_CONTENT' : 'DOCUMENT_METADATA';
          providerMetadata.contentProvider = extraction.provider;
          providerMetadata.contentProviderVersion = extraction.providerVersion;
        } catch (error) {
          providerMetadata.contentFallback =
            error instanceof AppError ? error.code : 'CONTENT_READ_FAILED';
        }
      }
      const combinedPages = [{ section: 'بيانات المستند', text: metadataText }, ...pages];
      const chunks = buildKnowledgeChunks(
        combinedPages,
        configuration.chunkSize,
        configuration.chunkOverlap,
        this.embeddings,
      );
      const contentHash = createHash('sha256')
        .update(chunks.map((chunk) => chunk.contentHash).join(':'))
        .digest('hex');
      const status = pages.length > 0 ? 'INDEXED' : 'PARTIAL';
      await this.store.commitIndex(indexId, {
        sourceKind,
        status,
        contentHash,
        providerMetadata,
        chunks,
      });
      await this.rebuildRelations(source.documentId);
      return {
        indexId,
        indexVersion: configuration.indexVersion,
        status,
        chunkCount: chunks.length,
      };
    } catch (error) {
      await this.store.failIndex(indexId, safeIndexFailure(error));
      throw error;
    }
  }

  private async rebuildRelations(documentId: string) {
    const allAccess: KnowledgeAccessContext = {
      userId: '00000000-0000-0000-0000-000000000000',
      roleIds: [],
      allowedLevels: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL'],
    };
    const candidates = await this.store.listCandidates(allAccess, 2000);
    const grouped = new Map<
      string,
      { documentId: string; versionId: string; terms: Set<string> }
    >();
    for (const candidate of candidates) {
      const current = grouped.get(candidate.documentId) ?? {
        documentId: candidate.documentId,
        versionId: candidate.documentVersionId,
        terms: new Set<string>(),
      };
      candidate.terms.forEach((term) => current.terms.add(term));
      grouped.set(candidate.documentId, current);
    }
    const source = grouped.get(documentId);
    if (!source) return;
    const relations: RelationCandidate[] = [];
    for (const target of grouped.values()) {
      if (target.documentId === source.documentId) continue;
      const sharedTerms = [...source.terms].filter((term) => target.terms.has(term));
      const score = lexicalOverlap([...source.terms], [...target.terms]);
      if (score < 0.16 || sharedTerms.length < 2) continue;
      const [first, second] =
        source.documentId.localeCompare(target.documentId) < 0
          ? [source, target]
          : [target, source];
      relations.push({
        sourceDocumentId: first.documentId,
        targetDocumentId: second.documentId,
        sourceVersionId: first.versionId,
        targetVersionId: second.versionId,
        score: Number(score.toFixed(4)),
        sharedTerms: sharedTerms.slice(0, 20),
        rationale: 'علاقة موضوعية مكتشفة من المصطلحات المؤسسية المشتركة.',
      });
    }
    await this.store.replaceRelations(documentId, relations);
  }
}
