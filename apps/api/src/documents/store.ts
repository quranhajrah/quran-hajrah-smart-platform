import type {
  CreateDocumentInput,
  DocumentAccessContext,
  DocumentAuditInput,
  DocumentAuditRecord,
  DocumentCategoryRecord,
  DocumentListQuery,
  DocumentRecord,
  DocumentVersionRecord,
  StoredFileMetadata,
  UpdateDocumentInput,
} from './types.js';

export type DashboardMetrics = {
  total: number;
  active: number;
  underReview: number;
  expiring: number;
  archived: number;
  recent: DocumentRecord[];
};

export interface DocumentStore {
  listCategories(): Promise<DocumentCategoryRecord[]>;
  createDocument(input: CreateDocumentInput): Promise<DocumentRecord>;
  findDocument(id: string): Promise<DocumentRecord | null>;
  listDocuments(
    query: DocumentListQuery,
    access: DocumentAccessContext,
  ): Promise<{ items: DocumentRecord[]; total: number }>;
  updateDocument(id: string, input: UpdateDocumentInput): Promise<DocumentRecord>;
  createVersion(
    documentId: string,
    input: StoredFileMetadata & { notes?: string; createdById: string },
  ): Promise<{ document: DocumentRecord; version: DocumentVersionRecord }>;
  setArchived(id: string, archived: boolean, updatedById: string): Promise<DocumentRecord>;
  softDelete(id: string, deletedById: string): Promise<DocumentRecord>;
  listVersions(documentId: string): Promise<DocumentVersionRecord[]>;
  listAudit(
    documentId: string,
    page: number,
    pageSize: number,
  ): Promise<{ items: DocumentAuditRecord[]; total: number }>;
  createAudit(input: DocumentAuditInput): Promise<void>;
  hasAccessRule(
    documentId: string,
    userId: string,
    roleIds: string[],
    capability: 'view' | 'download' | 'edit',
  ): Promise<boolean>;
  dashboard(access: DocumentAccessContext): Promise<DashboardMetrics>;
}
