import type { Prisma } from '@prisma/client';
import { database } from '@quran-hajrah/database';
import type { ExecutiveRecord, ExecutiveStore } from './store.js';
import type {
  AlertCandidate,
  ExecutiveDashboardBase,
  ExecutiveEntity,
  HealthWeights,
  MetricSummary,
  PageQuery,
  PageResult,
} from './types.js';

const defaultHealthWeights: HealthWeights = {
  governance: 20,
  strategic: 20,
  operational: 20,
  financial: 15,
  risk: 15,
  knowledge: 10,
};

const asRecord = (value: unknown) => value as ExecutiveRecord;
const asRecords = (values: unknown[]) => values.map(asRecord);
const numeric = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const statusValues = (status?: string) => status?.split(',').filter(Boolean);

const pageResult = (
  items: unknown[],
  total: number,
  query: PageQuery,
): PageResult<ExecutiveRecord> => ({
  items: asRecords(items),
  total,
  page: query.page,
  pageSize: query.pageSize,
});

export class PrismaExecutiveStore implements ExecutiveStore {
  async list(entity: ExecutiveEntity, query: PageQuery) {
    const skip = (query.page - 1) * query.pageSize;
    const take = query.pageSize;
    const statuses = statusValues(query.status);
    switch (entity) {
      case 'metrics': {
        const where: Prisma.InstitutionalMetricWhereInput = {
          deletedAt: null,
          ...(query.search
            ? {
                OR: [
                  { key: { contains: query.search, mode: 'insensitive' } },
                  { nameAr: { contains: query.search, mode: 'insensitive' } },
                  { responsibleDepartment: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(query.status === 'active'
            ? { isActive: true }
            : query.status === 'inactive'
              ? { isActive: false }
              : {}),
          ...(query.department
            ? { responsibleDepartment: { contains: query.department, mode: 'insensitive' } }
            : {}),
        };
        const [items, total] = await database.$transaction([
          database.institutionalMetric.findMany({
            where,
            orderBy: { nameAr: 'asc' },
            skip,
            take,
          }),
          database.institutionalMetric.count({ where }),
        ]);
        return pageResult(items, total, query);
      }
      case 'objectives': {
        const where: Prisma.StrategicObjectiveWhereInput = {
          deletedAt: null,
          ...(query.search
            ? {
                OR: [
                  { code: { contains: query.search, mode: 'insensitive' } },
                  { title: { contains: query.search, mode: 'insensitive' } },
                  { strategicAxis: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(statuses?.length ? { status: { in: statuses as never[] } } : {}),
        };
        const [items, total] = await database.$transaction([
          database.strategicObjective.findMany({
            where,
            include: {
              owner: { select: { id: true, fullName: true } },
              _count: { select: { kpis: true, initiatives: true, risks: true } },
            },
            orderBy: { code: 'asc' },
            skip,
            take,
          }),
          database.strategicObjective.count({ where }),
        ]);
        return pageResult(items, total, query);
      }
      case 'kpis': {
        const where: Prisma.StrategicKpiWhereInput = {
          deletedAt: null,
          ...(query.search
            ? {
                OR: [
                  { code: { contains: query.search, mode: 'insensitive' } },
                  { title: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(statuses?.length ? { status: { in: statuses as never[] } } : {}),
          ...(query.objectiveId ? { objectiveId: query.objectiveId } : {}),
        };
        const [items, total] = await database.$transaction([
          database.strategicKpi.findMany({
            where,
            include: {
              objective: { select: { id: true, code: true, title: true } },
              owner: { select: { id: true, fullName: true } },
            },
            orderBy: { code: 'asc' },
            skip,
            take,
          }),
          database.strategicKpi.count({ where }),
        ]);
        return pageResult(items, total, query);
      }
      case 'initiatives': {
        const where: Prisma.OperationalInitiativeWhereInput = {
          deletedAt: null,
          ...(query.search
            ? {
                OR: [
                  { code: { contains: query.search, mode: 'insensitive' } },
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { department: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(statuses?.length ? { status: { in: statuses as never[] } } : {}),
          ...(query.department
            ? { department: { contains: query.department, mode: 'insensitive' } }
            : {}),
          ...(query.objectiveId ? { objectiveId: query.objectiveId } : {}),
        };
        const [items, total] = await database.$transaction([
          database.operationalInitiative.findMany({
            where,
            include: {
              objective: { select: { id: true, code: true, title: true } },
              owner: { select: { id: true, fullName: true } },
              milestones: { where: { deletedAt: null }, orderBy: { dueDate: 'asc' } },
              updates: { where: { deletedAt: null }, orderBy: { updateDate: 'desc' }, take: 5 },
              _count: { select: { risks: true, evidenceDocuments: true } },
            },
            orderBy: { code: 'asc' },
            skip,
            take,
          }),
          database.operationalInitiative.count({ where }),
        ]);
        return pageResult(items, total, query);
      }
      case 'risks': {
        const where: Prisma.InstitutionalRiskWhereInput = {
          deletedAt: null,
          ...(query.search
            ? {
                OR: [
                  { code: { contains: query.search, mode: 'insensitive' } },
                  { title: { contains: query.search, mode: 'insensitive' } },
                  { category: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(query.status === 'critical'
            ? { status: { not: 'CLOSED' }, residualScore: { gte: 15 } }
            : statuses?.length
              ? { status: { in: statuses as never[] } }
              : {}),
          ...(query.objectiveId ? { objectiveId: query.objectiveId } : {}),
        };
        const [items, total] = await database.$transaction([
          database.institutionalRisk.findMany({
            where,
            include: {
              owner: { select: { id: true, fullName: true } },
              objective: { select: { id: true, code: true, title: true } },
              initiative: { select: { id: true, code: true, name: true } },
              treatments: { where: { deletedAt: null }, orderBy: { dueDate: 'asc' } },
              _count: { select: { evidenceDocuments: true } },
            },
            orderBy: [{ residualScore: 'desc' }, { code: 'asc' }],
            skip,
            take,
          }),
          database.institutionalRisk.count({ where }),
        ]);
        return pageResult(items, total, query);
      }
      case 'reports': {
        const where: Prisma.ExecutiveReportWhereInput = {
          deletedAt: null,
          ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
          ...(statuses?.length ? { status: { in: statuses as never[] } } : {}),
        };
        const include = {
          preparedBy: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
          sections: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' as const } },
        };
        const [items, total] = await database.$transaction([
          database.executiveReport.findMany({
            where,
            include,
            orderBy: { updatedAt: 'desc' },
            skip,
            take,
          }),
          database.executiveReport.count({ where }),
        ]);
        return pageResult(items, total, query);
      }
    }
  }

  async find(entity: ExecutiveEntity, id: string) {
    switch (entity) {
      case 'metrics':
        return asRecord(
          await database.institutionalMetric.findFirst({ where: { id, deletedAt: null } }),
        );
      case 'objectives':
        return asRecord(
          await database.strategicObjective.findFirst({
            where: { id, deletedAt: null },
            include: {
              owner: { select: { id: true, fullName: true } },
              kpis: { where: { deletedAt: null }, orderBy: { code: 'asc' } },
              initiatives: { where: { deletedAt: null }, orderBy: { code: 'asc' } },
            },
          }),
        );
      case 'kpis':
        return asRecord(
          await database.strategicKpi.findFirst({
            where: { id, deletedAt: null },
            include: {
              objective: { select: { id: true, code: true, title: true } },
              measurements: {
                where: { deletedAt: null },
                orderBy: { measuredAt: 'desc' },
                take: 24,
              },
            },
          }),
        );
      case 'initiatives':
        return asRecord(
          await database.operationalInitiative.findFirst({
            where: { id, deletedAt: null },
            include: {
              objective: { select: { id: true, code: true, title: true } },
              owner: { select: { id: true, fullName: true } },
              milestones: { where: { deletedAt: null }, orderBy: { dueDate: 'asc' } },
              updates: { where: { deletedAt: null }, orderBy: { updateDate: 'desc' } },
              risks: { where: { deletedAt: null }, orderBy: { residualScore: 'desc' } },
            },
          }),
        );
      case 'risks':
        return asRecord(
          await database.institutionalRisk.findFirst({
            where: { id, deletedAt: null },
            include: {
              objective: { select: { id: true, code: true, title: true } },
              initiative: { select: { id: true, code: true, name: true } },
              treatments: { where: { deletedAt: null }, orderBy: { dueDate: 'asc' } },
            },
          }),
        );
      case 'reports':
        return asRecord(
          await database.executiveReport.findFirst({
            where: { id, deletedAt: null },
            include: {
              preparedBy: { select: { id: true, fullName: true } },
              approvedBy: { select: { id: true, fullName: true } },
              sections: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
            },
          }),
        );
    }
  }

  async create(
    entity: ExecutiveEntity,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutiveRecord> {
    switch (entity) {
      case 'metrics':
        return asRecord(
          await database.institutionalMetric.create({
            data: {
              ...(input as Prisma.InstitutionalMetricUncheckedCreateInput),
              createdById: userId,
              updatedById: userId,
            },
          }),
        );
      case 'objectives':
        return asRecord(
          await database.strategicObjective.create({
            data: {
              ...(input as Prisma.StrategicObjectiveUncheckedCreateInput),
              createdById: userId,
              updatedById: userId,
            },
          }),
        );
      case 'kpis':
        return asRecord(
          await database.strategicKpi.create({
            data: {
              ...(input as Prisma.StrategicKpiUncheckedCreateInput),
              createdById: userId,
              updatedById: userId,
            },
          }),
        );
      case 'initiatives':
        return asRecord(
          await database.operationalInitiative.create({
            data: {
              ...(input as Prisma.OperationalInitiativeUncheckedCreateInput),
              createdById: userId,
              updatedById: userId,
            },
          }),
        );
      case 'risks':
        return asRecord(
          await database.institutionalRisk.create({
            data: {
              ...(input as Prisma.InstitutionalRiskUncheckedCreateInput),
              createdById: userId,
              updatedById: userId,
            },
          }),
        );
      case 'reports':
        return asRecord(
          await database.executiveReport.create({
            data: {
              ...(input as Prisma.ExecutiveReportUncheckedCreateInput),
              preparedById: String(input.preparedById ?? userId),
              createdById: userId,
              updatedById: userId,
            },
            include: { sections: true },
          }),
        );
    }
  }

  async update(
    entity: ExecutiveEntity,
    id: string,
    input: Record<string, unknown>,
    userId: string,
  ): Promise<ExecutiveRecord> {
    switch (entity) {
      case 'metrics':
        return asRecord(
          await database.institutionalMetric.update({
            where: { id },
            data: {
              ...(input as Prisma.InstitutionalMetricUncheckedUpdateInput),
              updatedById: userId,
            },
          }),
        );
      case 'objectives':
        return asRecord(
          await database.strategicObjective.update({
            where: { id },
            data: {
              ...(input as Prisma.StrategicObjectiveUncheckedUpdateInput),
              updatedById: userId,
            },
          }),
        );
      case 'kpis':
        return asRecord(
          await database.strategicKpi.update({
            where: { id },
            data: { ...(input as Prisma.StrategicKpiUncheckedUpdateInput), updatedById: userId },
          }),
        );
      case 'initiatives':
        return asRecord(
          await database.operationalInitiative.update({
            where: { id },
            data: {
              ...(input as Prisma.OperationalInitiativeUncheckedUpdateInput),
              updatedById: userId,
            },
          }),
        );
      case 'risks':
        return asRecord(
          await database.institutionalRisk.update({
            where: { id },
            data: {
              ...(input as Prisma.InstitutionalRiskUncheckedUpdateInput),
              updatedById: userId,
            },
          }),
        );
      case 'reports':
        return asRecord(
          await database.executiveReport.update({
            where: { id },
            data: {
              ...(input as Prisma.ExecutiveReportUncheckedUpdateInput),
              updatedById: userId,
            },
            include: { sections: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } } },
          }),
        );
    }
  }

  async softDelete(entity: ExecutiveEntity, id: string, userId: string) {
    await this.update(entity, id, { deletedAt: new Date() }, userId);
  }

  async recordMetric(
    metricId: string,
    input: Parameters<ExecutiveStore['recordMetric']>[1],
    userId: string,
  ) {
    return database.$transaction(async (transaction) => {
      const metric = await transaction.institutionalMetric.findFirstOrThrow({
        where: { id: metricId, deletedAt: null, isActive: true },
      });
      const value = await transaction.metricValue.create({
        data: {
          metricId,
          numericValue: input.numericValue,
          textValue: input.textValue,
          measuredAt: input.measuredAt,
          sourceType: input.sourceType,
          sourceDocumentId: input.sourceDocumentId,
          notes: input.notes,
          createdById: userId,
        },
      });
      await transaction.institutionalMetric.update({
        where: { id: metric.id },
        data: {
          currentNumericValue: input.numericValue,
          currentTextValue: input.textValue,
          currentMeasuredAt: input.measuredAt,
          sourceType: input.sourceType ?? metric.sourceType,
          updatedById: userId,
        },
      });
      return asRecord(value);
    });
  }

  async metricHistory(metricId: string, query: PageQuery) {
    const where = { metricId, deletedAt: null };
    const [items, total] = await database.$transaction([
      database.metricValue.findMany({
        where,
        orderBy: { measuredAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      database.metricValue.count({ where }),
    ]);
    return pageResult(items, total, query);
  }

  async metricSummaries(): Promise<MetricSummary[]> {
    return (
      await database.institutionalMetric.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { nameAr: 'asc' },
      })
    ).map((metric) => ({
      id: metric.id,
      key: metric.key,
      nameAr: metric.nameAr,
      unit: metric.unit,
      dataType: metric.dataType,
      targetValue: numeric(metric.targetValue),
      warningThreshold: numeric(metric.warningThreshold),
      criticalThreshold: numeric(metric.criticalThreshold),
      currentNumericValue: numeric(metric.currentNumericValue),
      currentTextValue: metric.currentTextValue,
      currentMeasuredAt: metric.currentMeasuredAt,
    }));
  }

  async recordKpi(
    kpiId: string,
    input: Parameters<ExecutiveStore['recordKpi']>[1],
    status: string,
    userId: string,
  ) {
    return database.$transaction(async (transaction) => {
      const measurement = await transaction.kpiMeasurement.create({
        data: { kpiId, ...input, createdById: userId },
      });
      await transaction.strategicKpi.update({
        where: { id: kpiId },
        data: { currentValue: input.value, status: status as never, updatedById: userId },
      });
      return asRecord(measurement);
    });
  }

  async kpiHistory(kpiId: string, query: PageQuery) {
    const where = { kpiId, deletedAt: null };
    const [items, total] = await database.$transaction([
      database.kpiMeasurement.findMany({
        where,
        orderBy: { measuredAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      database.kpiMeasurement.count({ where }),
    ]);
    return pageResult(items, total, query);
  }

  async addMilestone(initiativeId: string, input: Record<string, unknown>, userId: string) {
    return asRecord(
      await database.initiativeMilestone.create({
        data: {
          ...(input as Prisma.InitiativeMilestoneUncheckedCreateWithoutInitiativeInput),
          initiativeId,
          createdById: userId,
          updatedById: userId,
        },
      }),
    );
  }

  async addInitiativeUpdate(initiativeId: string, input: Record<string, unknown>, userId: string) {
    return database.$transaction(async (transaction) => {
      const update = await transaction.initiativeUpdate.create({
        data: {
          ...(input as Prisma.InitiativeUpdateUncheckedCreateWithoutInitiativeInput),
          initiativeId,
          createdById: userId,
          updatedById: userId,
        },
      });
      await transaction.operationalInitiative.update({
        where: { id: initiativeId },
        data: {
          progress: input.progress as number,
          status: input.status as never,
          ...(input.actualSpending !== undefined
            ? { actualSpending: input.actualSpending as number }
            : {}),
          updatedById: userId,
        },
      });
      return asRecord(update);
    });
  }

  async addRiskTreatment(riskId: string, input: Record<string, unknown>, userId: string) {
    return asRecord(
      await database.riskTreatment.create({
        data: {
          ...(input as Prisma.RiskTreatmentUncheckedCreateWithoutRiskInput),
          riskId,
          createdById: userId,
          updatedById: userId,
        },
      }),
    );
  }

  async linkEvidence(
    entity: 'initiative' | 'risk',
    entityId: string,
    documentId: string,
    userId: string,
  ) {
    if (entity === 'initiative') {
      await database.initiativeEvidence.upsert({
        where: { initiativeId_documentId: { initiativeId: entityId, documentId } },
        update: {},
        create: { initiativeId: entityId, documentId, addedById: userId },
      });
    } else {
      await database.riskEvidence.upsert({
        where: { riskId_documentId: { riskId: entityId, documentId } },
        update: {},
        create: { riskId: entityId, documentId, addedById: userId },
      });
    }
  }

  async dashboardBase(): Promise<ExecutiveDashboardBase> {
    const now = new Date();
    const nextThirtyDays = new Date(now.getTime() + 30 * 86_400_000);
    const [
      activeUsers,
      recentActivity,
      metrics,
      objectives,
      kpiGroups,
      initiatives,
      risks,
      alerts,
      initiativeDeadlines,
      treatmentDeadlines,
    ] = await Promise.all([
      database.user.count({ where: { isActive: true } }),
      database.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          description: true,
          createdAt: true,
          user: { select: { id: true, fullName: true } },
        },
      }),
      this.metricSummaries(),
      database.strategicObjective.aggregate({
        where: { deletedAt: null },
        _count: { id: true },
        _avg: { progress: true },
      }),
      database.strategicKpi.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
      database.operationalInitiative.findMany({
        where: { deletedAt: null },
        select: { status: true, budget: true, actualSpending: true },
      }),
      database.institutionalRisk.findMany({
        where: { deletedAt: null },
        select: { status: true, residualScore: true },
      }),
      database.executiveAlert.findMany({
        where: { deletedAt: null, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        orderBy: [{ severity: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        take: 10,
      }),
      database.operationalInitiative.findMany({
        where: {
          deletedAt: null,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          endDate: { gte: now, lte: nextThirtyDays },
        },
        select: { id: true, code: true, name: true, endDate: true, status: true },
        orderBy: { endDate: 'asc' },
        take: 10,
      }),
      database.riskTreatment.findMany({
        where: {
          deletedAt: null,
          status: { not: 'COMPLETED' },
          dueDate: { gte: now, lte: nextThirtyDays },
        },
        select: { id: true, title: true, dueDate: true, status: true, riskId: true },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
    ]);
    const riskOpen = risks.filter((risk) => risk.status !== 'CLOSED');
    return {
      activeUsers,
      recentActivity: asRecords(recentActivity),
      metrics,
      objectives: {
        total: objectives._count.id,
        averageProgress: numeric(objectives._avg.progress),
      },
      kpis: Object.fromEntries(kpiGroups.map((group) => [group.status, group._count._all])),
      initiatives: {
        total: initiatives.length,
        active: initiatives.filter((initiative) => initiative.status === 'ACTIVE').length,
        delayed: initiatives.filter((initiative) => initiative.status === 'DELAYED').length,
        atRisk: initiatives.filter((initiative) => initiative.status === 'AT_RISK').length,
        completed: initiatives.filter((initiative) => initiative.status === 'COMPLETED').length,
        plannedBudget: initiatives.reduce(
          (total, initiative) => total + Number(initiative.budget),
          0,
        ),
        actualSpending: initiatives.reduce(
          (total, initiative) => total + Number(initiative.actualSpending),
          0,
        ),
      },
      risks: {
        open: riskOpen.length,
        critical: riskOpen.filter((risk) => risk.residualScore >= 15).length,
        averageResidualScore:
          riskOpen.length === 0
            ? null
            : Math.round(
                (riskOpen.reduce((total, risk) => total + risk.residualScore, 0) /
                  riskOpen.length) *
                  100,
              ) / 100,
      },
      alerts: asRecords(alerts),
      upcomingDeadlines: asRecords([
        ...initiativeDeadlines.map((deadline) => ({ ...deadline, module: 'initiatives' })),
        ...treatmentDeadlines.map((deadline) => ({ ...deadline, module: 'risks' })),
      ])
        .sort((left, right) =>
          String(left.endDate ?? left.dueDate).localeCompare(
            String(right.endDate ?? right.dueDate),
          ),
        )
        .slice(0, 10),
    };
  }

  async getHealthWeights(userId: string): Promise<HealthWeights> {
    const preference =
      (await database.executiveDashboardPreference.findFirst({
        where: { userId, deletedAt: null },
      })) ??
      (await database.executiveDashboardPreference.findFirst({
        where: { isDefault: true, deletedAt: null },
      }));
    return (preference?.healthWeights as HealthWeights | undefined) ?? defaultHealthWeights;
  }

  async updatePreferences(
    userId: string,
    input: Parameters<ExecutiveStore['updatePreferences']>[1],
  ) {
    return asRecord(
      await database.executiveDashboardPreference.upsert({
        where: { userId },
        update: {
          healthWeights: input.healthWeights,
          layout: input.layout as Prisma.InputJsonValue | undefined,
          quickActions: input.quickActions,
          updatedById: userId,
          deletedAt: null,
        },
        create: {
          key: `user-${userId}`,
          userId,
          healthWeights: input.healthWeights,
          layout: input.layout as Prisma.InputJsonValue | undefined,
          quickActions: input.quickActions ?? [],
          createdById: userId,
          updatedById: userId,
        },
      }),
    );
  }

  async createHealthSnapshot(
    input: Parameters<ExecutiveStore['createHealthSnapshot']>[0],
    userId: string,
  ) {
    return asRecord(
      await database.executiveHealthSnapshot.create({
        data: {
          score: input.score,
          coverage: input.coverage,
          rating: input.rating,
          components: input.components as Prisma.InputJsonValue,
          missingData: input.missingData,
          explanation: input.explanation,
          createdById: userId,
        },
      }),
    );
  }

  async healthHistory(limit: number) {
    return asRecords(
      await database.executiveHealthSnapshot.findMany({
        orderBy: { capturedAt: 'desc' },
        take: limit,
      }),
    );
  }

  async listAlerts(query: PageQuery) {
    const statuses = statusValues(query.status);
    const where: Prisma.ExecutiveAlertWhereInput = {
      deletedAt: null,
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
              { sourceModule: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(statuses?.length ? { status: { in: statuses as never[] } } : {}),
    };
    const [items, total] = await database.$transaction([
      database.executiveAlert.findMany({
        where,
        orderBy: [{ severity: 'desc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      database.executiveAlert.count({ where }),
    ]);
    return pageResult(items, total, query);
  }

  async actionAlert(id: string, action: 'acknowledge' | 'resolve' | 'dismiss', userId: string) {
    const now = new Date();
    const data = {
      acknowledge: {
        status: 'ACKNOWLEDGED' as const,
        acknowledgedAt: now,
        acknowledgedById: userId,
      },
      resolve: { status: 'RESOLVED' as const, resolvedAt: now, resolvedById: userId },
      dismiss: { status: 'DISMISSED' as const, dismissedAt: now, dismissedById: userId },
    }[action];
    return asRecord(
      await database.executiveAlert.update({
        where: { id },
        data: { ...data, updatedById: userId },
      }),
    );
  }

  async createAlert(input: Record<string, unknown>, userId: string) {
    return asRecord(
      await database.executiveAlert.create({
        data: {
          ...(input as Prisma.ExecutiveAlertUncheckedCreateInput),
          isAutoGenerated: false,
          createdById: userId,
          updatedById: userId,
        },
      }),
    );
  }

  async alertCandidates(now: Date): Promise<AlertCandidate[]> {
    const nextThirtyDays = new Date(now.getTime() + 30 * 86_400_000);
    const monthKey = now.toISOString().slice(0, 7);
    const [
      documents,
      initiatives,
      kpis,
      risks,
      treatments,
      budgetInitiatives,
      inactiveUsers,
      reports,
    ] = await Promise.all([
      database.document.findMany({
        where: {
          deletedAt: null,
          isArchived: false,
          expiryDate: { gte: now, lte: nextThirtyDays },
        },
        select: { id: true, expiryDate: true },
        take: 100,
      }),
      database.operationalInitiative.findMany({
        where: {
          deletedAt: null,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          OR: [{ endDate: { lt: now } }, { status: { in: ['DELAYED', 'AT_RISK'] } }],
        },
        select: { id: true, code: true, name: true, endDate: true, status: true },
        take: 100,
      }),
      database.strategicKpi.findMany({
        where: { deletedAt: null, status: { in: ['AT_RISK', 'OFF_TRACK'] } },
        select: { id: true, code: true, title: true, status: true },
        take: 100,
      }),
      database.institutionalRisk.findMany({
        where: { deletedAt: null, status: { not: 'CLOSED' }, residualScore: { gte: 15 } },
        select: { id: true, code: true, title: true, residualScore: true },
        take: 100,
      }),
      database.riskTreatment.findMany({
        where: { deletedAt: null, status: { not: 'COMPLETED' }, dueDate: { lt: now } },
        select: { id: true, title: true, dueDate: true, riskId: true },
        take: 100,
      }),
      database.operationalInitiative.findMany({
        where: { deletedAt: null, status: { notIn: ['CANCELLED'] } },
        select: { id: true, code: true, budget: true, actualSpending: true },
        take: 500,
      }),
      database.user.count({ where: { isActive: false } }),
      database.executiveReport.count({
        where: {
          deletedAt: null,
          generatedAt: { gte: new Date(`${monthKey}-01T00:00:00.000Z`) },
        },
      }),
    ]);
    const candidates: AlertCandidate[] = [
      ...documents.map((document) => ({
        fingerprint: `document-expiry:${document.id}:${document.expiryDate?.toISOString().slice(0, 10)}`,
        severity: 'HIGH' as const,
        title: 'وثيقة قريبة من الانتهاء',
        description: 'توجد وثيقة ضمن نطاق صلاحيتك التشغيلية تحتاج إلى مراجعة تاريخ الانتهاء.',
        sourceModule: 'documents',
        sourceRecordId: document.id,
        dueDate: document.expiryDate ?? undefined,
      })),
      ...initiatives.map((initiative) => ({
        fingerprint: `initiative-status:${initiative.id}:${initiative.status}:${initiative.endDate.toISOString().slice(0, 10)}`,
        severity: initiative.endDate < now ? ('HIGH' as const) : ('MEDIUM' as const),
        title: `مبادرة تحتاج متابعة: ${initiative.code}`,
        description:
          initiative.endDate < now
            ? 'تجاوزت المبادرة تاريخ الانتهاء ولم تُغلق.'
            : 'المبادرة مصنفة متعثرة أو متأخرة.',
        sourceModule: 'initiatives',
        sourceRecordId: initiative.id,
        dueDate: initiative.endDate,
      })),
      ...kpis.map((kpi) => ({
        fingerprint: `kpi-status:${kpi.id}:${kpi.status}`,
        severity: kpi.status === 'OFF_TRACK' ? ('HIGH' as const) : ('MEDIUM' as const),
        title: `مؤشر أداء يحتاج متابعة: ${kpi.code}`,
        description: 'مؤشر الأداء مصنف متعثرًا وفق آخر قياس معتمد.',
        sourceModule: 'kpi',
        sourceRecordId: kpi.id,
      })),
      ...risks.map((risk) => ({
        fingerprint: `critical-risk:${risk.id}:${risk.residualScore}`,
        severity: risk.residualScore >= 20 ? ('CRITICAL' as const) : ('HIGH' as const),
        title: `خطر حرج: ${risk.code}`,
        description: 'بلغت درجة الخطر المتبقي مستوى يستلزم المتابعة التنفيذية.',
        sourceModule: 'risks',
        sourceRecordId: risk.id,
      })),
      ...treatments.map((treatment) => ({
        fingerprint: `overdue-treatment:${treatment.id}:${treatment.dueDate.toISOString().slice(0, 10)}`,
        severity: 'HIGH' as const,
        title: 'معالجة خطر متأخرة',
        description: 'تجاوزت معالجة الخطر تاريخ الاستحقاق دون اكتمال.',
        sourceModule: 'risks',
        sourceRecordId: treatment.riskId,
        dueDate: treatment.dueDate,
      })),
      ...budgetInitiatives
        .filter((initiative) => Number(initiative.actualSpending) > Number(initiative.budget))
        .map((initiative) => ({
          fingerprint: `budget-overrun:${initiative.id}:${monthKey}`,
          severity: 'HIGH' as const,
          title: `تجاوز موازنة مبادرة: ${initiative.code}`,
          description: 'الإنفاق الفعلي للمبادرة يتجاوز الموازنة المعتمدة.',
          sourceModule: 'initiatives',
          sourceRecordId: initiative.id,
        })),
    ];
    if (inactiveUsers > 0) {
      candidates.push({
        fingerprint: `inactive-users:${monthKey}`,
        severity: 'LOW',
        title: 'مراجعة المستخدمين غير النشطين',
        description: `يوجد ${inactiveUsers} مستخدم غير نشط يحتاج إلى مراجعة دورية.`,
        sourceModule: 'users',
      });
    }
    if (reports === 0) {
      candidates.push({
        fingerprint: `missing-monthly-report:${monthKey}`,
        severity: 'MEDIUM',
        title: 'لا يوجد تقرير تنفيذي مولّد لهذا الشهر',
        description: 'لم يُعثر على تقرير تنفيذي مولّد خلال الشهر الحالي.',
        sourceModule: 'reports',
      });
    }
    return candidates;
  }

  async upsertGeneratedAlert(candidate: AlertCandidate) {
    return asRecord(
      await database.executiveAlert.upsert({
        where: { fingerprint: candidate.fingerprint },
        update: {
          severity: candidate.severity,
          title: candidate.title,
          description: candidate.description,
          dueDate: candidate.dueDate,
          updatedAt: new Date(),
        },
        create: { ...candidate, isAutoGenerated: true },
      }),
    );
  }

  async replaceReportSections(
    reportId: string,
    sections: Parameters<ExecutiveStore['replaceReportSections']>[1],
    userId: string,
  ) {
    return database.$transaction(async (transaction) => {
      await transaction.executiveReportSection.updateMany({
        where: { reportId, deletedAt: null },
        data: { deletedAt: new Date(), updatedById: userId },
      });
      await transaction.executiveReportSection.createMany({
        data: sections.map((section) => ({
          reportId,
          title: section.title,
          content: section.content as Prisma.InputJsonValue,
          sortOrder: section.sortOrder,
          sourceReferences: section.sourceReferences as Prisma.InputJsonValue | undefined,
          createdById: userId,
          updatedById: userId,
        })),
      });
      return asRecord(
        await transaction.executiveReport.update({
          where: { id: reportId },
          data: { status: 'GENERATED', generatedAt: new Date(), updatedById: userId },
          include: {
            sections: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
          },
        }),
      );
    });
  }

  async transitionReport(
    reportId: string,
    status: 'GENERATED' | 'APPROVED' | 'ARCHIVED',
    userId: string,
  ) {
    return asRecord(
      await database.executiveReport.update({
        where: { id: reportId },
        data: {
          status,
          updatedById: userId,
          ...(status === 'APPROVED' ? { approvedById: userId, approvedAt: new Date() } : {}),
        },
        include: {
          preparedBy: { select: { id: true, fullName: true } },
          approvedBy: { select: { id: true, fullName: true } },
          sections: { where: { deletedAt: null }, orderBy: { sortOrder: 'asc' } },
        },
      }),
    );
  }

  async activity(query: PageQuery) {
    const where: Prisma.AuditLogWhereInput = {
      OR: [
        { action: { startsWith: 'metrics.' } },
        { action: { startsWith: 'objectives.' } },
        { action: { startsWith: 'kpi.' } },
        { action: { startsWith: 'initiatives.' } },
        { action: { startsWith: 'risks.' } },
        { action: { startsWith: 'alerts.' } },
        { action: { startsWith: 'reports.' } },
        { action: { startsWith: 'dashboard.' } },
      ],
    };
    const [items, total] = await database.$transaction([
      database.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { user: { select: { id: true, fullName: true } } },
      }),
      database.auditLog.count({ where }),
    ]);
    return pageResult(items, total, query);
  }

  countAlerts(status?: Parameters<ExecutiveStore['countAlerts']>[0]) {
    return database.executiveAlert.count({
      where: { deletedAt: null, ...(status ? { status } : {}) },
    });
  }
}
