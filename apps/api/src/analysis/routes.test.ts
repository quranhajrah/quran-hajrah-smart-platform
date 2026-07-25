import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { AppConfig } from '../config.js';
import { MemoryStorageProvider } from '../documents/storage.js';
import type { DashboardMetrics, DocumentStore } from '../documents/store.js';
import type {
  DocumentAccessContext,
  DocumentAuditInput,
  DocumentListQuery,
  DocumentRecord,
} from '../documents/types.js';
import { signAccessToken } from '../identity/security.js';
import type { IdentityStore } from '../identity/store.js';
import type { AuditEntry, IdentityUser, PublicRole, RefreshSession } from '../identity/types.js';
import type { AnalysisAuditInput, AnalysisStore } from './store.js';
import type {
  AnalysisConfigurationRecord,
  AnalysisJobRecord,
  ImportBatchRecord,
  ProposalRecord,
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

const analysisPermissions = [
  'document_analysis.view',
  'document_analysis.run',
  'document_analysis.review',
  'document_analysis.approve',
  'document_analysis.import',
  'document_analysis.configure',
  'document_analysis.audit',
];

const role = (name: string, permissions: string[]): PublicRole => ({
  id: randomUUID(),
  name,
  displayName: name,
  isSystem: true,
  permissions,
});

const createUser = (email: string, assignedRole: PublicRole): IdentityUser => {
  const now = new Date();
  return {
    id: randomUUID(),
    fullName: email,
    email,
    passwordHash: 'not-used',
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
    throw new Error('Not implemented.');
  };
  updateUser = async () => {
    throw new Error('Not implemented.');
  };
  setUserRoles = async () => {
    throw new Error('Not implemented.');
  };
  countActiveSuperAdmins = async () => 1;
  listRoles = async () => [];
  listPermissions = async () => [];
  createRole = async () => {
    throw new Error('Not implemented.');
  };
  updateRole = async () => {
    throw new Error('Not implemented.');
  };
  setRolePermissions = async () => {
    throw new Error('Not implemented.');
  };
  createAudit = async (entry: AuditEntry) => {
    void entry;
  };
  listAudit = async () => ({ items: [], total: 0 });
}

class TestDocumentStore implements DocumentStore {
  constructor(readonly document: DocumentRecord) {}
  listCategories = async () => [this.document.category];
  listOwningDepartments = async () => [];
  createDocument = async () => this.document;
  findDocument = async (id: string) => (id === this.document.id ? this.document : null);
  listDocuments = async (query: DocumentListQuery, access: DocumentAccessContext) => {
    void query;
    void access;
    return { items: [this.document], total: 1 };
  };
  updateDocument = async () => this.document;
  createVersion = async () => {
    throw new Error('Not implemented.');
  };
  setArchived = async () => this.document;
  softDelete = async () => this.document;
  listVersions = async () => [];
  listAudit = async () => ({ items: [], total: 0 });
  createAudit = async (input: DocumentAuditInput) => {
    void input;
  };
  hasAccessRule = async () => false;
  dashboard = async (): Promise<DashboardMetrics> => ({
    total: 1,
    active: 1,
    underReview: 0,
    expiring: 0,
    archived: 0,
    recent: [this.document],
  });
}

class MemoryAnalysisStore implements AnalysisStore {
  readonly configuration: AnalysisConfigurationRecord = {
    id: randomUUID(),
    key: 'institutional-default',
    isActive: true,
    providerVersion: 'test-v1',
    maxFileSizeBytes: 1024 * 1024,
    maxPages: 20,
    maxTables: 20,
    minimumTextCharacters: 10,
    proposalConfidence: 0.7,
    reviewSlaHours: 72,
    enabledDocumentTypes: ['OPERATIONAL_PLAN'],
    enabledRuleIds: ['section.objective.v1'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  audits: AnalysisAuditInput[] = [];
  importBatches = new Map<string, ImportBatchRecord>();

  constructor(
    readonly job: AnalysisJobRecord,
    readonly proposal: ProposalRecord,
  ) {}

  getConfiguration = async () => this.configuration;
  updateConfiguration = async (
    input: Parameters<AnalysisStore['updateConfiguration']>[0],
    userId: string,
  ) => {
    void userId;
    Object.assign(this.configuration, input, { updatedAt: new Date() });
    return this.configuration;
  };
  findJobByFingerprint = async () => null;
  createJob = async () => this.job;
  getJob = async (id: string) => (id === this.job.id ? this.job : null);
  listJobs = async () => ({ items: [this.job], total: 1, page: 1, pageSize: 20 });
  updateJob = async (id: string, input: Parameters<AnalysisStore['updateJob']>[1]) => {
    if (id !== this.job.id) throw new Error('Not found');
    Object.assign(this.job, input, { updatedAt: new Date() });
    return this.job;
  };
  saveExtraction = async () => this.job;
  clearJobForRetry = async () => this.job;
  listPages = async () => [];
  listTables = async () => [];
  listProposals = async () => ({
    items: [this.proposal],
    total: 1,
    page: 1,
    pageSize: 50,
  });
  getProposal = async (id: string) => (id === this.proposal.id ? this.proposal : null);
  updateProposal = async (id: string, input: Parameters<AnalysisStore['updateProposal']>[1]) => {
    if (id !== this.proposal.id) throw new Error('Not found');
    Object.assign(this.proposal, input, { updatedAt: new Date() });
    return this.proposal;
  };
  reviewProposal = async (
    id: string,
    decision: Parameters<AnalysisStore['reviewProposal']>[1],
    reviewerId: string,
    _comment?: string,
    editedData?: Record<string, unknown>,
  ) => {
    if (id !== this.proposal.id) throw new Error('Not found');
    Object.assign(this.proposal, {
      decision: editedData ? 'EDITED' : decision,
      editedData,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    });
    return this.proposal;
  };
  reviewProposals = async (
    _ids: string[],
    decision: Parameters<AnalysisStore['reviewProposals']>[1],
    reviewerId: string,
  ) => {
    Object.assign(this.proposal, {
      decision,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    });
    return [this.proposal];
  };
  refreshJobReviewStatus = async () => {
    this.job.status = this.proposal.decision === 'REJECTED' ? 'UNDER_REVIEW' : 'APPROVED';
    return this.job;
  };
  detectConflicts = async () => [
    {
      proposalId: this.proposal.id,
      targetType: this.proposal.importTargetType,
      status: 'ready' as const,
      allowedActions: ['create' as const],
      defaultAction: 'create' as const,
    },
  ];
  importApproved = async (
    jobId: string,
    idempotencyKey: string,
    _decisions: Parameters<AnalysisStore['importApproved']>[2],
    importedById: string,
  ) => {
    const existing = this.importBatches.get(idempotencyKey);
    if (existing) return existing;
    const batch: ImportBatchRecord = {
      id: randomUUID(),
      jobId,
      idempotencyKey,
      status: 'IMPORTED',
      importedById,
      summary: { imported: 1 },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.importBatches.set(idempotencyKey, batch);
    this.job.status = 'IMPORTED';
    return batch;
  };
  getImportBatch = async (id: string) =>
    [...this.importBatches.values()].find((item) => item.id === id) ?? null;
  listSourceReferences = async () => [
    {
      id: randomUUID(),
      sourceDocumentId: this.job.documentId,
      sourceDocumentVersionId: this.job.documentVersionId,
      sourceProposalId: this.proposal.id,
      targetType: this.proposal.importTargetType,
      targetRecordId: randomUUID(),
      sourcePage: 2,
      sourceSection: 'الهدف التشغيلي',
      sourceEvidence: 'الهدف التشغيلي: تطوير البرامج',
      extractionMethod: 'deterministic-rules-v1',
      importedAt: new Date(),
      importedById: this.job.requestedById,
    },
  ];
  summary = async () => ({
    analyzed: 1,
    awaitingReview: 1,
    awaitingApproval: 1,
    imported: 0,
    failed: 0,
    ocrRequired: 0,
    budget: { records: 0, lines: 0, totalPlanned: 0 },
  });
  createAudit = async (input: AnalysisAuditInput) => {
    this.audits.push(input);
  };
  listAudit = async () => ({ items: this.audits, total: this.audits.length });
}

describe('document analysis API security and workflow', () => {
  let admin: IdentityUser;
  let viewer: IdentityUser;
  let unauthorized: IdentityUser;
  let document: DocumentRecord;
  let analysisStore: MemoryAnalysisStore;
  let app: ReturnType<typeof createApp>;
  let adminToken: string;
  let viewerToken: string;
  let unauthorizedToken: string;

  beforeEach(async () => {
    admin = createUser('admin@example.test', role('super_admin', analysisPermissions));
    viewer = createUser('viewer@example.test', role('viewer', ['document_analysis.view']));
    unauthorized = createUser('staff@example.test', role('employee', []));
    const now = new Date();
    document = {
      id: randomUUID(),
      title: 'الخطة التشغيلية والموازنة لعام 2026',
      categoryId: randomUUID(),
      category: {
        id: randomUUID(),
        name: 'الخطط التشغيلية',
        slug: 'operational-plans',
        isActive: true,
        sortOrder: 1,
      },
      documentType: 'OPERATIONAL_PLAN',
      versionNumber: 1,
      status: 'ACTIVE',
      confidentialityLevel: 'CONFIDENTIAL',
      owningDepartment: 'الإدارة التنفيذية',
      keywords: [],
      isArchived: false,
      createdById: admin.id,
      updatedById: admin.id,
      createdBy: { id: admin.id, fullName: admin.fullName },
      updatedBy: { id: admin.id, fullName: admin.fullName },
      createdAt: now,
      updatedAt: now,
      tags: [],
    };
    const job: AnalysisJobRecord = {
      id: randomUUID(),
      documentId: document.id,
      documentVersionId: randomUUID(),
      fingerprint: 'test-fingerprint',
      status: 'PROPOSALS_READY',
      extractionVersion: 'test-v1',
      requestedById: admin.id,
      pageCount: 2,
      tableCount: 1,
      proposalCount: 1,
      createdAt: now,
      updatedAt: now,
      document: {
        id: document.id,
        title: document.title,
        confidentialityLevel: document.confidentialityLevel,
        documentType: document.documentType,
        versionNumber: 1,
      },
    };
    const proposal: ProposalRecord = {
      id: randomUUID(),
      jobId: job.id,
      documentId: document.id,
      documentVersionId: job.documentVersionId,
      proposalType: 'STRATEGIC_OBJECTIVE',
      decision: 'PENDING',
      title: 'تطوير البرامج',
      proposedData: { title: 'تطوير البرامج' },
      importTargetType: 'STRATEGIC_OBJECTIVE',
      extractionRuleId: 'section.objective.v1',
      extractionMethod: 'deterministic-rules-v1',
      confidence: 0.91,
      sourcePage: 2,
      sourceSection: 'الأهداف',
      evidenceSnippet: 'الهدف التشغيلي: تطوير البرامج',
      createdAt: now,
      updatedAt: now,
    };
    analysisStore = new MemoryAnalysisStore(job, proposal);
    const identityStore = new TestIdentityStore([admin, viewer, unauthorized]);
    app = createApp({
      store: identityStore,
      documentStore: new TestDocumentStore(document),
      storage: new MemoryStorageProvider(),
      analysisStore,
      config,
    });
    [adminToken, viewerToken, unauthorizedToken] = await Promise.all([
      signAccessToken(admin.id, config),
      signAccessToken(viewer.id, config),
      signAccessToken(unauthorized.id, config),
    ]);
  });

  it('requires authentication and document_analysis.view permission', async () => {
    await request(app).get('/api/document-analysis/jobs').expect(401);
    await request(app)
      .get('/api/document-analysis/jobs')
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .expect(403);
    const response = await request(app)
      .get('/api/document-analysis/jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(response.body.items).toHaveLength(1);
  });

  it('does not disclose confidential analysis to an unauthorized viewer', async () => {
    await request(app)
      .get(`/api/document-analysis/jobs/${analysisStore.job.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
  });

  it('enforces approval, import, and analysis-run permissions server-side', async () => {
    await request(app)
      .post(`/api/document-analysis/proposals/${analysisStore.proposal.id}/approve`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({})
      .expect(403);
    await request(app)
      .post(`/api/document-analysis/jobs/${analysisStore.job.id}/import`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ decisions: [] })
      .expect(403);
    await request(app)
      .post(`/api/documents/${document.id}/analyze`)
      .set('Authorization', `Bearer ${unauthorizedToken}`)
      .expect(403);
  });

  it('supports edit, approval, rejection, and audit logging', async () => {
    await request(app)
      .patch(`/api/document-analysis/proposals/${analysisStore.proposal.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ editedData: { title: 'تطوير البرامج القرآنية' } })
      .expect(200);
    const approved = await request(app)
      .post(`/api/document-analysis/proposals/${analysisStore.proposal.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ editedData: { title: 'تطوير البرامج القرآنية' } })
      .expect(200);
    expect(approved.body.decision).toBe('EDITED');
    expect(analysisStore.audits.filter((item) => item.action === 'PROPOSAL_EDITED')).toHaveLength(
      2,
    );

    analysisStore.proposal.decision = 'PENDING';
    const rejected = await request(app)
      .post(`/api/document-analysis/proposals/${analysisStore.proposal.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    expect(rejected.body.decision).toBe('REJECTED');
    expect(analysisStore.audits.map((item) => item.action)).toContain('PROPOSAL_REJECTED');
  });

  it('previews conflicts and keeps import idempotent with source traceability', async () => {
    analysisStore.proposal.decision = 'APPROVED';
    analysisStore.job.status = 'APPROVED';
    const preview = await request(app)
      .post(`/api/document-analysis/jobs/${analysisStore.job.id}/import-preview`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    expect(preview.body[0].defaultAction).toBe('create');

    const key = randomUUID();
    const first = await request(app)
      .post(`/api/document-analysis/jobs/${analysisStore.job.id}/import`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send({
        decisions: [{ proposalId: analysisStore.proposal.id, action: 'create' }],
      })
      .expect(201);
    const second = await request(app)
      .post(`/api/document-analysis/jobs/${analysisStore.job.id}/import`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', key)
      .send({
        decisions: [{ proposalId: analysisStore.proposal.id, action: 'create' }],
      })
      .expect(201);
    expect(second.body.id).toBe(first.body.id);

    const sources = await request(app)
      .get(`/api/document-analysis/sources/STRATEGIC_OBJECTIVE/${randomUUID()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(sources.body[0]).toMatchObject({
      sourceDocumentId: document.id,
      sourcePage: 2,
    });
  });

  it('rate limits repeated analysis attempts without disabling the limiter', async () => {
    const missingDocumentId = randomUUID();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app)
        .post(`/api/documents/${missingDocumentId}/analyze`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    }
    await request(app)
      .post(`/api/documents/${missingDocumentId}/analyze`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(429);
  });
});
