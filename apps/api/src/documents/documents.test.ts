import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { AppConfig } from '../config.js';
import type { IdentityStore } from '../identity/store.js';
import { signAccessToken } from '../identity/security.js';
import type { AuditEntry, IdentityUser, PublicRole, RefreshSession } from '../identity/types.js';
import { MemoryStorageProvider } from './storage.js';
import type { DashboardMetrics, DocumentStore } from './store.js';
import type {
  CreateDocumentInput,
  DocumentAccessContext,
  DocumentAuditInput,
  DocumentAuditRecord,
  DocumentCategoryRecord,
  DocumentListQuery,
  DocumentRecord,
  DocumentVersionRecord,
  OwningDepartmentRecord,
  UpdateDocumentInput,
} from './types.js';

const config: AppConfig = {
  nodeEnv: 'test',
  isProduction: false,
  port: 3000,
  adminOrigin: 'https://admin.example.test',
  portalOrigin: 'https://portal.example.test',
  corsOrigins: ['https://admin.example.test'],
  accessTokenSecret: 'test-only-access-secret-that-is-longer-than-32-characters',
  refreshTokenSecret: 'test-only-refresh-secret-that-is-longer-than-32-characters',
  accessTokenTtl: '15m',
  refreshTokenTtlMs: 604_800_000,
  cookieName: 'test_refresh',
  cookieSecure: false,
  cookieSameSite: 'lax',
  bcryptRounds: 4,
  trustProxy: false,
  logLevel: 'silent',
  rateLimitWindowMs: 60_000,
  rateLimitMax: 300,
  adminDistPath: 'missing-admin-dist',
  portalDistPath: 'missing-portal-dist',
  documentStorageRoot: 'missing-document-storage',
  documentMaxFileSizeBytes: 1024 * 1024,
};

const allDocumentPermissions = [
  'documents.view',
  'documents.create',
  'documents.update',
  'documents.upload',
  'documents.download',
  'documents.archive',
  'documents.delete',
  'documents.audit',
  'documents.manage_access',
];

const role = (name: string, permissions: string[]): PublicRole => ({
  id: randomUUID(),
  name,
  displayName: name,
  isSystem: true,
  permissions,
});

const user = (email: string, assignedRole: PublicRole): IdentityUser => {
  const now = new Date();
  return {
    id: randomUUID(),
    fullName: email,
    email,
    passwordHash: 'not-used-by-these-tests',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    roles: [assignedRole],
  };
};

class TestIdentityStore implements IdentityStore {
  constructor(readonly users: IdentityUser[]) {}
  findUserByEmail = async (email: string) =>
    this.users.find((item) => item.email === email) ?? null;
  findUserById = async (id: string) => this.users.find((item) => item.id === id) ?? null;
  touchLastLogin = async () => undefined;
  createSession = async (input: Omit<RefreshSession, 'id'>) => ({ id: randomUUID(), ...input });
  findSession = async () => null;
  revokeSession = async () => undefined;
  revokeUserSessions = async () => undefined;
  listUsers = async () => ({ items: this.users, total: this.users.length });
  createUser = async () => {
    throw new Error('Not implemented in document tests.');
  };
  updateUser = async () => {
    throw new Error('Not implemented in document tests.');
  };
  setUserRoles = async () => {
    throw new Error('Not implemented in document tests.');
  };
  countActiveSuperAdmins = async () => 1;
  listRoles = async () => [];
  listPermissions = async () => [];
  createRole = async () => {
    throw new Error('Not implemented in document tests.');
  };
  updateRole = async () => {
    throw new Error('Not implemented in document tests.');
  };
  setRolePermissions = async () => {
    throw new Error('Not implemented in document tests.');
  };
  createAudit = async (entry: AuditEntry) => {
    void entry;
  };
  listAudit = async () => ({ items: [], total: 0 });
}

