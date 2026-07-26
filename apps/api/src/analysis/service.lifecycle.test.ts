import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MemoryStorageProvider } from '../documents/storage.js';
import type { DocumentStore } from '../documents/store.js';
import type { DocumentRecord, DocumentVersionRecord } from '../documents/types.js';
import type { IdentityUser } from '../identity/types.js';
import { createLogger } from '../logger.js';
import { DocumentAnalysisService } from './service.js';
import type { AnalysisStore, SaveExtractionInput } from './store.js';
import type { AnalysisConfigurationRecord, AnalysisJobRecord } from './types.js';
import { createStableAnalysisFingerprint, semanticExtractionVersion } from './version.js';

const actorId = randomUUID();
const documentId = randomUUID();
const versionId = randomUUID();
const storagePath = 'documents/operational-plan.txt';
const checksum = 'lifecycle-checksum';
const now = new Date('2026-07-27T06:00:00.000Z');

const user: IdentityUser = {
  id: actorId,
  fullName: 'مدير الاختبار',
  email: 'admin@example.test',
  passwordHash: 'not-used',
  isActive: true,
  roles: [
    {
      id: randomUUID(),
      name: 'super_admin',
      displayName: 'مدير النظام',
      isSystem: true,
      permissions: ['document_analysis.run'],
    },
  ],
  createdAt: now,
  updatedAt: now,
};

const document: DocumentRecord = {
  id: documentId,
  title: 'خطة تشغيلية للاختبار',
  originalFileName: 'operational-plan.txt',
  storedFileName: 'operational-plan.txt',
  mimeType: 'text/plain',
  fileSize: 256n,
  storagePath,
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
  createdById: actorId,
  updatedById: actorId,
  createdBy: { id: actorId, fullName: user.fullName },
  updatedBy: { id: actorId, fullName: user.fullName },
  createdAt: now,
  updatedAt: now,
  tags: [],
};

const version: DocumentVersionRecord = {
  id: versionId,
  documentId,
  versionNumber: 1,
  originalFileName: 'operational-plan.txt',
  storedFileName: 'operational-plan.txt',
  mimeType: 'text/plain',
  fileSize: 256n,
  storagePath,
  checksum,
  createdById: actorId,
  createdBy: { id: actorId, fullName: user.fullName },
  createdAt: now,
};

const configuration: AnalysisConfigurationRecord = {
  id: randomUUID(),
  key: 'institutional-default',
  isActive: true,
  providerVersion: 'enterprise-24.1-semantic-v2',
  maxFileSizeBytes: 1024 * 1024,
  maxPages: 10,
  maxTables: 10,
  minimumTextCharacters: 1,
  proposalConfidence: 0.7,
  reviewSlaHours: 72,
  enabledDocumentTypes: ['OPERATIONAL_PLAN'],
  enabledRuleIds: [
    'semantic.operational_objective.v2',
    'semantic.kpi.v2',
    'semantic.initiative.v2',
    'semantic.beneficiary.v2',
    'semantic.budget_total.v2',
    'semantic.budget_line.v2',
  ],
  createdAt: now,
  updatedAt: now,
};

class LifecycleStore {
  readonly jobs = new Map<string, AnalysisJobRecord>();
  readonly fingerprints = new Map<string, string>();

  getConfiguration = async () => configuration;

  findJobByFingerprint = async (fingerprint: string) => {
    const id = this.fingerprints.get(fingerprint);
    return id ? (this.jobs.get(id) ?? null) : null;
  };

  createJob = async (input: Parameters<AnalysisStore['createJob']>[0]) => {
    const job: AnalysisJobRecord = {
      id: randomUUID(),
      ...input,
      status: 'QUEUED',
      pageCount: 0,
      tableCount: 0,
      proposalCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      document: {
        id: document.id,
        title: document.title,
        confidentialityLevel: document.confidentialityLevel,
        documentType: document.documentType,
        versionNumber: document.versionNumber,
      },
    };
    this.jobs.set(job.id, job);
    this.fingerprints.set(job.fingerprint, job.id);
    return job;
  };

  getJob = async (id: string) => this.jobs.get(id) ?? null;

  updateJob = async (id: string, input: Parameters<AnalysisStore['updateJob']>[1]) => {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Missing lifecycle test job.');
    Object.assign(job, input, { updatedAt: new Date() });
    return job;
  };

