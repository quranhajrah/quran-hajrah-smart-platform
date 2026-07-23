import { createHash } from 'node:crypto';
import { AppError } from '../http.js';
import type { IdentityUser, RequestMeta } from '../identity/types.js';
import {
  allowedConfidentialityLevels,
  requireDocumentAccess,
  validateDocumentFile,
} from './security.js';
import type { StorageProvider } from './storage.js';
import type { DocumentStore } from './store.js';
import type {
  CreateDocumentInput,
  DocumentAccessContext,
  DocumentListQuery,
  DownloadedDocument,
  UpdateDocumentInput,
} from './types.js';

const accessContext = (user: IdentityUser): DocumentAccessContext => ({
  userId: user.id,
  roleIds: user.roles.map((role) => role.id),
  allowedLevels: [...allowedConfidentialityLevels(user)],
});

export class DocumentService {
  constructor(
    private readonly store: DocumentStore,
    private readonly storage: StorageProvider,
    private readonly maximumFileSize: number,
  ) {}

  listCategories() {
    return this.store.listCategories();
  }

  dashboard(user: IdentityUser) {
    return this.store.dashboard(accessContext(user));
  }

  list(query: DocumentListQuery, user: IdentityUser) {
    return this.store.listDocuments(query, accessContext(user));
  }

  async create(
    input: Omit<CreateDocumentInput, 'createdById' | 'updatedById'>,
    user: IdentityUser,
    context: RequestMeta,
  ) {
    await this.ensureCategory(input.categoryId);
    const document = await this.store.createDocument({
      ...input,
      createdById: user.id,
      updatedById: user.id,
    });
    await this.store.createAudit({
      documentId: document.id,
      userId: user.id,
      action: 'CREATED',
      description: 'Document metadata created.',
      metadata: {
        status: document.status,
        confidentialityLevel: document.confidentialityLevel,
      },
      ...context,
    });
    return document;
  }

  async get(id: string, user: IdentityUser, context: RequestMeta, auditView = true) {
    const document = await this.requiredDocument(id);
    await requireDocumentAccess(this.store, document, user, 'view');
    if (auditView) {
      await this.store.createAudit({
        documentId: document.id,
        userId: user.id,
        action: 'VIEWED',
        description: 'Document details viewed.',
        ...context,
      });
    }
    return document;
  }

  async update(
    id: string,
    input: Omit<UpdateDocumentInput, 'updatedById'>,
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const current = await this.requiredDocument(id);
    await requireDocumentAccess(this.store, current, user, 'edit');
    if (current.isArchived)
      throw new AppError(409, 'Archived documents cannot be edited.', 'DOCUMENT_ARCHIVED');
    if (input.categoryId) await this.ensureCategory(input.categoryId);
    const document = await this.store.updateDocument(id, { ...input, updatedById: user.id });
    await this.store.createAudit({
      documentId: id,
      userId: user.id,
      action: 'UPDATED',
      description: 'Document metadata updated.',
      metadata: { fields: Object.keys(input) },
      ...context,
    });
    return document;
  }