const expectedCategoryNames = [
  'الخطط الاستراتيجية',
  'الخطط التشغيلية',
  'الموازنات',
  'اللوائح والسياسات',
  'الحوكمة والامتثال',
  'التقارير',
  'محاضر الاجتماعات',
  'الخطابات',
  'العقود',
  'البرامج والمبادرات',
  'الشؤون التعليمية',
  'الشؤون المالية',
  'الموارد البشرية',
  'الإعلام',
  'الأوقاف',
  'ملفات أخرى',
] as const;

const expectedOwningDepartmentNames = [
  'الإدارة التنفيذية',
  'الشؤون التعليمية',
  'الشؤون المالية',
  'تنمية الموارد',
  'الحوكمة',
  'الإعلام',
  'الموارد البشرية',
  'مجلس الإدارة',
] as const;

class TestDocumentStore implements DocumentStore {
  readonly categories: DocumentCategoryRecord[] = expectedCategoryNames.map((name, sortOrder) => ({
    id: randomUUID(),
    name,
    slug: `category-${sortOrder}`,
    isActive: true,
    sortOrder,
  }));
  readonly owningDepartments: OwningDepartmentRecord[] = expectedOwningDepartmentNames.map(
    (name, sortOrder) => ({
      id: randomUUID(),
      name,
      slug: `department-${sortOrder}`,
      isActive: true,
      sortOrder,
    }),
  );
  readonly documents: DocumentRecord[] = [];
  readonly versions: DocumentVersionRecord[] = [];
  readonly audits: DocumentAuditRecord[] = [];

  listCategories = async () => this.categories;
  listOwningDepartments = async () => this.owningDepartments;

  async createDocument(input: CreateDocumentInput) {
    const now = new Date();
    const document: DocumentRecord = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      originalFileName: null,
      storedFileName: null,
      mimeType: null,
      fileSize: null,
      storagePath: null,
      categoryId: input.categoryId,
      category: this.categories[0]!,
      documentType: input.documentType,
      documentNumber: input.documentNumber,
      documentDate: input.documentDate,
      effectiveDate: input.effectiveDate,
      expiryDate: input.expiryDate,
      versionNumber: 0,
      status: input.status,
      confidentialityLevel: input.confidentialityLevel,
      owningDepartment: input.owningDepartment,
      keywords: input.keywords,
      isArchived: false,
      deletedAt: null,
      createdById: input.createdById,
      updatedById: input.updatedById,
      createdBy: { id: input.createdById, fullName: 'Test administrator' },
      updatedBy: { id: input.updatedById, fullName: 'Test administrator' },
      createdAt: now,
      updatedAt: now,
      tags: input.tags.map((name) => ({ id: randomUUID(), name, slug: name })),
    };
    this.documents.push(document);
    return document;
  }

  findDocument = async (id: string) =>
    this.documents.find((document) => document.id === id && !document.deletedAt) ?? null;

  async listDocuments(query: DocumentListQuery, access: DocumentAccessContext) {
    const accessible = this.documents.filter(
      (document) =>
        !document.deletedAt &&
        document.isArchived === (query.archived ?? false) &&
        access.allowedLevels.includes(document.confidentialityLevel),
    );
    return { items: accessible, total: accessible.length };
  }

  async updateDocument(id: string, input: UpdateDocumentInput) {
    const document = this.documents.find((item) => item.id === id)!;
    Object.assign(document, input, { updatedAt: new Date() });
    return document;
  }

  async createVersion(documentId: string, input: Parameters<DocumentStore['createVersion']>[1]) {
    const document = this.documents.find((item) => item.id === documentId)!;
    const versionNumber = document.versionNumber + 1;
    const version: DocumentVersionRecord = {
      id: randomUUID(),
      documentId,
      versionNumber,
      ...input,
      createdBy: { id: input.createdById, fullName: 'Test administrator' },
      createdAt: new Date(),
    };
    Object.assign(document, {
      ...input,
      versionNumber,
      status: document.status === 'DRAFT' ? 'ACTIVE' : document.status,
      updatedAt: new Date(),
    });
    this.versions.push(version);
    return { document, version };
  }

  async setArchived(id: string, archived: boolean, updatedById: string) {
    const document = this.documents.find((item) => item.id === id)!;
    Object.assign(document, {
      isArchived: archived,
      status: archived ? 'ARCHIVED' : 'ACTIVE',
      updatedById,
      updatedAt: new Date(),
    });
    return document;
  }

  async softDelete(id: string, deletedById: string) {
    const document = this.documents.find((item) => item.id === id)!;
    Object.assign(document, { deletedAt: new Date(), updatedById: deletedById });
    return document;
  }

  listVersions = async (documentId: string) =>
    this.versions.filter((version) => version.documentId === documentId);

  async listAudit(documentId: string, page: number, pageSize: number) {
    void page;
    void pageSize;
    const items = this.audits.filter((audit) => audit.documentId === documentId);
    return { items, total: items.length };
  }

  async createAudit(input: DocumentAuditInput) {
    this.audits.push({
      id: randomUUID(),
      ...input,
      metadata: input.metadata,
      createdAt: new Date(),
    });
  }

  hasAccessRule = async () => false;

  async dashboard(access: DocumentAccessContext): Promise<DashboardMetrics> {
    const visible = this.documents.filter(
      (document) =>
        !document.deletedAt && access.allowedLevels.includes(document.confidentialityLevel),
    );
    return {
      total: visible.length,
      active: visible.filter((document) => document.status === 'ACTIVE').length,
      underReview: visible.filter((document) => document.status === 'UNDER_REVIEW').length,
      expiring: 0,
      archived: visible.filter((document) => document.isArchived).length,
      recent: visible.slice(0, 8),
    };
  }
}

