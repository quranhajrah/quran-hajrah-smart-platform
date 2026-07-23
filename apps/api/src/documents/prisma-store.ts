import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { database } from '@quran-hajrah/database';
import type { DashboardMetrics, DocumentStore } from './store.js';
import type {
  CreateDocumentInput,
  DocumentAccessContext,
  DocumentAuditInput,
  DocumentAuditRecord,
  DocumentListQuery,
  DocumentRecord,
  DocumentVersionRecord,
  UpdateDocumentInput,
} from './types.js';

const documentInclude = {
  category: true,
  createdBy: { select: { id: true, fullName: true } },
  updatedBy: { select: { id: true, fullName: true } },
  tags: { include: { tag: true } },
} satisfies Prisma.DocumentInclude;

const versionInclude = {
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.DocumentVersionInclude;

type PrismaDocumentRecord = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;
type PrismaDocumentVersion = Prisma.DocumentVersionGetPayload<{ include: typeof versionInclude }>;

const mapDocument = (record: PrismaDocumentRecord): DocumentRecord => ({
  ...record,
  tags: record.tags.map(({ tag }) => tag),
});

const mapVersion = (record: PrismaDocumentVersion): DocumentVersionRecord => record;

const normalizeTags = (tags: string[]) =>
  [...new Set(tags.map((tag) => tag.normalize('NFC').trim()).filter(Boolean))].slice(0, 20);

const tagSlug = (name: string) =>
  `tag-${createHash('sha256').update(name.toLocaleLowerCase('ar')).digest('hex').slice(0, 24)}`;

const tagAssignments = (tags: string[]) => ({
  create: normalizeTags(tags).map((name) => ({
    tag: {
      connectOrCreate: {
        where: { name },
        create: { name, slug: tagSlug(name) },
      },
    },
  })),
});

const accessWhere = (access: DocumentAccessContext): Prisma.DocumentWhereInput => ({
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

const listWhere = (
  query: DocumentListQuery,
  access: DocumentAccessContext,
): Prisma.DocumentWhereInput => ({
  deletedAt: null,
  isArchived: query.archived ?? false,
  AND: [
    accessWhere(access),
    ...(query.search
      ? [
          {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' as const } },
              { description: { contains: query.search, mode: 'insensitive' as const } },
              { documentNumber: { contains: query.search, mode: 'insensitive' as const } },
              { owningDepartment: { contains: query.search, mode: 'insensitive' as const } },
              {
                tags: {
                  some: { tag: { name: { contains: query.search, mode: 'insensitive' as const } } },
                },
              },
            ],
          },
        ]
      : []),
  ],
  ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  ...(query.documentType ? { documentType: query.documentType } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.owningDepartment
    ? { owningDepartment: { contains: query.owningDepartment, mode: 'insensitive' } }
    : {}),
  ...(query.confidentialityLevel ? { confidentialityLevel: query.confidentialityLevel } : {}),
  ...(query.dateFrom || query.dateTo
    ? {
        documentDate: {
          ...(query.dateFrom ? { gte: query.dateFrom } : {}),
          ...(query.dateTo ? { lte: query.dateTo } : {}),
        },
      }
    : {}),
});

export class PrismaDocumentStore implements DocumentStore {
  listCategories() {
    return database.documentCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createDocument(input: CreateDocumentInput) {
    const { tags, ...data } = input;
    const document = await database.document.create({
      data: { ...data, tags: tagAssignments(tags) },
      include: documentInclude,
    });
    return mapDocument(document);
  }

  async findDocument(id: string) {
    const document = await database.document.findFirst({
      where: { id, deletedAt: null },
      include: documentInclude,
    });
    return document ? mapDocument(document) : null;
  }

  async listDocuments(query: DocumentListQuery, access: DocumentAccessContext) {
    const where = listWhere(query, access);
    const [items, total] = await database.$transaction([
      database.document.findMany({
        where,
        include: documentInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      database.document.count({ where }),
    ]);
    return { items: items.map(mapDocument), total };
  }

  async updateDocument(id: string, input: UpdateDocumentInput) {
    const { tags, ...data } = input;
    return database.$transaction(async (transaction) => {
      await transaction.document.update({
        where: { id },
        data,
      });
      if (tags) {
        await transaction.documentTagAssignment.deleteMany({ where: { documentId: id } });
        await transaction.document.update({
          where: { id },
          data: { tags: tagAssignments(tags) },
        });
      }
      return mapDocument(
        await transaction.document.findUniqueOrThrow({ where: { id }, include: documentInclude }),
      );
    });
  }

  async createVersion(documentId: string, input: Parameters<DocumentStore['createVersion']>[1]) {
    return database.$transaction(async (transaction) => {
      const current = await transaction.document.findFirstOrThrow({
        where: { id: documentId, deletedAt: null },
      });
      const versionNumber = current.versionNumber + 1;
      const updated = await transaction.document.updateMany({
        where: { id: documentId, versionNumber: current.versionNumber, deletedAt: null },
        data: {
          originalFileName: input.originalFileName,
          storedFileName: input.storedFileName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          storagePath: input.storagePath,
          versionNumber,
          updatedById: input.createdById,
          ...(current.status === 'DRAFT' ? { status: 'ACTIVE' } : {}),
        },
      });
      if (updated.count !== 1) throw new Error('The document was updated concurrently.');
      const version = await transaction.documentVersion.create({
        data: {
          documentId,
          versionNumber,
          originalFileName: input.originalFileName,
          storedFileName: input.storedFileName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          storagePath: input.storagePath,
          checksum: input.checksum,
          notes: input.notes,
          createdById: input.createdById,
        },
        include: versionInclude,
      });
      const document = await transaction.document.findUniqueOrThrow({
        where: { id: documentId },
        include: documentInclude,
      });
      return { document: mapDocument(document), version: mapVersion(version) };
    });
  }

  async setArchived(id: string, archived: boolean, updatedById: string) {
    const document = await database.document.update({
      where: { id },
      data: {
        isArchived: archived,
        status: archived ? 'ARCHIVED' : 'ACTIVE',
        updatedById,
      },
      include: documentInclude,
    });
    return mapDocument(document);
  }

  async softDelete(id: string, deletedById: string) {
    return mapDocument(
      await database.document.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById,
          isArchived: true,
          status: 'ARCHIVED',
          updatedById: deletedById,
        },
        include: documentInclude,
      }),
    );
  }

  async listVersions(documentId: string) {
    return (
      await database.documentVersion.findMany({
        where: { documentId },
        include: versionInclude,
        orderBy: { versionNumber: 'desc' },
      })
    ).map(mapVersion);
  }

  async listAudit(documentId: string, page: number, pageSize: number) {
    const [items, total] = await database.$transaction([
      database.documentAuditLog.findMany({
        where: { documentId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { id: true, fullName: true } } },
      }),
      database.documentAuditLog.count({ where: { documentId } }),
    ]);
    return {
      items: items.map((item): DocumentAuditRecord => ({
        ...item,
        action: item.action,
        metadata: item.metadata as Record<string, unknown> | null,
      })),
      total,
    };
  }

  async createAudit(input: DocumentAuditInput) {
    await database.documentAuditLog.create({
      data: {
        ...input,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async hasAccessRule(
    documentId: string,
    userId: string,
    roleIds: string[],
    capability: 'view' | 'download' | 'edit',
  ) {
    const capabilityField = {
      view: 'canView',
      download: 'canDownload',
      edit: 'canEdit',
    } as const;
    const count = await database.documentAccessRule.count({
      where: {
        documentId,
        [capabilityField[capability]]: true,
        OR: [{ userId }, ...(roleIds.length > 0 ? [{ roleId: { in: roleIds } }] : [])],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      },
    });
    return count > 0;
  }

  async dashboard(access: DocumentAccessContext): Promise<DashboardMetrics> {
    const visible = {
      deletedAt: null,
      AND: [accessWhere(access)],
    } satisfies Prisma.DocumentWhereInput;
    const now = new Date();
    const expiryThreshold = new Date(now);
    expiryThreshold.setDate(expiryThreshold.getDate() + 30);
    const [total, active, underReview, expiring, archived, recent] = await database.$transaction([
      database.document.count({ where: visible }),
      database.document.count({ where: { ...visible, isArchived: false, status: 'ACTIVE' } }),
      database.document.count({ where: { ...visible, isArchived: false, status: 'UNDER_REVIEW' } }),
      database.document.count({
        where: {
          ...visible,
          isArchived: false,
          expiryDate: { gte: now, lte: expiryThreshold },
        },
      }),
      database.document.count({ where: { ...visible, isArchived: true } }),
      database.document.findMany({
        where: { ...visible, isArchived: false },
        include: documentInclude,
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);
    return { total, active, underReview, expiring, archived, recent: recent.map(mapDocument) };
  }
}