  saveExtraction = async (id: string, input: SaveExtractionInput) => {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Missing lifecycle test job.');
    Object.assign(job, {
      status: input.proposals.length ? 'PROPOSALS_READY' : 'TEXT_EXTRACTED',
      extractionProvider: input.provider,
      extractionVersion: input.extractionVersion,
      extractionMethod: input.extractionMethod,
      providerMetadata: input.metadata,
      pageCount: input.pages.length,
      tableCount: input.pages.reduce((sum, page) => sum + page.tables.length, 0),
      proposalCount: input.proposals.length,
      completedAt: new Date(),
      updatedAt: new Date(),
    });
    return job;
  };

  clearJobForRetry = async (id: string) => {
    const job = this.jobs.get(id);
    if (!job) throw new Error('Missing lifecycle test job.');
    Object.assign(job, {
      status: 'QUEUED',
      startedAt: null,
      completedAt: null,
      failureReason: null,
      providerMetadata: null,
      pageCount: 0,
      tableCount: 0,
      proposalCount: 0,
      updatedAt: new Date(),
    });
    return job;
  };

  createAudit = async () => undefined;
}

const createHarness = async () => {
  const store = new LifecycleStore();
  const storage = new MemoryStorageProvider();
  storage.files.set(
    storagePath,
    Buffer.from(['الفئة المستهدفة', '10 طلاب', 'الهدف الفرعي الأول: تحسين البرامج'].join('\n')),
  );
  const documentStore = {
    findDocument: async (id: string) => (id === document.id ? document : null),
    listVersions: async (id: string) => (id === document.id ? [version] : []),
    hasAccessRule: async () => false,
  } as unknown as DocumentStore;
  const service = new DocumentAnalysisService(
    store as unknown as AnalysisStore,
    documentStore,
    storage,
    createLogger('silent'),
  );
  return { service, store };
};

const waitForCompletion = async (store: LifecycleStore, jobId: string) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const job = store.jobs.get(jobId);
    if (job && !['QUEUED', 'PROCESSING'].includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for lifecycle test analysis.');
};

describe('Enterprise 24.2.1 analysis job lifecycle', () => {
  it('persists the semantic version while retaining provider version only in metadata', async () => {
    const { service, store } = await createHarness();
    const result = await service.start(document.id, user, {}, false);
    const completed = await waitForCompletion(store, result.job.id);

    expect(completed.extractionVersion).toBe(semanticExtractionVersion);
    expect(completed.providerMetadata).toMatchObject({
      provider: { name: 'plain-text', version: '1' },
    });
    expect(completed.extractionVersion).not.toBe('1');
  });

  it('creates a distinct job ID for every forced reanalysis', async () => {
    const { service } = await createHarness();
    const first = await service.start(document.id, user, {}, true);
    const second = await service.start(document.id, user, {}, true);

    expect(first.reused).toBe(false);
    expect(second.reused).toBe(false);
    expect(first.job.id).not.toBe(second.job.id);
    expect(first.job.fingerprint).not.toBe(second.job.fingerprint);
  });

  it('retries a failed analysis using the same job ID', async () => {
    const { service, store } = await createHarness();
    const initial = await service.start(document.id, user, {}, true);
    await waitForCompletion(store, initial.job.id);
    await store.updateJob(initial.job.id, {
      status: 'FAILED',
      failureReason: 'failure-for-lifecycle-test',
    });

    const retried = await service.retry(initial.job.id, user, {});
    expect(retried.id).toBe(initial.job.id);
    expect((await waitForCompletion(store, initial.job.id)).id).toBe(initial.job.id);
  });

  it('does not reuse an older semantic-version result', async () => {
    const { service, store } = await createHarness();
    const currentFingerprint = createStableAnalysisFingerprint({
      documentId,
      documentVersionId: versionId,
      checksum,
      enabledRuleIds: configuration.enabledRuleIds,
    });
    const oldJob = await store.createJob({
      documentId,
      documentVersionId: versionId,
      fingerprint: currentFingerprint,
      extractionVersion: '24.2.0',
      requestedById: user.id,
      reviewDueAt: new Date(),
    });

    const result = await service.start(document.id, user, {}, false);
    expect(result.reused).toBe(false);
    expect(result.job.id).not.toBe(oldJob.id);
    expect(result.job.fingerprint).not.toBe(currentFingerprint);
    expect(result.job.extractionVersion).toBe('24.2.1');
  });
});