describe('Institutional Knowledge Center API', () => {
  let identityStore: TestIdentityStore;
  let documentStore: TestDocumentStore;
  let storage: MemoryStorageProvider;
  let application: ReturnType<typeof createApp>;
  let administrator: IdentityUser;
  let employee: IdentityUser;
  let unauthorizedUser: IdentityUser;
  let adminToken: string;
  let employeeToken: string;
  let unauthorizedToken: string;

  beforeEach(async () => {
    administrator = user('admin@example.test', role('super_admin', allDocumentPermissions));
    employee = user(
      'employee@example.test',
      role('employee', ['documents.view', 'documents.download']),
    );
    unauthorizedUser = user('no-access@example.test', role('viewer', []));
    identityStore = new TestIdentityStore([administrator, employee, unauthorizedUser]);
    documentStore = new TestDocumentStore();
    storage = new MemoryStorageProvider();
    application = createApp({ store: identityStore, documentStore, storage, config });
    adminToken = await signAccessToken(administrator.id, config);
    employeeToken = await signAccessToken(employee.id, config);
    unauthorizedToken = await signAccessToken(unauthorizedUser.id, config);
  });

  const authenticated = (method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string) =>
    request(application)[method](path).set('Authorization', `Bearer ${adminToken}`);

  const createDocument = async (confidentialityLevel = 'INTERNAL') => {
    const response = await authenticated('post', '/api/documents').send({
      title: 'التقرير السنوي',
      categoryId: documentStore.categories[0]!.id,
      documentType: 'REPORT',
      status: 'DRAFT',
      confidentialityLevel,
      owningDepartment: 'الإدارة التنفيذية',
      keywords: ['سنوي'],
      tags: ['تقرير'],
    });
    expect(response.status).toBe(201);
    return response.body as { id: string };
  };

  it('requires authentication and the documents.view permission', async () => {
    expect((await request(application).get('/api/documents')).status).toBe(401);
    expect(
      (
        await request(application)
          .get('/api/documents')
          .set('Authorization', `Bearer ${unauthorizedToken}`)
      ).status,
    ).toBe(403);
    expect((await authenticated('get', '/api/documents')).status).toBe(200);
  });

  it('returns complete non-empty Knowledge Center lookup lists', async () => {
    const lookups = await authenticated('get', '/api/document-lookups');
    expect(lookups.status).toBe(200);
    expect(lookups.body.categories.map((item: { name: string }) => item.name)).toEqual([
      ...expectedCategoryNames,
    ]);
    expect(lookups.body.owningDepartments.map((item: { name: string }) => item.name)).toEqual([
      ...expectedOwningDepartmentNames,
    ]);

    const categories = await authenticated('get', '/api/document-categories');
    const departments = await authenticated('get', '/api/owning-departments');
    expect(categories.body).toHaveLength(16);
    expect(departments.body).toHaveLength(8);
  });

  it('rejects document metadata outside the managed lookup lists', async () => {
    const invalidCategory = await authenticated('post', '/api/documents').send({
      title: 'مستند بتصنيف غير صالح',
      categoryId: randomUUID(),
      documentType: 'REPORT',
      owningDepartment: expectedOwningDepartmentNames[0],
    });
    expect(invalidCategory.status).toBe(400);
    expect(invalidCategory.body.error.code).toBe('INVALID_CATEGORY');

    const invalidDepartment = await authenticated('post', '/api/documents').send({
      title: 'مستند بإدارة غير صالحة',
      categoryId: documentStore.categories[0]!.id,
      documentType: 'REPORT',
      owningDepartment: 'إدارة غير معتمدة',
    });
    expect(invalidDepartment.status).toBe(400);
    expect(invalidDepartment.body.error.code).toBe('INVALID_OWNING_DEPARTMENT');
  });

  it('returns safe Arabic field-level Zod validation errors', async () => {
    const response = await authenticated('post', '/api/documents').send({
      title: 'الخطة الاستراتيجية',
      categoryId: 'not-a-uuid',
      documentType: 'STRATEGIC_PLAN',
      owningDepartment: expectedOwningDepartmentNames[0],
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe(
      'تعذر التحقق من بيانات الطلب. راجع الحقول الموضحة.',
    );
    expect(response.body.error.message).not.toBe('Invalid request data.');
    expect(response.body.error.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'categoryId',
          label: 'التصنيف',
          code: 'invalid_string',
          message: 'التصنيف: التنسيق غير صحيح.',
        }),
      ]),
    );
  });

  it('creates complete strategic-plan metadata and uploads its PDF', async () => {
    const metadata = await authenticated('post', '/api/documents').send({
      title: 'الخطة الاستراتيجية للجمعية',
      description: 'الخطة الاستراتيجية المعتمدة ومؤشرات تنفيذها.',
      categoryId: documentStore.categories[0]!.id,
      documentType: 'STRATEGIC_PLAN',
      documentNumber: 'SP-2026-01',
      documentDate: '2026-07-24',
      effectiveDate: '2026-08-01',
      expiryDate: '2030-12-31',
      status: 'ACTIVE',
      confidentialityLevel: 'INTERNAL',
      owningDepartment: expectedOwningDepartmentNames[0],
      keywords: ['الخطة الاستراتيجية', 'الأهداف المؤسسية'],
      tags: ['استراتيجية', 'اعتماد'],
    });

    expect(metadata.status).toBe(201);
    expect(metadata.body.documentType).toBe('STRATEGIC_PLAN');
    expect(metadata.body.owningDepartment).toBe(expectedOwningDepartmentNames[0]);

    const upload = await authenticated('put', `/api/documents/${metadata.body.id}/file`)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', encodeURIComponent('الخطة الاستراتيجية.pdf'))
      .send(Buffer.from('%PDF-1.7\nstrategic-plan-production-uat'));

    expect(upload.status).toBe(201);
    expect(upload.body.document.versionNumber).toBe(1);
    expect(upload.body.document.hasFile).toBe(true);
    expect(upload.body.version.originalFileName).toBe('الخطة الاستراتيجية.pdf');
  });

  it('creates metadata without exposing storage paths and records an audit entry', async () => {
    const document = await createDocument();
    const response = await authenticated('get', `/api/documents/${document.id}`);
    expect(response.status).toBe(200);
    expect(response.body.storagePath).toBeUndefined();
    expect(response.body.storedFileName).toBeUndefined();
    expect(documentStore.audits.some((entry) => entry.action === 'CREATED')).toBe(true);
    expect(documentStore.audits.some((entry) => entry.action === 'VIEWED')).toBe(true);
  });

  it('uploads a validated PDF under a generated name and records the upload', async () => {
    const document = await createDocument();
    const response = await authenticated('put', `/api/documents/${document.id}/file`)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', encodeURIComponent('التقرير السنوي.pdf'))
      .send(Buffer.from('%PDF-1.7\nsecure-test-document'));
    expect(response.status).toBe(201);
    expect(response.body.document.versionNumber).toBe(1);
    expect(response.body.document.storagePath).toBeUndefined();
    expect(response.body.version.storagePath).toBeUndefined();
    expect([...storage.files.keys()][0]).toMatch(new RegExp(`^${document.id}/[0-9a-f-]+\\.pdf$`));
    expect(documentStore.audits.some((entry) => entry.action === 'UPLOADED')).toBe(true);
  });

  it('rejects traversal file names, disallowed types, and mismatched signatures', async () => {
    const first = await createDocument();
    const traversal = await authenticated('put', `/api/documents/${first.id}/file`)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', encodeURIComponent('../secret.pdf'))
      .send(Buffer.from('%PDF-1.7\ncontent'));
    expect(traversal.status).toBe(400);
    expect(traversal.body.error.code).toBe('INVALID_FILE_NAME');

    const executable = await authenticated('put', `/api/documents/${first.id}/file`)
      .set('Content-Type', 'application/x-msdownload')
      .set('X-File-Name', 'malware.exe')
      .send(Buffer.from('MZ'));
    expect(executable.status).toBe(415);
    expect(executable.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');

    const signature = await authenticated('put', `/api/documents/${first.id}/file`)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'fake.pdf')
      .send(Buffer.from('not a pdf'));
    expect(signature.status).toBe(415);
    expect(signature.body.error.code).toBe('FILE_SIGNATURE_INVALID');
  });

  it('enforces confidentiality authorization independently of route permission', async () => {
    const document = await createDocument('HIGHLY_CONFIDENTIAL');
    const denied = await request(application)
      .get(`/api/documents/${document.id}`)
      .set('Authorization', `Bearer ${employeeToken}`);
    expect(denied.status).toBe(404);
    expect((await authenticated('get', `/api/documents/${document.id}`)).status).toBe(200);
  });

  it('downloads, versions, archives, restores, and soft deletes with audit coverage', async () => {
    const document = await createDocument();
    await authenticated('put', `/api/documents/${document.id}/file`)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'report.pdf')
      .send(Buffer.from('%PDF-1.7\nversion-one'));
    const secondVersion = await authenticated('post', `/api/documents/${document.id}/versions`)
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'report-v2.pdf')
      .send(Buffer.from('%PDF-1.7\nversion-two'));
    expect(secondVersion.status).toBe(201);
    expect(secondVersion.body.version.versionNumber).toBe(2);

    const downloaded = await authenticated('get', `/api/documents/${document.id}/download`);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers['cache-control']).toBe('private, no-store');

    expect((await authenticated('post', `/api/documents/${document.id}/archive`)).status).toBe(200);
    expect((await authenticated('post', `/api/documents/${document.id}/restore`)).status).toBe(200);
    expect((await authenticated('delete', `/api/documents/${document.id}`)).status).toBe(204);
    expect((await authenticated('get', `/api/documents/${document.id}`)).status).toBe(404);

    const actions = documentStore.audits.map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'UPLOADED',
        'VERSION_UPLOADED',
        'DOWNLOADED',
        'ARCHIVED',
        'RESTORED',
        'DELETED',
      ]),
    );
  });
});
