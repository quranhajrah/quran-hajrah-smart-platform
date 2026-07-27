import type { Prisma } from '@prisma/client';
import { database } from '@quran-hajrah/database';
import {
  KNOWLEDGE_INDEX_VERSION,
  LOCAL_EMBEDDING_DIMENSIONS,
  LOCAL_EMBEDDING_PROVIDER,
  type KnowledgeAccessContext,
} from './types.js';
import type { KnowledgeStore, RelationCandidate } from './store.js';

const visibleDocumentWhere = (access: KnowledgeAccessContext): Prisma.DocumentWhereInput => ({
  deletedAt: null,
  OR: [
    { confidentialityLevel: { in: access.allowedLevels } },
    {
      accessRules: {
        some: {
          canView: true,
          AND: [
            {
              OR: [
                { userId: access.userId },
                ...(access.roleIds.length > 0 ? [{ roleId: { in: access.roleIds } }] : []),
              ],
            },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          ],
        },
      },
    },
  ],
});

const mapIndexable = (document: {
  id: string;
  title: string;
  description: string | null;
  documentType: string;
  owningDepartment: string;
  keywords: string[];
  tags: Array<{ tag: { name: string } }>;
  versions: Array<{
    id: string;
    versionNumber: number;
    originalFileName: string;
    mimeType: string;
    fileSize: bigint;
    storagePath: string;
  }>;
}) => {
  const version = document.versions[0];
  if (!version) return null;
  return {
    documentId: document.id,
    documentVersionId: version.id,
    title: document.title,
    description: document.description,
    documentType: document.documentType,
    owningDepartment: document.owningDepartment,
    keywords: document.keywords,
    tags: document.tags.map(({ tag }) => tag.name),
    versionNumber: version.versionNumber,
    fileName: version.originalFileName,
    mimeType: version.mimeType,
    fileSize: Number(version.fileSize),
    storagePath: version.storagePath,
  };
};

const documentSelection = {
  id: true,
  title: true,
  description: true,
  documentType: true,
  owningDepartment: true,
  keywords: true,
  tags: { include: { tag: { select: { name: true } } } },
  versions: {
    orderBy: { versionNumber: 'desc' as const },
    take: 1,
    select: {
      id: true,
      versionNumber: true,
      originalFileName: true,
      mimeType: true,
      fileSize: true,
      storagePath: true,
    },
  },
};

export class PrismaKnowledgeStore implements KnowledgeStore {
  async getConfiguration() {
    const configuration = await database.knowledgeIndexConfiguration.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    return (
      configuration ?? {
        key: 'default',
        indexVersion: KNOWLEDGE_INDEX_VERSION,
        embeddingProvider: LOCAL_EMBEDDING_PROVIDER,
        embeddingDimensions: LOCAL_EMBEDDING_DIMENSIONS,
        chunkSize: 220,
        chunkOverlap: 40,
        minimumScore: 0.2,
        maxResults: 8,
        isActive: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      }
    );
  }

  async listIndexableDocuments() {
    const documents = await database.document.findMany({
      where: { deletedAt: null, versions: { some: {} } },
      select: documentSelection,
      orderBy: { updatedAt: 'asc' },
    });
    return documents.map(mapIndexable).filter((item) => item !== null);
  }

  async findIndexableDocument(documentId: string, documentVersionId?: string) {
    const document = await database.document.findFirst({
      where: {
        id: documentId,
        deletedAt: null,
        ...(documentVersionId ? { versions: { some: { id: documentVersionId } } } : {}),
      },
      select: {
        ...documentSelection,
        ...(documentVersionId
          ? {
              versions: {
                where: { id: documentVersionId },
                take: 1,
                select: documentSelection.versions.select,
              },
            }
          : {}),
      },
    });
    return document ? mapIndexable(document) : null;
  }

  async findExtractedPages(documentVersionId: string) {
    const job = await database.documentAnalysisJob.findFirst({
      where: {
        documentVersionId,
        deletedAt: null,
        status: {
          in: [
            'TEXT_EXTRACTED',
            'PROPOSALS_READY',
            'UNDER_REVIEW',
            'PARTIALLY_APPROVED',
            'APPROVED',
            'IMPORTED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          select: {
            pageNumber: true,
            extractedText: { select: { normalizedText: true } },
          },
        },
      },
    });
    return (job?.pages ?? [])
      .filter((page) => Boolean(page.extractedText?.normalizedText.trim()))
      .map((page) => ({
        pageNumber: page.pageNumber,
        text: page.extractedText!.normalizedText,
      }));
  }

  async queueIndex(documentId: string, documentVersionId: string) {
    const configuration = await this.getConfiguration();
    const record = await database.knowledgeDocumentIndex.upsert({
      where: {
        documentVersionId_indexVersion: {
          documentVersionId,
          indexVersion: configuration.indexVersion,
        },
      },
      create: {
        documentId,
        documentVersionId,
        status: 'QUEUED',
        sourceKind: 'DOCUMENT_METADATA',
        indexVersion: configuration.indexVersion,
        embeddingProvider: configuration.embeddingProvider,
        embeddingDimensions: configuration.embeddingDimensions,
      },
      update: { status: 'QUEUED', failureReason: null },
      select: { id: true },
    });
    return record.id;
  }

  async markProcessing(indexId: string) {
    await database.knowledgeDocumentIndex.update({
      where: { id: indexId },
      data: { status: 'PROCESSING', failureReason: null },
    });
  }

