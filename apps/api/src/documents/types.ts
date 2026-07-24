import type { Readable } from 'node:stream';
import type { IdentityUser, RequestMeta } from '../identity/types.js';

export const documentStatuses = ['DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'EXPIRED', 'ARCHIVED'] as const;
export type DocumentStatus = (typeof documentStatuses)[number];

export const confidentialityLevels = [
  'PUBLIC',
  'INTERNAL',
  'CONFIDENTIAL',
  'HIGHLY_CONFIDENTIAL',
] as const;
export type ConfidentialityLevel = (typeof confidentialityLevels)[number];

export const documentTypes = [
  'STRATEGIC_PLAN',
  'OPERATIONAL_PLAN',
  'BUDGET',
  'POLICY',
  'REGULATION',
  'REPORT',
  'MINUTES',
  'LETTER',
  'CONTRACT',
  'GOVERNANCE',
  'FINANCIAL',
  'PROGRAM',
  'EMPLOYEE',
  'EDUCATIONAL',
  'MEDIA',
  'OTHER',
] as const;
export type DocumentType = (typeof documentTypes)[number];

export type DocumentAuditAction =
  | 'CREATED'
  | 'UPLOADED'
  | 'VIEWED'
  | 'DOWNLOADED'
  | 'UPDATED'
  | 'VERSION_UPLOADED'
  | 'ARCHIVED'
  | 'RESTORED'
  | 'DELETED';

export type DocumentCategoryRecord = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type OwningDepartmentRecord = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  sortOrder: number;
};

export type DocumentLookups = {
  categories: DocumentCategoryRecord[];
  owningDepartments: OwningDepartmentRecord[];
};

export type DocumentActor = { id: string; fullName: string };
export type DocumentTagRecord = { id: string; name: string; slug: string };

export type DocumentRecord = {
  id: string;
  title: string;
  description?: string | null;
  originalFileName?: string | null;
  storedFileName?: string | null;
  mimeType?: string | null;
  fileSize?: bigint | null;
  storagePath?: string | null;
  categoryId: string;
  category: DocumentCategoryRecord;
  documentType: DocumentType;
  documentNumber?: string | null;
  documentDate?: Date | null;
  effectiveDate?: Date | null;
  expiryDate?: Date | null;
  versionNumber: number;
  status: DocumentStatus;
  confidentialityLevel: ConfidentialityLevel;
  owningDepartment: string;
  keywords: string[];
  isArchived: boolean;
  deletedAt?: Date | null;
  createdById: string;
  updatedById: string;
  createdBy: DocumentActor;
  updatedBy: DocumentActor;
  createdAt: Date;
  updatedAt: Date;
  tags: DocumentTagRecord[];
};

export type PublicDocument = Omit<DocumentRecord, 'storagePath' | 'storedFileName' | 'fileSize'> & {
  fileSize?: number | null;
  hasFile: boolean;
};

export type DocumentVersionRecord = {
  id: string;
  documentId: string;
  versionNumber: number;
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: bigint;
  storagePath: string;
  checksum: string;
  notes?: string | null;
  createdById: string;
  createdBy: DocumentActor;
  createdAt: Date;
};

export type PublicDocumentVersion = Omit<
  DocumentVersionRecord,
  'storagePath' | 'storedFileName' | 'checksum' | 'fileSize'
> & {
  fileSize: number;
};

export type DocumentAuditRecord = {
  id: string;
  documentId: string;
  versionId?: string | null;
  userId?: string | null;
  action: DocumentAuditAction;
  description: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
  user?: DocumentActor | null;
};

export type DocumentAccessContext = {
  userId: string;
  roleIds: string[];
  allowedLevels: ConfidentialityLevel[];
};

export type DocumentListQuery = {
  page: number;
  pageSize: number;
  search?: string;
  categoryId?: string;
  documentType?: DocumentType;
  status?: DocumentStatus;
  owningDepartment?: string;
  confidentialityLevel?: ConfidentialityLevel;
  dateFrom?: Date;
  dateTo?: Date;
  archived?: boolean;
};

export type CreateDocumentInput = {
  title: string;
  description?: string;
  categoryId: string;
  documentType: DocumentType;
  documentNumber?: string;
  documentDate?: Date;
  effectiveDate?: Date;
  expiryDate?: Date;
  status: DocumentStatus;
  confidentialityLevel: ConfidentialityLevel;
  owningDepartment: string;
  keywords: string[];
  tags: string[];
  createdById: string;
  updatedById: string;
};

export type UpdateDocumentInput = Partial<
  Omit<CreateDocumentInput, 'createdById' | 'updatedById' | 'tags'>
> & {
  updatedById: string;
  tags?: string[];
};

export type StoredFileMetadata = {
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: bigint;
  storagePath: string;
  checksum: string;
};

export type DocumentAuditInput = RequestMeta & {
  documentId: string;
  versionId?: string;
  userId?: string;
  action: DocumentAuditAction;
  description: string;
  metadata?: Record<string, unknown>;
};

export type DownloadedDocument = {
  stream: Readable;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

export const toPublicDocument = (document: DocumentRecord): PublicDocument => {
  const safe = Object.fromEntries(
    Object.entries(document).filter(
      ([key]) => key !== 'storagePath' && key !== 'storedFileName' && key !== 'fileSize',
    ),
  ) as Omit<DocumentRecord, 'storagePath' | 'storedFileName' | 'fileSize'>;
  return {
    ...safe,
    fileSize:
      document.fileSize === null || document.fileSize === undefined
        ? null
        : Number(document.fileSize),
    hasFile: Boolean(document.storagePath),
  };
};

export const toPublicVersion = (version: DocumentVersionRecord): PublicDocumentVersion => {
  const safe = Object.fromEntries(
    Object.entries(version).filter(
      ([key]) =>
        key !== 'storagePath' &&
        key !== 'storedFileName' &&
        key !== 'checksum' &&
        key !== 'fileSize',
    ),
  ) as Omit<DocumentVersionRecord, 'storagePath' | 'storedFileName' | 'checksum' | 'fileSize'>;
  return { ...safe, fileSize: Number(version.fileSize) };
};

export const roleNames = (user: IdentityUser) => user.roles.map((role) => role.name);
