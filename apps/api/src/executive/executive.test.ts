import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import type { AppConfig } from '../config.js';
import type { DocumentStore } from '../documents/store.js';
import type { DocumentRecord } from '../documents/types.js';
import type { IdentityStore } from '../identity/store.js';
import { signAccessToken } from '../identity/security.js';
import type { AuditEntry, IdentityUser, PublicRole, RefreshSession } from '../identity/types.js';
import type { ExecutiveRecord, ExecutiveStore } from './store.js';
import type {
  AlertCandidate,
  AlertStatus,
  ExecutiveDashboardBase,
  ExecutiveEntity,
  HealthWeights,
  MetricSummary,
  PageQuery,
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

const permissions = [
  'dashboard.view',
  'dashboard.configure',
  'metrics.view',
  'metrics.manage',
  'metrics.measure',
  'strategy.view',
  'strategy.manage',
  'kpi.view',
  'kpi.manage',
  'kpi.measure',
  'initiatives.view',
  'initiatives.manage',
  'risks.view',
  'risks.manage',
  'alerts.view',
  'alerts.manage',
  'reports.view',
  'reports.create',
  'reports.approve',
  'executive.query',
];

const createRole = (name: string, rolePermissions: string[]): PublicRole => ({
  id: randomUUID(),
  name,
  displayName: name,
  isSystem: true,
  permissions: rolePermissions,
});

const createUser = (email: string, role: PublicRole): IdentityUser => {
  const now = new Date();
  return {
    id: randomUUID(),
    fullName: email,
    email,
    passwordHash: 'not-used',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    roles: [role],
  };
};

class MemoryIdentityStore implements IdentityStore {
  readonly audits: AuditEntry[] = [];

  constructor(readonly users: IdentityUser[]) {}

  findUserByEmail = async (email: string) =>
    this.users.find((user) => user.email === email) ?? null;
  findUserById = async (id: string) => this.users.find((user) => user.id === id) ?? null;
  touchLastLogin = async () => undefined;
  createSession = async (input: Omit<RefreshSession, 'id'>) => ({
    id: randomUUID(),
    ...input,
  });
  findSession = async () => null;
  revokeSession = async () => undefined;
  revokeUserSessions = async () => undefined;
  listUsers = async () => ({ items: this.users, total: this.users.length });
  createUser = async () => {
    throw new Error('Not implemented in executive tests.');
  };
  updateUser = async () => {
    throw new Error('Not implemented in executive tests.');
  };
  setUserRoles = async () => {
    throw new Error('Not implemented in executive tests.');
  };
  countActiveSuperAdmins = async () => 1;
  listRoles = async () => [];
  listPermissions = async () => [];
  createRole = async () => {
    throw new Error('Not implemented in executive tests.');
  };
  updateRole = async () => {
    throw new Error('Not implemented in executive tests.');
  };
  setRolePermissions = async () => {
    throw new Error('Not implemented in executive tests.');
  };
  createAudit = async (entry: AuditEntry) => {
    this.audits.push(entry);
  };
  listAudit = async () => ({ items: this.audits, total: this.audits.length });
}

const sourceDocuments: DocumentRecord[] = [];
const documentStore: DocumentStore = {
  listCategories: async () => [],
  listOwningDepartments: async () => [],
  createDocument: async () => {
    throw new Error('Not implemented in executive tests.');
  },
  findDocument: async (id) => sourceDocuments.find((document) => document.id === id) ?? null,
  listDocuments: async () => ({ items: [], total: 0 }),
  updateDocument: async () => {
    throw new Error('Not implemented in executive tests.');
  },
  createVersion: async () => {
    throw new Error('Not implemented in executive tests.');
  },
  setArchived: async () => {
    throw new Error('Not implemented in executive tests.');
  },
  softDelete: async () => {
    throw new Error('Not implemented in executive tests.');
  },
  listVersions: async () => [],
  listAudit: async () => ({ items: [], total: 0 }),
  createAudit: async () => undefined,
  hasAccessRule: async () => false,
  dashboard: async () => ({
    total: 0,
    active: 0,
    underReview: 0,
    expiring: 0,
    archived: 0,
    recent: [],
  }),
};

class MemoryExecutiveStore implements ExecutiveStore {
  readonly records: Record<ExecutiveEntity, ExecutiveRecord[]> = {
    metrics: [],
    objectives: [],
    kpis: [],
    initiatives: [],
    risks: [],
    reports: [],
  };
  readonly measurements: ExecutiveRecord[] = [];
  readonly kpiMeasurements: ExecutiveRecord[] = [];
  readonly alerts: ExecutiveRecord[] = [];
  readonly snapshots: ExecutiveRecord[] = [];
  readonly candidates: AlertCandidate[] = [
    {
      fingerprint: 'initiative:delayed:test',
      severity: 'HIGH',
      title: 'مبادرة متأخرة',
      description: 'تجاوزت المبادرة تاريخ الانتهاء.',
      sourceModule: 'initiatives',
      sourceRecordId: 'test',
    },
  ];
  weights: HealthWeights = {
    governance: 20,
    strategic: 20,
    operational: 20,
    financial: 15,
    risk: 15,
    knowledge: 10,
  };

  async list(entity: ExecutiveEntity, query: PageQuery) {
    let items = this.records[entity].filter((item) => !item.deletedAt);
    if (query.status === 'critical') {
      items = items.filter((item) => Number(item.residualScore) >= 15);
    } else if (query.status) {
      const statuses = query.status.split(',');
      items = items.filter((item) => statuses.includes(String(item.status)));
    }
    if (query.objectiveId) {
      items = items.filter((item) => item.objectiveId === query.objectiveId);
    }
    const start = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(start, start + query.pageSize),
      total: items.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  find = async (entity: ExecutiveEntity, id: string) =>
    this.records[entity].find((item) => item.id === id && !item.deletedAt) ?? null;

  async create(entity: ExecutiveEntity, input: Record<string, unknown>, userId: string) {
    const now = new Date();
    const record: ExecutiveRecord = {
      id: randomUUID(),
      ...input,
      createdById: userId,
      updatedById: userId,
      createdAt: now,
      updatedAt: now,
    };
    this.records[entity].push(record);
    return record;
  }

  async update(
    entity: ExecutiveEntity,
    id: string,
    input: Record<string, unknown>,
    userId: string,
  ) {
    const record = await this.find(entity, id);
    if (!record) throw new Error('Not found');
    Object.assign(record, input, { updatedById: userId, updatedAt: new Date() });
    return record;
  }

  async softDelete(entity: ExecutiveEntity, id: string, userId: string) {
    await this.update(entity, id, { deletedAt: new Date() }, userId);
  }

  async recordMetric(
    metricId: string,
    input: Parameters<ExecutiveStore['recordMetric']>[1],
    userId: string,
  ) {
    const metric = await this.find('metrics', metricId);
    if (!metric) throw new Error('Not found');
    const measurement: ExecutiveRecord = {
      id: randomUUID(),
      metricId,
      ...input,
      createdById: userId,
      createdAt: new Date(),
    };
    Object.assign(metric, {
      currentNumericValue: input.numericValue,
      currentTextValue: input.textValue,
      currentMeasuredAt: input.measuredAt,
    });
    this.measurements.push(measurement);
    return measurement;
  }

  async metricHistory(metricId: string, query: PageQuery) {
    const items = this.measurements.filter((item) => item.metricId === metricId);
    return { items, total: items.length, page: query.page, pageSize: query.pageSize };
  }

  async metricSummaries(): Promise<MetricSummary[]> {
    return this.records.metrics as MetricSummary[];
  }

  async recordKpi(
    kpiId: string,
    input: Parameters<ExecutiveStore['recordKpi']>[1],
    status: string,
    userId: string,
  ) {
    const kpi = await this.find('kpis', kpiId);
    if (!kpi) throw new Error('Not found');
    const measurement: ExecutiveRecord = {
      id: randomUUID(),
      kpiId,
      ...input,
      status,
      createdById: userId,
      createdAt: new Date(),
    };
    Object.assign(kpi, { currentValue: input.value, status, lastMeasuredAt: input.measuredAt });
    this.kpiMeasurements.push(measurement);
    return measurement;
  }

  async kpiHistory(kpiId: string, query: PageQuery) {
    const items = this.kpiMeasurements.filter((item) => item.kpiId === kpiId);
    return { items, total: items.length, page: query.page, pageSize: query.pageSize };
  }

  addMilestone = async (initiativeId: string, input: Record<string, unknown>, userId: string) => ({
    id: randomUUID(),
    initiativeId,
    ...input,
    createdById: userId,
  });

  async addInitiativeUpdate(initiativeId: string, input: Record<string, unknown>, userId: string) {
    const initiative = await this.find('initiatives', initiativeId);
    if (!initiative) throw new Error('Not found');
    Object.assign(initiative, {
      progress: input.progress,
      status: input.status,
      actualSpending: input.actualSpending ?? initiative.actualSpending,
    });
    return { id: randomUUID(), initiativeId, ...input, createdById: userId };
  }

  addRiskTreatment = async (riskId: string, input: Record<string, unknown>, userId: string) => ({
    id: randomUUID(),
    riskId,
    ...input,
    createdById: userId,
  });

  linkEvidence = async () => undefined;

  async dashboardBase(): Promise<ExecutiveDashboardBase> {
    const initiatives = this.records.initiatives.filter((item) => !item.deletedAt);
    const risks = this.records.risks.filter((item) => !item.deletedAt);
    const scores = risks.map((item) => Number(item.residualScore)).filter(Number.isFinite);
    return {
      activeUsers: 2,
      recentActivity: [],
      metrics: this.records.metrics as MetricSummary[],
      objectives: { total: this.records.objectives.length, averageProgress: null },
      kpis: Object.fromEntries(
        ['NOT_STARTED', 'ON_TRACK', 'AT_RISK', 'OFF_TRACK', 'COMPLETED'].map((status) => [
          status,
          this.records.kpis.filter((item) => item.status === status).length,
        ]),
      ),
      initiatives: {
        total: initiatives.length,
        active: initiatives.filter((item) => item.status === 'ACTIVE').length,
        delayed: initiatives.filter((item) => item.status === 'DELAYED').length,
        atRisk: initiatives.filter((item) => item.status === 'AT_RISK').length,
        completed: initiatives.filter((item) => item.status === 'COMPLETED').length,
        plannedBudget: initiatives.reduce((total, item) => total + Number(item.budget ?? 0), 0),
        actualSpending: initiatives.reduce(
          (total, item) => total + Number(item.actualSpending ?? 0),
          0,
        ),
      },
      risks: {
        open: risks.filter((item) => item.status !== 'CLOSED').length,
        critical: risks.filter((item) => Number(item.residualScore) >= 15).length,
        averageResidualScore:
          scores.length === 0
            ? null
            : scores.reduce((total, value) => total + value, 0) / scores.length,
      },
      alerts: this.alerts.filter((item) => item.status === 'OPEN'),
      upcomingDeadlines: [],
    };
  }

  getHealthWeights = async () => this.weights;

  async updatePreferences(
    userId: string,
    input: Parameters<ExecutiveStore['updatePreferences']>[1],
  ) {
    this.weights = input.healthWeights;
    return { id: `preference-${userId}`, ...input };
  }

  async createHealthSnapshot(
    input: Parameters<ExecutiveStore['createHealthSnapshot']>[0],
    userId: string,
  ) {
    const snapshot = { id: randomUUID(), ...input, createdById: userId };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  healthHistory = async (limit: number) => this.snapshots.slice(-limit);

  async listAlerts(query: PageQuery) {
    const items = query.status
      ? this.alerts.filter((item) => item.status === query.status)
      : this.alerts;
    return {
      items,
      total: items.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async createAlert(input: Record<string, unknown>, userId: string) {
    const alert = {
      id: randomUUID(),
      ...input,
      status: 'OPEN',
      createdById: userId,
      createdAt: new Date(),
    };
    this.alerts.push(alert);
    return alert;
  }

  async actionAlert(id: string, action: 'acknowledge' | 'resolve' | 'dismiss', userId: string) {
    const alert = this.alerts.find((item) => item.id === id);
    if (!alert) throw new Error('Not found');
    const status = {
      acknowledge: 'ACKNOWLEDGED',
      resolve: 'RESOLVED',
      dismiss: 'DISMISSED',
    }[action];
    Object.assign(alert, { status, updatedById: userId });
    return alert;
  }

  alertCandidates = async () => this.candidates;

  async upsertGeneratedAlert(candidate: AlertCandidate) {
    const existing = this.alerts.find((item) => item.fingerprint === candidate.fingerprint);
    if (existing) return existing;
    const alert = {
      id: randomUUID(),
      ...candidate,
      status: 'OPEN',
      createdAt: new Date(),
    };
    this.alerts.push(alert);
    return alert;
  }

  async replaceReportSections(
    reportId: string,
    sections: Parameters<ExecutiveStore['replaceReportSections']>[1],
    userId: string,
  ) {
    return this.update('reports', reportId, { sections, status: 'GENERATED' }, userId);
  }

  transitionReport = async (
    reportId: string,
    status: 'GENERATED' | 'APPROVED' | 'ARCHIVED',
    userId: string,
  ) => this.update('reports', reportId, { status }, userId);

  activity = async (query: PageQuery) => ({
    items: [] as ExecutiveRecord[],
    total: 0,
    page: query.page,
    pageSize: query.pageSize,
  });

  countAlerts = async (status?: AlertStatus) =>
    status ? this.alerts.filter((item) => item.status === status).length : this.alerts.length;
}

describe('Enterprise 23 executive API', () => {
  let identityStore: MemoryIdentityStore;
  let executiveStore: MemoryExecutiveStore;
  let app: ReturnType<typeof createApp>;
  let administrator: IdentityUser;
  let viewer: IdentityUser;
  let metricOperator: IdentityUser;
  let adminToken: string;
  let viewerToken: string;
  let metricOperatorToken: string;

  beforeEach(async () => {
    administrator = createUser('admin@example.test', createRole('super_admin', permissions));
    viewer = createUser('viewer@example.test', createRole('viewer', ['dashboard.view']));
    metricOperator = createUser(
      'operator@example.test',
      createRole('employee', ['metrics.view', 'metrics.measure']),
    );
    sourceDocuments.length = 0;
    identityStore = new MemoryIdentityStore([administrator, viewer, metricOperator]);
    executiveStore = new MemoryExecutiveStore();
    app = createApp({ store: identityStore, documentStore, executiveStore, config });
    adminToken = await signAccessToken(administrator.id, config);
    viewerToken = await signAccessToken(viewer.id, config);
    metricOperatorToken = await signAccessToken(metricOperator.id, config);
  });

  const admin = (method: 'get' | 'post' | 'patch' | 'delete', path: string) =>
    request(app)[method](path).set('Authorization', `Bearer ${adminToken}`);

  it('enforces authentication and server-side RBAC', async () => {
    expect((await request(app).get('/api/executive/dashboard')).status).toBe(401);
    expect(
      (
        await request(app)
          .get('/api/executive/metrics')
          .set('Authorization', `Bearer ${viewerToken}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/executive/query')
          .set('Authorization', `Bearer ${viewerToken}`)
          .send({ text: 'ما المخاطر الحرجة؟' })
      ).status,
    ).toBe(403);
  });

  it('aggregates the dashboard without fabricating missing association values', async () => {
    const response = await admin('get', '/api/executive/dashboard');
    expect(response.status).toBe(200);
    expect(response.body.summary.activeUsers).toBe(2);
    expect(response.body.associationIndicators.beneficiaries_total).toBeNull();
    expect(response.body.health.score).toBeNull();
    expect(response.body.health.missingData).toContain('الحوكمة');
  });

  it('records a metric measurement and an audit event', async () => {
    const created = await admin('post', '/api/executive/metrics').send({
      key: 'attendance_rate',
      nameAr: 'نسبة الحضور',
      dataType: 'PERCENTAGE',
      frequency: 'MONTHLY',
      targetValue: 90,
      warningThreshold: 80,
      criticalThreshold: 70,
    });
    expect(created.status).toBe(201);
    const measured = await admin(
      'post',
      `/api/executive/metrics/${String(created.body.id)}/measurements`,
    ).send({ numericValue: 85, measuredAt: '2026-07-24T00:00:00.000Z' });
    expect(measured.status).toBe(201);
    expect(executiveStore.measurements).toHaveLength(1);
    expect(identityStore.audits.some((audit) => audit.action === 'metrics.measure')).toBe(true);
  });

  it('rejects a confidential source document outside the actor confidentiality scope', async () => {
    const created = await admin('post', '/api/executive/metrics').send({
      key: 'governance_score',
      nameAr: 'درجة الحوكمة',
      dataType: 'PERCENTAGE',
      frequency: 'QUARTERLY',
    });
    const now = new Date();
    sourceDocuments.push({
      id: randomUUID(),
      title: 'وثيقة مقيدة',
      categoryId: randomUUID(),
      category: {
        id: randomUUID(),
        name: 'الحوكمة',
        slug: 'governance',
        isActive: true,
        sortOrder: 0,
      },
      documentType: 'GOVERNANCE',
      versionNumber: 1,
      status: 'ACTIVE',
      confidentialityLevel: 'HIGHLY_CONFIDENTIAL',
      owningDepartment: 'الحوكمة',
      keywords: [],
      isArchived: false,
      createdById: administrator.id,
      updatedById: administrator.id,
      createdBy: { id: administrator.id, fullName: administrator.fullName },
      updatedBy: { id: administrator.id, fullName: administrator.fullName },
      createdAt: now,
      updatedAt: now,
      tags: [],
    });
    const response = await request(app)
      .post(`/api/executive/metrics/${String(created.body.id)}/measurements`)
      .set('Authorization', `Bearer ${metricOperatorToken}`)
      .send({
        numericValue: 80,
        measuredAt: '2026-07-24',
        sourceDocumentId: sourceDocuments[0]!.id,
      });
    expect(response.status).toBe(404);
    expect(executiveStore.measurements).toHaveLength(0);
  });

  it('calculates KPI status and returns its trend', async () => {
    const objective = await admin('post', '/api/executive/objectives').send({
      code: 'OBJ-1',
      title: 'رفع جودة الأداء',
      strategicAxis: 'التميز المؤسسي',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      weight: 100,
      progress: 0,
    });
    const kpi = await admin('post', '/api/executive/kpis').send({
      objectiveId: objective.body.id,
      code: 'KPI-1',
      title: 'نسبة الإنجاز',
      target: 100,
      baseline: 0,
      unit: '%',
      frequency: 'MONTHLY',
    });
    const measured = await admin(
      'post',
      `/api/executive/kpis/${String(kpi.body.id)}/measurements`,
    ).send({ value: 82, measuredAt: '2026-07-24' });
    expect(measured.status).toBe(201);
    expect(measured.body.status).toBe('ON_TRACK');
    const trend = await admin('get', `/api/executive/kpis/${String(kpi.body.id)}/trend`);
    expect(trend.body.total).toBe(1);
  });

  it('calculates risk scores and builds the heat matrix', async () => {
    const risk = await admin('post', '/api/executive/risks').send({
      code: 'R-1',
      title: 'تعطل خدمة حرجة',
      category: 'تقني',
      likelihood: 'LIKELY',
      impact: 'SEVERE',
      residualLikelihood: 'POSSIBLE',
      residualImpact: 'MAJOR',
    });
    expect(risk.status).toBe(201);
    expect(risk.body.inherentScore).toBe(20);
    expect(risk.body.residualScore).toBe(12);
    const matrix = await admin('get', '/api/executive/risks/heat-matrix');
    expect(matrix.status).toBe(200);
    expect(matrix.body.matrix[3][4]).toBe(1);
    const trend = await admin('get', '/api/executive/risks/trend');
    expect(trend.status).toBe(200);
    expect(trend.body[0].total).toBe(1);
  });

  it('generates idempotent alerts and records alert actions', async () => {
    expect((await admin('post', '/api/executive/alerts/generate')).body.generated).toBe(1);
    expect((await admin('post', '/api/executive/alerts/generate')).body.generated).toBe(1);
    expect(executiveStore.alerts).toHaveLength(1);
    const alertId = executiveStore.alerts[0]!.id;
    const acknowledged = await admin('post', `/api/executive/alerts/${alertId}/acknowledge`);
    expect(acknowledged.body.status).toBe('ACKNOWLEDGED');
    expect(identityStore.audits.some((audit) => audit.action === 'alerts.acknowledge')).toBe(true);
  });

  it('answers supported executive questions using structured records only', async () => {
    executiveStore.records.initiatives.push({
      id: randomUUID(),
      code: 'I-1',
      name: 'مبادرة متأخرة',
      status: 'DELAYED',
    });
    const response = await admin('post', '/api/executive/query').send({
      text: 'ما المبادرات المتأخرة؟',
    });
    expect(response.status).toBe(200);
    expect(response.body.mode).toBe('structured-data');
    expect(response.body.data).toHaveLength(1);
    expect(identityStore.audits.at(-1)?.metadata).not.toHaveProperty('text');
  });

  it('generates reports and protects approval with a distinct permission', async () => {
    const report = await admin('post', '/api/executive/reports').send({
      title: 'تقرير الأداء الشهري',
      reportType: 'MONTHLY_PERFORMANCE',
    });
    const generated = await admin(
      'post',
      `/api/executive/reports/${String(report.body.id)}/generate`,
    );
    expect(generated.status).toBe(200);
    expect(generated.body.status).toBe('GENERATED');
    expect(generated.body.sections).toHaveLength(3);
    const edited = await admin(
      'patch',
      `/api/executive/reports/${String(report.body.id)}/sections`,
    ).send({
      sections: [
        {
          title: 'القسم التنفيذي المعتمد للتحرير',
          content: { summary: 'بيانات اختبار منظمة' },
          sortOrder: 0,
          sourceReferences: [{ module: 'test' }],
        },
      ],
    });
    expect(edited.status).toBe(200);
    expect(edited.body.sections).toHaveLength(1);
    expect(identityStore.audits.some((audit) => audit.action === 'reports.sections_update')).toBe(
      true,
    );

    const viewerWithReports = createRole('report_viewer', ['reports.view', 'reports.create']);
    viewer.roles = [viewerWithReports];
    const forbidden = await request(app)
      .post(`/api/executive/reports/${String(report.body.id)}/approve`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(forbidden.status).toBe(403);

    const approved = await admin(
      'post',
      `/api/executive/reports/${String(report.body.id)}/approve`,
    );
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('APPROVED');
    expect(identityStore.audits.some((audit) => audit.action === 'reports.approved')).toBe(true);

    const print = await admin('get', `/api/executive/reports/${String(report.body.id)}/print`);
    expect(print.status).toBe(200);
    expect(print.headers['content-type']).toContain('text/html');
    expect(print.headers['cache-control']).toBe('private, no-store');
    expect(print.text).toContain('dir="rtl"');
  });
});