  async commitIndex(indexId: string, input: Parameters<KnowledgeStore['commitIndex']>[1]) {
    await database.$transaction(async (transaction) => {
      const current = await transaction.knowledgeDocumentIndex.findUniqueOrThrow({
        where: { id: indexId },
        select: { documentId: true, documentVersionId: true },
      });
      await transaction.knowledgeChunk.deleteMany({ where: { indexId } });
      if (input.chunks.length > 0) {
        await transaction.knowledgeChunk.createMany({
          data: input.chunks.map((chunk) => ({
            ...chunk,
            indexId,
            documentId: current.documentId,
            documentVersionId: current.documentVersionId,
          })),
        });
      }
      await transaction.knowledgeDocumentIndex.updateMany({
        where: { documentId: current.documentId, id: { not: indexId } },
        data: { isCurrent: false },
      });
      await transaction.knowledgeDocumentIndex.update({
        where: { id: indexId },
        data: {
          status: input.status,
          sourceKind: input.sourceKind,
          contentHash: input.contentHash,
          chunkCount: input.chunks.length,
          providerMetadata: input.providerMetadata as Prisma.InputJsonValue,
          failureReason: null,
          indexedAt: new Date(),
          isCurrent: true,
        },
      });
    });
  }

  async failIndex(indexId: string, reason: string) {
    await database.knowledgeDocumentIndex.update({
      where: { id: indexId },
      data: { status: 'FAILED', failureReason: reason.slice(0, 500), isCurrent: false },
    });
  }

  async listCandidates(access: KnowledgeAccessContext, limit: number) {
    const records = await database.knowledgeChunk.findMany({
      where: {
        index: {
          isCurrent: true,
          status: { in: ['INDEXED', 'PARTIAL'] },
          document: visibleDocumentWhere(access),
        },
      },
      include: {
        index: {
          include: {
            document: { select: { title: true, documentType: true, owningDepartment: true } },
            documentVersion: { select: { versionNumber: true } },
          },
        },
      },
      take: Math.min(2000, Math.max(50, limit)),
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => ({
      chunkId: record.id,
      documentId: record.documentId,
      documentVersionId: record.documentVersionId,
      documentTitle: record.index.document.title,
      documentType: record.index.document.documentType,
      owningDepartment: record.index.document.owningDepartment,
      versionNumber: record.index.documentVersion.versionNumber,
      pageNumber: record.pageNumber,
      section: record.section,
      content: record.content,
      terms: record.terms,
      embedding: record.embedding,
    }));
  }

  async replaceRelations(documentId: string, relations: RelationCandidate[]) {
    await database.$transaction(async (transaction) => {
      await transaction.knowledgeDocumentRelation.deleteMany({
        where: { OR: [{ sourceDocumentId: documentId }, { targetDocumentId: documentId }] },
      });
      if (relations.length > 0) {
        await transaction.knowledgeDocumentRelation.createMany({
          data: relations.map((relation) => ({
            ...relation,
            relationType: 'SHARES_TOPIC',
            discoveredBy: LOCAL_EMBEDDING_PROVIDER,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  async listRelations(documentId: string, access: KnowledgeAccessContext) {
    const records = await database.knowledgeDocumentRelation.findMany({
      where: {
        OR: [
          { sourceDocumentId: documentId, targetDocument: visibleDocumentWhere(access) },
          { targetDocumentId: documentId, sourceDocument: visibleDocumentWhere(access) },
        ],
      },
      include: {
        sourceDocument: {
          select: { id: true, title: true, documentType: true, owningDepartment: true },
        },
        targetDocument: {
          select: { id: true, title: true, documentType: true, owningDepartment: true },
        },
      },
      orderBy: { score: 'desc' },
      take: 25,
    });
    return records.map((record) => ({
      id: record.id,
      sourceDocumentId: record.sourceDocumentId,
      targetDocumentId: record.targetDocumentId,
      relationType: record.relationType,
      score: Number(record.score),
      sharedTerms: record.sharedTerms,
      rationale: record.rationale,
      relatedDocument:
        record.sourceDocumentId === documentId ? record.targetDocument : record.sourceDocument,
    }));
  }

  async getIndexSummary(access: KnowledgeAccessContext) {
    const visible = visibleDocumentWhere(access);
    const [indexedDocuments, queuedDocuments, failedDocuments, chunks, relations] =
      await database.$transaction([
        database.knowledgeDocumentIndex.count({
          where: { isCurrent: true, status: { in: ['INDEXED', 'PARTIAL'] }, document: visible },
        }),
        database.knowledgeDocumentIndex.count({
          where: { status: { in: ['QUEUED', 'PROCESSING'] }, document: visible },
        }),
        database.knowledgeDocumentIndex.count({
          where: { status: 'FAILED', document: visible },
        }),
        database.knowledgeChunk.count({
          where: { index: { isCurrent: true, document: visible } },
        }),
        database.knowledgeDocumentRelation.count({
          where: { sourceDocument: visible, targetDocument: visible },
        }),
      ]);
    return {
      indexedDocuments,
      queuedDocuments,
      failedDocuments,
      chunkCount: chunks,
      relationCount: relations,
    };
  }

  async logQuery(input: Parameters<KnowledgeStore['logQuery']>[0]) {
    await database.knowledgeQueryLog.create({ data: input });
  }
}