  async upload(
    id: string,
    file: { data: unknown; originalFileName: string; mimeType: string; notes?: string },
    user: IdentityUser,
    context: RequestMeta,
  ) {
    const document = await this.requiredDocument(id);
    await requireDocumentAccess(this.store, document, user, 'edit');
    if (document.isArchived) {
      throw new AppError(
        409,
        'Archived documents cannot receive new versions.',
        'DOCUMENT_ARCHIVED',
      );
    }
    const validated = validateDocumentFile(
      file.data,
      file.originalFileName,
      file.mimeType,
      this.maximumFileSize,
    );
    const safeName = this.storage.generateSafeName(validated.originalFileName);
    const stored = await this.storage.save({
      safeName,
      data: validated.data,
      directory: document.id,
    });
    const isInitialUpload = document.versionNumber === 0;
    try {
      const result = await this.store.createVersion(document.id, {
        originalFileName: validated.originalFileName,
        storedFileName: safeName,
        mimeType: validated.mimeType,
        fileSize: BigInt(validated.data.byteLength),
        storagePath: stored.path,
        checksum: createHash('sha256').update(validated.data).digest('hex'),
        notes: file.notes,
        createdById: user.id,
      });
      const action = isInitialUpload ? 'UPLOADED' : 'VERSION_UPLOADED';
      await this.store.createAudit({
        documentId: document.id,
        versionId: result.version.id,
        userId: user.id,
        action,
        description:
          action === 'UPLOADED' ? 'Document file uploaded.' : 'New document version uploaded.',
        metadata: {
          versionNumber: result.version.versionNumber,
          mimeType: validated.mimeType,
          fileSize: validated.data.byteLength,
        },
        ...context,
      });
      return result;
    } catch (error) {
      await this.storage.delete(stored.path);
      throw error;
    }
  }

  async download(
    id: string,
    user: IdentityUser,
    context: RequestMeta,
  ): Promise<DownloadedDocument> {
    const document = await this.requiredDocument(id);
    await requireDocumentAccess(this.store, document, user, 'download');
    if (
      !document.storagePath ||
      !document.originalFileName ||
      !document.mimeType ||
      document.fileSize === null ||
      document.fileSize === undefined
    ) {
      throw new AppError(404, 'Document file not found.', 'FILE_NOT_FOUND');
    }
    if (!(await this.storage.exists(document.storagePath))) {
      throw new AppError(404, 'Document file not found.', 'FILE_NOT_FOUND');
    }
    const stream = await this.storage.read(document.storagePath);
    await this.store.createAudit({
      documentId: document.id,
      userId: user.id,
      action: 'DOWNLOADED',
      description: 'Document downloaded.',
      metadata: { versionNumber: document.versionNumber },
      ...context,
    });
    return {
      stream,
      fileName: document.originalFileName,
      mimeType: document.mimeType,
      fileSize: Number(document.fileSize),
    };
  }

  async archive(id: string, archived: boolean, user: IdentityUser, context: RequestMeta) {
    const current = await this.requiredDocument(id);
    await requireDocumentAccess(this.store, current, user, 'edit');
    if (current.isArchived === archived) return current;
    const document = await this.store.setArchived(id, archived, user.id);
    await this.store.createAudit({
      documentId: id,
      userId: user.id,
      action: archived ? 'ARCHIVED' : 'RESTORED',
      description: archived ? 'Document archived.' : 'Document restored.',
      ...context,
    });
    return document;
  }

  async softDelete(id: string, user: IdentityUser, context: RequestMeta) {
    const current = await this.requiredDocument(id);
    await requireDocumentAccess(this.store, current, user, 'edit');
    const document = await this.store.softDelete(id, user.id);
    await this.store.createAudit({
      documentId: id,
      userId: user.id,
      action: 'DELETED',
      description: 'Document soft deleted.',
      ...context,
    });
    return document;
  }

  async versions(id: string, user: IdentityUser) {
    const document = await this.requiredDocument(id);
    await requireDocumentAccess(this.store, document, user, 'view');
    return this.store.listVersions(id);
  }

  async audit(id: string, page: number, pageSize: number, user: IdentityUser) {
    const document = await this.requiredDocument(id);
    await requireDocumentAccess(this.store, document, user, 'view');
    return this.store.listAudit(id, page, pageSize);
  }

  private async requiredDocument(id: string) {
    const document = await this.store.findDocument(id);
    if (!document) throw new AppError(404, 'Document not found.', 'NOT_FOUND');
    return document;
  }

  private async ensureCategory(id: string) {
    if (!(await this.store.listCategories()).some((category) => category.id === id)) {
      throw new AppError(400, 'Document category is invalid.', 'INVALID_CATEGORY');
    }
  }
}
