import { Prisma } from '@prisma/client';
import { database } from '@quran-hajrah/database';
import type { AnalysisAuditInput, AnalysisStore, SaveExtractionInput } from './store.js';
import { AnalysisPipelineError } from './types.js';
import type {
  AnalysisConfigurationRecord,
  AnalysisJobRecord,
  AnalysisListQuery,
  AnalysisPipelineStage,
  AnalysisPageRecord,
  AnalysisTableRecord,
  ConflictAction,
  ConflictResult,
  ImportBatchRecord,
  ImportDecision,
  ImportTargetType,
  ProposalListQuery,
  ProposalRecord,
  SourceEvidenceRecord,
} from './types.js';
import { runAtomicImport } from './transaction.js';

const jobInclude = {
  document: {
    select: {
      id: true,
      title: true,
      confidentialityLevel: true,
      documentType: true,
      versionNumber: true,
    },
  },
} satisfies Prisma.DocumentAnalysisJobInclude;

const proposalInclude = {
  fields: { orderBy: { sortOrder: 'asc' as const } },
  parentRelations: {
    include: {
      childProposal: {
        select: { id: true, proposalType: true, title: true, decision: true },
      },
    },
  },
  childRelations: {
    include: {
      parentProposal: {
        select: { id: true, proposalType: true, title: true, decision: true },
      },
    },
  },
} satisfies Prisma.ExtractionProposalInclude;

const numeric = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const jsonObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const prismaJson = (value: unknown) => value as Prisma.InputJsonValue;
const optionalPrismaJson = (value: unknown) =>
  value === undefined || value === null ? undefined : prismaJson(value);
const asDate = (value: unknown) => (value instanceof Date ? value : new Date(String(value)));

export const analysisPersistenceTransactionOptions = {
  maxWait: 15_000,
  timeout: 120_000,
} as const;

const mapConfiguration = (record: {
  id: string;
  key: string;
  isActive: boolean;
  providerVersion: string;
  maxFileSizeBytes: number;
  maxPages: number;
  maxTables: number;
  minimumTextCharacters: number;
  proposalConfidence: unknown;
  reviewSlaHours: number;
  enabledDocumentTypes: string[];
  enabledRuleIds: string[];
  createdAt: Date;
  updatedAt: Date;
}): AnalysisConfigurationRecord => ({
  ...record,
  proposalConfidence: Number(record.proposalConfidence),
});

const mapJob = (
  record: Prisma.DocumentAnalysisJobGetPayload<{ include: typeof jobInclude }>,
): AnalysisJobRecord => ({
  ...record,
  providerMetadata: record.providerMetadata ? jsonObject(record.providerMetadata) : null,
});

const mapProposal = (
  record: Prisma.ExtractionProposalGetPayload<{ include: typeof proposalInclude }>,
): ProposalRecord => ({
  ...record,
  confidence: Number(record.confidence),
  proposedData: jsonObject(record.proposedData),
  editedData: record.editedData ? jsonObject(record.editedData) : null,
  fields: record.fields.map((proposalField) => ({
    key: proposalField.key,
    labelAr: proposalField.labelAr,
    dataType: proposalField.dataType as never,
    value: proposalField.value as never,
    ...(proposalField.sourceValue ? { sourceValue: proposalField.sourceValue } : {}),
    ...(proposalField.confidence !== null ? { confidence: Number(proposalField.confidence) } : {}),
  })),
  relations: [
    ...record.parentRelations.map((relation) => ({
      id: relation.id,
      relationType: relation.relationType,
      confidence: Number(relation.confidence),
      direction: 'child' as const,
      proposal: relation.childProposal,
    })),
    ...record.childRelations.map((relation) => ({
      id: relation.id,
      relationType: relation.relationType,
      confidence: Number(relation.confidence),
      direction: 'parent' as const,
      proposal: relation.parentProposal,
    })),
  ],
});

const effectiveData = (proposal: { proposedData: unknown; editedData: unknown }) => ({
  ...jsonObject(proposal.proposedData),
  ...jsonObject(proposal.editedData),
});

type DbClient = Prisma.TransactionClient | typeof database;

const importRelationInclude = {
  childRelations: {
    include: {
      parentProposal: {
        select: {
          id: true,
          decision: true,
          importTargetType: true,
        },
      },
    },
  },
} satisfies Prisma.ExtractionProposalInclude;

type ProposalWithImportRelations = Prisma.ExtractionProposalGetPayload<{
  include: typeof importRelationInclude;
}>;

const relationImportField: Record<string, string | undefined> = {
  OBJECTIVE_KPI: 'objectiveId',
  OBJECTIVE_INITIATIVE: 'objectiveId',
  INITIATIVE_MILESTONE: 'initiativeId',
  RISK_TREATMENT: 'riskId',
  BUDGET_LINE_ITEM: 'budgetRecordId',
};

const importPriority: Partial<Record<ImportTargetType, number>> = {
  STRATEGIC_OBJECTIVE: 10,
  BUDGET_RECORD: 10,
  METRIC: 10,
  RISK: 10,
  KPI: 20,
  INITIATIVE: 20,
  METRIC_VALUE: 20,
  BUDGET_LINE: 20,
  RISK_TREATMENT: 20,
  MILESTONE: 30,
};

export const hydrateRelationData = async (
  client: DbClient,
  proposal: ProposalWithImportRelations,
  importedTargets: Map<string, string>,
  allowApprovedParentPlaceholder: boolean,
) => {
  const data = effectiveData(proposal);
  for (const relation of proposal.childRelations) {
    const targetField = relationImportField[relation.relationType];
    if (!targetField || nonEmpty(data[targetField])) continue;
    let targetId = importedTargets.get(relation.parentProposalId);
    if (!targetId) {
      const importedParent = await client.sourceEvidenceReference.findFirst({
        where: { sourceProposalId: relation.parentProposalId },
        select: { targetRecordId: true },
      });
      targetId = importedParent?.targetRecordId;
    }
    if (
      !targetId &&
      allowApprovedParentPlaceholder &&
      ['APPROVED', 'EDITED'].includes(relation.parentProposal.decision)
    ) {
      targetId = relation.parentProposalId;
    }
    if (targetId) data[targetField] = targetId;
  }
  return data;
};

const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const finite = (value: unknown) => value !== '' && Number.isFinite(Number(value));
const requiredFields: Partial<
  Record<ImportTargetType, Array<[string, (value: unknown) => boolean]>>
> = {
  STRATEGIC_OBJECTIVE: [
    ['code', nonEmpty],
    ['title', nonEmpty],
    ['strategicAxis', nonEmpty],
    ['startDate', nonEmpty],
    ['endDate', nonEmpty],
  ],
  KPI: [
    ['objectiveId', nonEmpty],
    ['code', nonEmpty],
    ['title', nonEmpty],
    ['target', finite],
    ['frequency', nonEmpty],
  ],
  METRIC: [
    ['key', nonEmpty],
    ['nameAr', nonEmpty],
    ['dataType', nonEmpty],
    ['frequency', nonEmpty],
  ],
  METRIC_VALUE: [
    ['metricId', nonEmpty],
    ['measuredAt', nonEmpty],
  ],
  INITIATIVE: [
    ['code', nonEmpty],
    ['name', nonEmpty],
    ['department', nonEmpty],
    ['startDate', nonEmpty],
    ['endDate', nonEmpty],
  ],
  MILESTONE: [
    ['initiativeId', nonEmpty],
    ['title', nonEmpty],
    ['dueDate', nonEmpty],
  ],
  RISK: [
    ['code', nonEmpty],
    ['title', nonEmpty],
    ['category', nonEmpty],
    ['likelihood', nonEmpty],
    ['impact', nonEmpty],
    ['residualLikelihood', nonEmpty],
    ['residualImpact', nonEmpty],
  ],
  RISK_TREATMENT: [
    ['riskId', nonEmpty],
    ['title', nonEmpty],
    ['dueDate', nonEmpty],
  ],
  EXECUTIVE_ALERT: [
    ['severity', nonEmpty],
    ['title', nonEmpty],
    ['description', nonEmpty],
  ],
  EXECUTIVE_REPORT_SECTION: [
    ['reportId', nonEmpty],
    ['title', nonEmpty],
    ['content', (value) => value !== undefined && value !== null],
  ],
  BUDGET_RECORD: [
    ['fiscalYear', finite],
    ['title', nonEmpty],
    ['totalPlanned', finite],
  ],
  BUDGET_LINE: [
    ['budgetRecordId', nonEmpty],
    ['category', nonEmpty],
    ['plannedAmount', finite],
  ],
};

const findExisting = async (
  client: DbClient,
  targetType: ImportTargetType,
  data: Record<string, unknown>,
) => {
  switch (targetType) {
    case 'STRATEGIC_OBJECTIVE':
      return client.strategicObjective.findFirst({
        where: {
          deletedAt: null,
          OR: [
            ...(nonEmpty(data.code) ? [{ code: String(data.code) }] : []),
            ...(nonEmpty(data.title)
              ? [{ title: { equals: String(data.title), mode: 'insensitive' as const } }]
              : []),
          ],
        },
        select: { id: true },
      });
    case 'KPI':
      return client.strategicKpi.findFirst({
        where: {
          deletedAt: null,
          OR: [
            ...(nonEmpty(data.code) ? [{ code: String(data.code) }] : []),
            ...(nonEmpty(data.title)
              ? [{ title: { equals: String(data.title), mode: 'insensitive' as const } }]
              : []),
          ],
        },
        select: { id: true },
      });
    case 'METRIC':
      return nonEmpty(data.key)
        ? client.institutionalMetric.findFirst({
            where: { key: String(data.key), deletedAt: null },
            select: { id: true },
          })
        : null;
    case 'METRIC_VALUE':
      return nonEmpty(data.metricId) && nonEmpty(data.measuredAt)
        ? client.metricValue.findFirst({
            where: {
              metricId: String(data.metricId),
              measuredAt: asDate(data.measuredAt),
              deletedAt: null,
            },
            select: { id: true },
          })
        : null;
    case 'INITIATIVE':
      return client.operationalInitiative.findFirst({
        where: {
          deletedAt: null,
          OR: [
            ...(nonEmpty(data.code) ? [{ code: String(data.code) }] : []),
            ...(nonEmpty(data.name)
              ? [{ name: { equals: String(data.name), mode: 'insensitive' as const } }]
              : []),
          ],
        },
        select: { id: true },
      });
    case 'RISK':
      return client.institutionalRisk.findFirst({
        where: {
          deletedAt: null,
          OR: [
            ...(nonEmpty(data.code) ? [{ code: String(data.code) }] : []),
            ...(nonEmpty(data.title)
              ? [{ title: { equals: String(data.title), mode: 'insensitive' as const } }]
              : []),
          ],
        },
        select: { id: true },
      });
    case 'BUDGET_RECORD':
      return finite(data.fiscalYear) && nonEmpty(data.title)
        ? client.budgetRecord.findFirst({
            where: {
              fiscalYear: Number(data.fiscalYear),
              title: String(data.title),
              deletedAt: null,
            },
            select: { id: true },
          })
        : null;
    case 'BUDGET_LINE':
      return nonEmpty(data.budgetRecordId) && nonEmpty(data.category)
        ? client.budgetLine.findFirst({
            where: {
              budgetRecordId: String(data.budgetRecordId),
              category: String(data.category),
              code: nonEmpty(data.code) ? String(data.code) : null,
              deletedAt: null,
            },
            select: { id: true },
          })
        : null;
    default:
      return null;
  }
};

export const conflictForProposal = async (
  client: DbClient,
  proposal: {
    id: string;
    importTargetType: ImportTargetType;
    proposedData: unknown;
    editedData: unknown;
  },
): Promise<ConflictResult> => {
  const imported = await client.sourceEvidenceReference.findFirst({
    where: { sourceProposalId: proposal.id },
    select: { targetRecordId: true },
  });
  if (imported) {
    return {
      proposalId: proposal.id,
      targetType: proposal.importTargetType,
      status: 'already_imported',
      reason: 'سبق استيراد هذا المقترح.',
      existingRecordId: imported.targetRecordId,
      allowedActions: ['skip'],
      defaultAction: 'skip',
    };
  }
  if (proposal.importTargetType === 'NONE') {
    return {
      proposalId: proposal.id,
      targetType: 'NONE',
      status: 'incomplete',
      reason: 'لم تُحدد وجهة استيراد لهذا النوع.',
      allowedActions: ['skip'],
      defaultAction: 'skip',
    };
  }
  const data = effectiveData(proposal);
  const missing = (requiredFields[proposal.importTargetType] ?? [])
    .filter(([key, validateValue]) => !validateValue(data[key]))
    .map(([key]) => key);
  if (missing.length > 0) {
    return {
      proposalId: proposal.id,
      targetType: proposal.importTargetType,
      status: 'incomplete',
      reason: `حقول مطلوبة غير مكتملة: ${missing.join(', ')}`,
      allowedActions: ['skip'],
      defaultAction: 'skip',
    };
  }
  const existing = await findExisting(client, proposal.importTargetType, data);
  if (existing) {
    return {
      proposalId: proposal.id,
      targetType: proposal.importTargetType,
      status: 'conflict',
      reason: 'يوجد سجل مطابق بالرمز أو العنوان أو المفتاح.',
      existingRecordId: existing.id,
      allowedActions: ['skip', 'update', 'create', 'merge'],
      defaultAction: 'skip',
    };
  }
  return {
    proposalId: proposal.id,
    targetType: proposal.importTargetType,
    status: 'ready',
    allowedActions: ['create'],
    defaultAction: 'create',
  };
};

const selectedData = (
  data: Record<string, unknown>,
  action: ConflictAction,
  selectedFields?: string[],
) => {
  if (action !== 'merge' || !selectedFields?.length) return data;
  return Object.fromEntries(
    selectedFields.filter((key) => Object.hasOwn(data, key)).map((key) => [key, data[key]]),
  );
};

const applyImport = async (
  transaction: Prisma.TransactionClient,
  targetType: ImportTargetType,
  data: Record<string, unknown>,
  userId: string,
  action: ConflictAction,
  existingRecordId?: string,
  selectedFields?: string[],
) => {
  const update = action === 'update' || action === 'merge';
  const values = selectedData(data, action, selectedFields);
  switch (targetType) {
    case 'STRATEGIC_OBJECTIVE': {
      const payload = {
        ...(nonEmpty(values.title) ? { title: String(values.title) } : {}),
        ...(nonEmpty(values.description) ? { description: String(values.description) } : {}),
        ...(nonEmpty(values.strategicAxis) ? { strategicAxis: String(values.strategicAxis) } : {}),
        ...(nonEmpty(values.objectiveLevel)
          ? { objectiveLevel: String(values.objectiveLevel) }
          : {}),
        ...(finite(values.baseline) ? { baseline: Number(values.baseline) } : {}),
        ...(finite(values.target) ? { target: Number(values.target) } : {}),
        ...(nonEmpty(values.startDate) ? { startDate: asDate(values.startDate) } : {}),
        ...(nonEmpty(values.endDate) ? { endDate: asDate(values.endDate) } : {}),
        ...(nonEmpty(values.ownerId) ? { ownerId: String(values.ownerId) } : {}),
        ...(nonEmpty(values.status) ? { status: String(values.status) as never } : {}),
        ...(finite(values.weight) ? { weight: Number(values.weight) } : {}),
        ...(finite(values.progress) ? { progress: Number(values.progress) } : {}),
        updatedById: userId,
      };
      if (update && existingRecordId) {
        return transaction.strategicObjective.update({
          where: { id: existingRecordId },
          data: payload,
          select: { id: true },
        });
      }
      return transaction.strategicObjective.create({
        data: {
          code: String(data.code),
          title: String(data.title),
          strategicAxis: String(data.strategicAxis),
          startDate: asDate(data.startDate),
          endDate: asDate(data.endDate),
          ...payload,
          createdById: userId,
        },
        select: { id: true },
      });
    }
    case 'KPI': {
      const payload = {
        ...(nonEmpty(values.objectiveId) ? { objectiveId: String(values.objectiveId) } : {}),
        ...(nonEmpty(values.title) ? { title: String(values.title) } : {}),
        ...(nonEmpty(values.description) ? { description: String(values.description) } : {}),
        ...(nonEmpty(values.formula) ? { formula: String(values.formula) } : {}),
        ...(finite(values.baseline) ? { baseline: Number(values.baseline) } : {}),
        ...(finite(values.target) ? { target: Number(values.target) } : {}),
        ...(nonEmpty(values.unit) ? { unit: String(values.unit) } : {}),
        ...(nonEmpty(values.frequency) ? { frequency: String(values.frequency) as never } : {}),
        ...(nonEmpty(values.ownerId) ? { ownerId: String(values.ownerId) } : {}),
        ...(nonEmpty(values.dataSource) ? { dataSource: String(values.dataSource) } : {}),
        ...(nonEmpty(values.status) ? { status: String(values.status) as never } : {}),
        ...(finite(values.weight) ? { weight: Number(values.weight) } : {}),
        updatedById: userId,
      };
      if (update && existingRecordId) {
        return transaction.strategicKpi.update({
          where: { id: existingRecordId },
          data: payload,
          select: { id: true },
        });
      }
      return transaction.strategicKpi.create({
        data: {
          objectiveId: String(data.objectiveId),
          code: String(data.code),
          title: String(data.title),
          target: Number(data.target),
          frequency: String(data.frequency) as never,
          ...payload,
          createdById: userId,
        },
        select: { id: true },
      });
    }
    case 'METRIC': {
      const payload = {
        ...(nonEmpty(values.nameAr) ? { nameAr: String(values.nameAr) } : {}),
        ...(nonEmpty(values.description) ? { description: String(values.description) } : {}),
        ...(nonEmpty(values.unit) ? { unit: String(values.unit) } : {}),
        ...(nonEmpty(values.dataType) ? { dataType: String(values.dataType) as never } : {}),
        ...(nonEmpty(values.frequency) ? { frequency: String(values.frequency) as never } : {}),
        ...(nonEmpty(values.responsibleDepartment)
          ? { responsibleDepartment: String(values.responsibleDepartment) }
          : {}),
        ...(finite(values.targetValue) ? { targetValue: Number(values.targetValue) } : {}),
        ...(finite(values.warningThreshold)
          ? { warningThreshold: Number(values.warningThreshold) }
          : {}),
        ...(finite(values.criticalThreshold)
          ? { criticalThreshold: Number(values.criticalThreshold) }
          : {}),
        updatedById: userId,
      };
      if (update && existingRecordId) {
        return transaction.institutionalMetric.update({
          where: { id: existingRecordId },
          data: payload,
          select: { id: true },
        });
      }
      return transaction.institutionalMetric.create({
        data: {
          key: String(data.key),
          nameAr: String(data.nameAr),
          dataType: String(data.dataType) as never,
          frequency: String(data.frequency) as never,
          ...payload,
          createdById: userId,
        },
        select: { id: true },
      });
    }
    case 'METRIC_VALUE': {
      const record = await transaction.metricValue.create({
        data: {
          metricId: String(data.metricId),
          ...(finite(data.numericValue) ? { numericValue: Number(data.numericValue) } : {}),
          ...(nonEmpty(data.textValue) ? { textValue: String(data.textValue) } : {}),
          measuredAt: asDate(data.measuredAt),
          ...(nonEmpty(data.sourceType) ? { sourceType: String(data.sourceType) } : {}),
          ...(nonEmpty(data.notes) ? { notes: String(data.notes) } : {}),
          createdById: userId,
        },
        select: { id: true },
      });
      await transaction.institutionalMetric.update({
        where: { id: String(data.metricId) },
        data: {
          ...(finite(data.numericValue)
            ? { currentNumericValue: Number(data.numericValue), currentTextValue: null }
            : { currentTextValue: String(data.textValue), currentNumericValue: null }),
          currentMeasuredAt: asDate(data.measuredAt),
          updatedById: userId,
        },
      });
      return record;
    }
    case 'INITIATIVE': {
      const payload = {
        ...(nonEmpty(values.name) ? { name: String(values.name) } : {}),
        ...(nonEmpty(values.description) ? { description: String(values.description) } : {}),
        ...(nonEmpty(values.objectiveId) ? { objectiveId: String(values.objectiveId) } : {}),
        ...(nonEmpty(values.department) ? { department: String(values.department) } : {}),
        ...(nonEmpty(values.ownerId) ? { ownerId: String(values.ownerId) } : {}),
        ...(nonEmpty(values.startDate) ? { startDate: asDate(values.startDate) } : {}),
        ...(nonEmpty(values.endDate) ? { endDate: asDate(values.endDate) } : {}),
        ...(finite(values.budget) ? { budget: Number(values.budget) } : {}),
        ...(finite(values.actualSpending) ? { actualSpending: Number(values.actualSpending) } : {}),
        ...(finite(values.progress) ? { progress: Number(values.progress) } : {}),
        ...(nonEmpty(values.status) ? { status: String(values.status) as never } : {}),
        updatedById: userId,
      };
      if (update && existingRecordId) {
        return transaction.operationalInitiative.update({
          where: { id: existingRecordId },
          data: payload,
          select: { id: true },
        });
      }
      return transaction.operationalInitiative.create({
        data: {
          code: String(data.code),
          name: String(data.name),
          department: String(data.department),
          startDate: asDate(data.startDate),
          endDate: asDate(data.endDate),
          ...payload,
          createdById: userId,
        },
        select: { id: true },
      });
    }
    case 'MILESTONE':
      return transaction.initiativeMilestone.create({
        data: {
          initiativeId: String(data.initiativeId),
          title: String(data.title),
          ...(nonEmpty(data.description) ? { description: String(data.description) } : {}),
          dueDate: asDate(data.dueDate),
          ...(finite(data.progress) ? { progress: Number(data.progress) } : {}),
          ...(nonEmpty(data.status) ? { status: String(data.status) as never } : {}),
          createdById: userId,
          updatedById: userId,
        },
        select: { id: true },
      });
    case 'RISK': {
      const likelihoodScore = ['RARE', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'ALMOST_CERTAIN'];
      const impactScore = ['INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE'];
      const score = (likelihood: unknown, impact: unknown) =>
        (likelihoodScore.indexOf(String(likelihood)) + 1) *
        (impactScore.indexOf(String(impact)) + 1);
      const payload = {
        ...(nonEmpty(values.title) ? { title: String(values.title) } : {}),
        ...(nonEmpty(values.description) ? { description: String(values.description) } : {}),
        ...(nonEmpty(values.category) ? { category: String(values.category) } : {}),
        ...(nonEmpty(values.cause) ? { cause: String(values.cause) } : {}),
        ...(nonEmpty(values.consequence) ? { consequence: String(values.consequence) } : {}),
        ...(nonEmpty(values.likelihood) ? { likelihood: String(values.likelihood) as never } : {}),
        ...(nonEmpty(values.impact) ? { impact: String(values.impact) as never } : {}),
        ...(nonEmpty(values.existingControls)
          ? { existingControls: String(values.existingControls) }
          : {}),
        ...(nonEmpty(values.residualLikelihood)
          ? { residualLikelihood: String(values.residualLikelihood) as never }
          : {}),
        ...(nonEmpty(values.residualImpact)
          ? { residualImpact: String(values.residualImpact) as never }
          : {}),
        ...(nonEmpty(values.status) ? { status: String(values.status) as never } : {}),
        ...(nonEmpty(values.dueDate) ? { dueDate: asDate(values.dueDate) } : {}),
        ...(nonEmpty(values.reviewDate) ? { reviewDate: asDate(values.reviewDate) } : {}),
        ...(nonEmpty(values.objectiveId) ? { objectiveId: String(values.objectiveId) } : {}),
        ...(nonEmpty(values.initiativeId) ? { initiativeId: String(values.initiativeId) } : {}),
        updatedById: userId,
      };
      if (update && existingRecordId) {
        return transaction.institutionalRisk.update({
          where: { id: existingRecordId },
          data: {
            ...payload,
            ...(values.likelihood || values.impact
              ? {
                  inherentScore: score(
                    values.likelihood ?? data.likelihood,
                    values.impact ?? data.impact,
                  ),
                }
              : {}),
            ...(values.residualLikelihood || values.residualImpact
              ? {
                  residualScore: score(
                    values.residualLikelihood ?? data.residualLikelihood,
                    values.residualImpact ?? data.residualImpact,
                  ),
                }
              : {}),
          },
          select: { id: true },
        });
      }
      return transaction.institutionalRisk.create({
        data: {
          code: String(data.code),
          title: String(data.title),
          category: String(data.category),
          likelihood: String(data.likelihood) as never,
          impact: String(data.impact) as never,
          inherentScore: score(data.likelihood, data.impact),
          residualLikelihood: String(data.residualLikelihood) as never,
          residualImpact: String(data.residualImpact) as never,
          residualScore: score(data.residualLikelihood, data.residualImpact),
          ...payload,
          createdById: userId,
        },
        select: { id: true },
      });
    }
    case 'RISK_TREATMENT':
      return transaction.riskTreatment.create({
        data: {
          riskId: String(data.riskId),
          title: String(data.title),
          ...(nonEmpty(data.description) ? { description: String(data.description) } : {}),
          ...(nonEmpty(data.ownerId) ? { ownerId: String(data.ownerId) } : {}),
          dueDate: asDate(data.dueDate),
          ...(finite(data.progress) ? { progress: Number(data.progress) } : {}),
          ...(nonEmpty(data.status) ? { status: String(data.status) as never } : {}),
          createdById: userId,
          updatedById: userId,
        },
        select: { id: true },
      });
    case 'EXECUTIVE_ALERT':
      return transaction.executiveAlert.create({
        data: {
          severity: String(data.severity) as never,
          title: String(data.title),
          description: String(data.description),
          sourceModule: 'document_analysis',
          ...(nonEmpty(data.sourceRecordId) ? { sourceRecordId: String(data.sourceRecordId) } : {}),
          ...(nonEmpty(data.dueDate) ? { dueDate: asDate(data.dueDate) } : {}),
          createdById: userId,
          updatedById: userId,
        },
        select: { id: true },
      });
    case 'EXECUTIVE_REPORT_SECTION':
      return transaction.executiveReportSection.create({
        data: {
          reportId: String(data.reportId),
          title: String(data.title),
          content: prismaJson(data.content),
          sortOrder: finite(data.sortOrder) ? Number(data.sortOrder) : 0,
          createdById: userId,
          updatedById: userId,
        },
        select: { id: true },
      });
    case 'BUDGET_RECORD': {
      const payload = {
        ...(finite(values.fiscalYear) ? { fiscalYear: Number(values.fiscalYear) } : {}),
        ...(nonEmpty(values.title) ? { title: String(values.title) } : {}),
        ...(nonEmpty(values.periodStart) ? { periodStart: asDate(values.periodStart) } : {}),
        ...(nonEmpty(values.periodEnd) ? { periodEnd: asDate(values.periodEnd) } : {}),
        ...(finite(values.totalPlanned) ? { totalPlanned: Number(values.totalPlanned) } : {}),
        ...(nonEmpty(values.currency) ? { currency: String(values.currency) } : {}),
        ...(nonEmpty(values.department) ? { department: String(values.department) } : {}),
        updatedById: userId,
      };
      if (update && existingRecordId) {
        return transaction.budgetRecord.update({
          where: { id: existingRecordId },
          data: payload,
          select: { id: true },
        });
      }
      return transaction.budgetRecord.create({
        data: {
          fiscalYear: Number(data.fiscalYear),
          title: String(data.title),
          totalPlanned: Number(data.totalPlanned),
          ...payload,
          createdById: userId,
        },
        select: { id: true },
      });
    }
    case 'BUDGET_LINE': {
      const payload = {
        ...(nonEmpty(values.category) ? { category: String(values.category) } : {}),
        ...(nonEmpty(values.code) ? { code: String(values.code) } : {}),
        ...(nonEmpty(values.description) ? { description: String(values.description) } : {}),
        ...(finite(values.plannedAmount) ? { plannedAmount: Number(values.plannedAmount) } : {}),
        ...(finite(values.actualAmount) ? { actualAmount: Number(values.actualAmount) } : {}),
        ...(nonEmpty(values.department) ? { department: String(values.department) } : {}),
        updatedById: userId,
      };
      if (update && existingRecordId) {
        return transaction.budgetLine.update({
          where: { id: existingRecordId },
          data: payload,
          select: { id: true },
        });
      }
      return transaction.budgetLine.create({
        data: {
          budgetRecordId: String(data.budgetRecordId),
          category: String(data.category),
          plannedAmount: Number(data.plannedAmount),
          ...payload,
          createdById: userId,
        },
        select: { id: true },
      });
    }
    default:
      throw new Error(`Unsupported import target: ${targetType}`);
  }
};

export class PrismaAnalysisStore implements AnalysisStore {
  async getConfiguration() {
    const configuration = await database.documentAnalysisConfiguration.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!configuration) throw new Error('Document analysis configuration is missing.');
    return mapConfiguration(configuration);
  }

  async updateConfiguration(
    input: Parameters<AnalysisStore['updateConfiguration']>[0],
    userId: string,
  ) {
    const current = await this.getConfiguration();
    const configuration = await database.documentAnalysisConfiguration.update({
      where: { id: current.id },
      data: {
        ...input,
        updatedById: userId,
      },
    });
    return mapConfiguration(configuration);
  }

  async findJobByFingerprint(fingerprint: string) {
    const job = await database.documentAnalysisJob.findUnique({
      where: { fingerprint },
      include: jobInclude,
    });
    return job ? mapJob(job) : null;
  }

  async createJob(input: Parameters<AnalysisStore['createJob']>[0]) {
    return mapJob(
      await database.documentAnalysisJob.create({
        data: input,
        include: jobInclude,
      }),
    );
  }

  async getJob(id: string) {
    const job = await database.documentAnalysisJob.findFirst({
      where: { id, deletedAt: null },
      include: jobInclude,
    });
    return job ? mapJob(job) : null;
  }

  async listJobs(query: AnalysisListQuery) {
    const where: Prisma.DocumentAnalysisJobWhereInput = {
      deletedAt: null,
      ...(query.documentId ? { documentId: query.documentId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? { document: { title: { contains: query.search, mode: 'insensitive' } } }
        : {}),
    };
    const [items, total] = await database.$transaction([
      database.documentAnalysisJob.findMany({
        where,
        include: jobInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      database.documentAnalysisJob.count({ where }),
    ]);
    return {
      items: items.map(mapJob),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async updateJob(id: string, input: Parameters<AnalysisStore['updateJob']>[1]) {
    return mapJob(
      await database.documentAnalysisJob.update({
        where: { id },
        data: {
          ...input,
          providerMetadata:
            input.providerMetadata === undefined
              ? undefined
              : input.providerMetadata === null
                ? Prisma.JsonNull
                : prismaJson(input.providerMetadata),
        },
        include: jobInclude,
      }),
    );
  }

  async saveExtraction(jobId: string, input: SaveExtractionInput) {
    let stage: AnalysisPipelineStage = 'page_creation';
    const reportStage = (nextStage: AnalysisPipelineStage) => {
      stage = nextStage;
      input.reportStage?.(nextStage);
    };

    try {
      return await database.$transaction(async (transaction) => {
        const job = await transaction.documentAnalysisJob.findUniqueOrThrow({
          where: { id: jobId },
        });
        await transaction.extractionProposal.deleteMany({ where: { jobId } });
        await transaction.documentPage.deleteMany({ where: { jobId } });

        reportStage('page_creation');
        for (const page of input.pages) {
          await transaction.documentPage.create({
            data: {
              jobId,
              documentId: job.documentId,
              pageNumber: page.pageNumber,
              hasEmbeddedText: page.hasEmbeddedText,
              textLength: page.text.length,
              extractionQuality: page.quality,
              width: page.width,
              height: page.height,
              extractedText: {
                create: {
                  rawText: page.rawText,
                  normalizedText: page.text,
                  characterCount: page.text.length,
                  extractionMethod: input.extractionMethod,
                  extractionVersion: input.extractionVersion,
                },
              },
              tables: {
                create: page.tables.map((table) => ({
                  jobId,
                  tableIndex: table.tableIndex,
                  title: table.title,
                  sourceSection: table.sourceSection,
                  rowCount: table.rows.length,
                  columnCount: Math.max(0, ...table.rows.map((row) => row.length)),
                  extractionMethod: table.extractionMethod,
                  confidence: table.confidence,
                  cells: {
                    create: table.rows.flatMap((row, rowIndex) =>
                      row.map((text, columnIndex) => ({
                        rowIndex,
                        columnIndex,
                        text,
                      })),
                    ),
                  },
                })),
              },
            },
          });
        }

        reportStage('proposal_persistence');
        const proposalIds = new Map<string, string>();
        for (const proposal of input.proposals) {
          const created = await transaction.extractionProposal.create({
            data: {
              jobId,
              documentId: job.documentId,
              documentVersionId: job.documentVersionId,
              proposalType: proposal.proposalType,
              title: proposal.title,
              proposedData: prismaJson(proposal.proposedData),
              importTargetType: proposal.importTargetType,
              extractionRuleId: proposal.extractionRuleId,
              extractionMethod: proposal.extractionMethod,
              confidence: proposal.confidence,
              sourcePage: proposal.sourcePage,
              sourceSection: proposal.sourceSection,
              evidenceSnippet: proposal.evidenceSnippet,
              fields: {
                create: proposal.fields.map((proposalField, sortOrder) => ({
                  key: proposalField.key,
                  labelAr: proposalField.labelAr,
                  dataType: proposalField.dataType,
                  value: optionalPrismaJson(proposalField.value),
                  sourceValue: proposalField.sourceValue,
                  confidence: proposalField.confidence,
                  sortOrder,
                })),
              },
            },
            select: { id: true },
          });
          if (proposal.candidateKey) proposalIds.set(proposal.candidateKey, created.id);
        }
        for (const proposal of input.proposals) {
          if (!proposal.candidateKey || !proposal.parentCandidateKey || !proposal.relationType) {
            continue;
          }
          const parentProposalId = proposalIds.get(proposal.parentCandidateKey);
          const childProposalId = proposalIds.get(proposal.candidateKey);
          if (!parentProposalId || !childProposalId || parentProposalId === childProposalId) {
            continue;
          }
          await transaction.extractionProposalRelation.create({
            data: {
              parentProposalId,
              childProposalId,
              relationType: proposal.relationType,
              confidence: proposal.confidence,
            },
          });
        }

        reportStage('job_finalization');
        const tableCount = input.pages.reduce((sum, page) => sum + page.tables.length, 0);
        return mapJob(
          await transaction.documentAnalysisJob.update({
            where: { id: jobId },
            data: {
              extractionProvider: input.provider,
              extractionVersion: input.extractionVersion,
              extractionMethod: input.extractionMethod,
              providerMetadata: prismaJson(input.metadata),
              pageCount: input.pages.length,
              tableCount,
              proposalCount: input.proposals.length,
              status: input.proposals.length > 0 ? 'PROPOSALS_READY' : 'TEXT_EXTRACTED',
              completedAt: new Date(),
              failureReason: null,
            },
            include: jobInclude,
          }),
        );
      }, analysisPersistenceTransactionOptions);
    } catch (error) {
      throw new AnalysisPipelineError(stage, error);
    }
  }

  async clearJobForRetry(jobId: string) {
    return database.$transaction(async (transaction) => {
      await transaction.extractionProposal.deleteMany({ where: { jobId } });
      await transaction.documentPage.deleteMany({ where: { jobId } });
      return mapJob(
        await transaction.documentAnalysisJob.update({
          where: { id: jobId },
          data: {
            status: 'QUEUED',
            startedAt: null,
            completedAt: null,
            failureReason: null,
            providerMetadata: Prisma.JsonNull,
            pageCount: 0,
            tableCount: 0,
            proposalCount: 0,
          },
          include: jobInclude,
        }),
      );
    });
  }

  async listPages(jobId: string) {
    const pages = await database.documentPage.findMany({
      where: { jobId },
      include: { extractedText: true },
      orderBy: { pageNumber: 'asc' },
    });
    return pages.map((page): AnalysisPageRecord => ({
      id: page.id,
      jobId: page.jobId,
      documentId: page.documentId,
      pageNumber: page.pageNumber,
      hasEmbeddedText: page.hasEmbeddedText,
      textLength: page.textLength,
      extractionQuality: numeric(page.extractionQuality),
      width: numeric(page.width),
      height: numeric(page.height),
      rawText: page.extractedText?.rawText ?? undefined,
      text: page.extractedText?.normalizedText ?? '',
    }));
  }

  async listTables(jobId: string) {
    const tables = await database.documentExtractedTable.findMany({
      where: { jobId },
      include: { page: { select: { pageNumber: true } }, cells: true },
      orderBy: [{ page: { pageNumber: 'asc' } }, { tableIndex: 'asc' }],
    });
    return tables.map((table): AnalysisTableRecord => {
      const rows = Array.from({ length: table.rowCount }, () =>
        Array.from({ length: table.columnCount }, () => ''),
      );
      for (const cell of table.cells) {
        if (rows[cell.rowIndex]) rows[cell.rowIndex]![cell.columnIndex] = cell.text;
      }
      return {
        id: table.id,
        jobId: table.jobId,
        pageId: table.pageId,
        pageNumber: table.page.pageNumber,
        tableIndex: table.tableIndex,
        title: table.title,
        sourceSection: table.sourceSection,
        rowCount: table.rowCount,
        columnCount: table.columnCount,
        extractionMethod: table.extractionMethod,
        confidence: numeric(table.confidence),
        rows,
      };
    });
  }

  async listProposals(jobId: string, query: ProposalListQuery) {
    const where: Prisma.ExtractionProposalWhereInput = {
      jobId,
      deletedAt: null,
      ...(query.decision ? { decision: query.decision } : {}),
      ...(query.proposalType ? { proposalType: query.proposalType } : {}),
      ...(query.pageNumber ? { sourcePage: query.pageNumber } : {}),
      ...(query.minimumConfidence !== undefined
        ? { confidence: { gte: query.minimumConfidence } }
        : {}),
    };
    const [items, total] = await database.$transaction([
      database.extractionProposal.findMany({
        where,
        include: proposalInclude,
        orderBy: [{ proposalType: 'asc' }, { sourcePage: 'asc' }, { confidence: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      database.extractionProposal.count({ where }),
    ]);
    return {
      items: items.map(mapProposal),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getProposal(id: string) {
    const proposal = await database.extractionProposal.findFirst({
      where: { id, deletedAt: null },
      include: proposalInclude,
    });
    return proposal ? mapProposal(proposal) : null;
  }

  async updateProposal(id: string, input: Parameters<AnalysisStore['updateProposal']>[1]) {
    return mapProposal(
      await database.extractionProposal.update({
        where: { id },
        data: {
          title: input.title,
          importTargetType: input.importTargetType,
          editedData: input.editedData === undefined ? undefined : prismaJson(input.editedData),
        },
        include: proposalInclude,
      }),
    );
  }

  async reviewProposal(
    id: string,
    decision: Parameters<AnalysisStore['reviewProposal']>[1],
    reviewerId: string,
    comment?: string,
    editedData?: Record<string, unknown>,
  ) {
    return database.$transaction(async (transaction) => {
      const before = await transaction.extractionProposal.findUniqueOrThrow({ where: { id } });
      const finalDecision = editedData && decision === 'APPROVED' ? 'EDITED' : decision;
      const proposal = await transaction.extractionProposal.update({
        where: { id },
        data: {
          decision: finalDecision,
          editedData: editedData ? prismaJson(editedData) : undefined,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
        },
        include: proposalInclude,
      });
      await transaction.extractionReview.create({
        data: {
          proposalId: id,
          reviewerId,
          decision: finalDecision,
          comment,
          beforeData: prismaJson({
            decision: before.decision,
            editedData: before.editedData,
          }),
          afterData: prismaJson({
            decision: finalDecision,
            editedData: editedData ?? before.editedData,
          }),
        },
      });
      return mapProposal(proposal);
    });
  }

  async reviewProposals(
    ids: string[],
    decision: Parameters<AnalysisStore['reviewProposals']>[1],
    reviewerId: string,
    comment?: string,
  ) {
    return database.$transaction(async (transaction) => {
      const results: ProposalRecord[] = [];
      for (const id of ids) {
        const before = await transaction.extractionProposal.findFirstOrThrow({
          where: { id, deletedAt: null },
        });
        const updated = await transaction.extractionProposal.update({
          where: { id },
          data: { decision, reviewedById: reviewerId, reviewedAt: new Date() },
          include: proposalInclude,
        });
        await transaction.extractionReview.create({
          data: {
            proposalId: id,
            reviewerId,
            decision,
            comment,
            beforeData: prismaJson({ decision: before.decision }),
            afterData: prismaJson({ decision }),
          },
        });
        results.push(mapProposal(updated));
      }
      return results;
    });
  }

  async refreshJobReviewStatus(jobId: string) {
    const [pending, approved, rejected] = await database.$transaction([
      database.extractionProposal.count({ where: { jobId, decision: 'PENDING', deletedAt: null } }),
      database.extractionProposal.count({
        where: { jobId, decision: { in: ['APPROVED', 'EDITED'] }, deletedAt: null },
      }),
      database.extractionProposal.count({
        where: { jobId, decision: 'REJECTED', deletedAt: null },
      }),
    ]);
    const status =
      pending === 0 && approved > 0
        ? 'APPROVED'
        : approved > 0 || rejected > 0
          ? 'PARTIALLY_APPROVED'
          : 'UNDER_REVIEW';
    return this.updateJob(jobId, { status });
  }

  async detectConflicts(jobId: string) {
    const proposals = await database.extractionProposal.findMany({
      where: { jobId, decision: { in: ['APPROVED', 'EDITED'] }, deletedAt: null },
      include: importRelationInclude,
    });
    return Promise.all(
      proposals.map(async (proposal) => {
        const data = await hydrateRelationData(database, proposal, new Map(), true);
        return conflictForProposal(database, {
          ...proposal,
          proposedData: data,
          editedData: null,
        });
      }),
    );
  }

  async importApproved(
    jobId: string,
    idempotencyKey: string,
    decisions: ImportDecision[],
    importedById: string,
  ) {
    const existing = await database.extractionImportBatch.findUnique({
      where: { idempotencyKey },
      include: { items: true },
    });
    if (existing) return existing as unknown as ImportBatchRecord;
    const batch = await database.extractionImportBatch.create({
      data: {
        jobId,
        idempotencyKey,
        importedById,
        status: 'PREVIEW',
      },
    });
    try {
      return await runAtomicImport(database, async (transaction) => {
        await transaction.documentAnalysisJob.update({
          where: { id: jobId },
          data: { status: 'IMPORTING' },
        });
        await transaction.extractionImportBatch.update({
          where: { id: batch.id },
          data: { status: 'IMPORTING', startedAt: new Date() },
        });
        const proposals = await transaction.extractionProposal.findMany({
          where: { jobId, decision: { in: ['APPROVED', 'EDITED'] }, deletedAt: null },
          include: importRelationInclude,
        });
        proposals.sort(
          (left, right) =>
            (importPriority[left.importTargetType] ?? 100) -
            (importPriority[right.importTargetType] ?? 100),
        );
        const requested = new Map(decisions.map((decision) => [decision.proposalId, decision]));
        const importedByProposal = new Map<string, string>();
        let imported = 0;
        let skipped = 0;
        const importedTargets: Array<{ proposalId: string; targetType: string; targetId: string }> =
          [];
        for (const proposal of proposals) {
          const data = await hydrateRelationData(transaction, proposal, importedByProposal, false);
          const conflict = await conflictForProposal(transaction, {
            ...proposal,
            proposedData: data,
            editedData: null,
          });
          const choice = requested.get(proposal.id);
          const action =
            choice && conflict.allowedActions.includes(choice.action)
              ? choice.action
              : conflict.defaultAction;
          if (action === 'skip') {
            if (conflict.existingRecordId) {
              importedByProposal.set(proposal.id, conflict.existingRecordId);
            }
            await transaction.extractionImportItem.create({
              data: {
                batchId: batch.id,
                proposalId: proposal.id,
                targetType: proposal.importTargetType,
                requestedAction: choice?.action ?? 'skip',
                appliedAction: 'skip',
                status: 'SKIPPED',
                conflict: prismaJson(conflict),
              },
            });
            skipped += 1;
            continue;
          }
          const target = await applyImport(
            transaction,
            proposal.importTargetType,
            data,
            importedById,
            action,
            conflict.existingRecordId,
            choice?.selectedFields,
          );
          const importItem = await transaction.extractionImportItem.create({
            data: {
              batchId: batch.id,
              proposalId: proposal.id,
              targetType: proposal.importTargetType,
              targetRecordId: target.id,
              requestedAction: choice?.action ?? action,
              appliedAction: action,
              status: 'IMPORTED',
              conflict: conflict.status === 'conflict' ? prismaJson(conflict) : undefined,
            },
          });
          await transaction.sourceEvidenceReference.create({
            data: {
              sourceDocumentId: proposal.documentId,
              sourceDocumentVersionId: proposal.documentVersionId,
              sourceProposalId: proposal.id,
              importItemId: importItem.id,
              targetType: proposal.importTargetType,
              targetRecordId: target.id,
              sourcePage: proposal.sourcePage,
              sourceSection: proposal.sourceSection,
              sourceEvidence: proposal.evidenceSnippet,
              extractionMethod: proposal.extractionMethod,
              importedById,
            },
          });
          importedTargets.push({
            proposalId: proposal.id,
            targetType: proposal.importTargetType,
            targetId: target.id,
          });
          importedByProposal.set(proposal.id, target.id);
          imported += 1;
        }
        const summary = { total: proposals.length, imported, skipped, importedTargets };
        await transaction.documentAnalysisJob.update({
          where: { id: jobId },
          data: { status: 'IMPORTED' },
        });
        const completed = await transaction.extractionImportBatch.update({
          where: { id: batch.id },
          data: {
            status: 'IMPORTED',
            summary: prismaJson(summary),
            completedAt: new Date(),
          },
          include: { items: true },
        });
        return completed as unknown as ImportBatchRecord;
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 1000) : 'Import failed.';
      await database.extractionImportBatch.update({
        where: { id: batch.id },
        data: { status: 'FAILED', failureReason: reason, completedAt: new Date() },
      });
      await database.documentAnalysisJob.update({
        where: { id: jobId },
        data: { status: 'APPROVED' },
      });
      throw error;
    }
  }

  async getImportBatch(id: string) {
    const batch = await database.extractionImportBatch.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            proposal: {
              select: {
                id: true,
                title: true,
                proposalType: true,
                sourcePage: true,
              },
            },
            sourceReference: true,
          },
        },
      },
    });
    return batch as unknown as ImportBatchRecord | null;
  }

  async listSourceReferences(targetType: ImportTargetType, targetRecordId: string) {
    const references = await database.sourceEvidenceReference.findMany({
      where: { targetType, targetRecordId },
      include: {
        sourceDocument: {
          select: { id: true, title: true, confidentialityLevel: true },
        },
      },
      orderBy: { importedAt: 'desc' },
    });
    return references.map((reference): SourceEvidenceRecord => ({
      id: reference.id,
      sourceDocumentId: reference.sourceDocumentId,
      sourceDocumentVersionId: reference.sourceDocumentVersionId,
      sourceProposalId: reference.sourceProposalId,
      targetType: reference.targetType,
      targetRecordId: reference.targetRecordId,
      sourcePage: reference.sourcePage,
      sourceSection: reference.sourceSection,
      sourceEvidence: reference.sourceEvidence,
      extractionMethod: reference.extractionMethod,
      importedAt: reference.importedAt,
      importedById: reference.importedById,
      document: reference.sourceDocument,
    }));
  }

  async summary() {
    const [
      analyzed,
      awaitingReview,
      awaitingApproval,
      imported,
      failed,
      ocrRequired,
      budgetRecords,
      budgetLines,
      budgetTotal,
    ] = await database.$transaction([
      database.documentAnalysisJob.count({
        where: {
          deletedAt: null,
          status: {
            in: [
              'TEXT_EXTRACTED',
              'PROPOSALS_READY',
              'UNDER_REVIEW',
              'PARTIALLY_APPROVED',
              'APPROVED',
              'IMPORTING',
              'IMPORTED',
            ],
          },
        },
      }),
      database.documentAnalysisJob.count({
        where: { deletedAt: null, status: { in: ['PROPOSALS_READY', 'UNDER_REVIEW'] } },
      }),
      database.extractionProposal.count({
        where: { deletedAt: null, decision: 'PENDING' },
      }),
      database.sourceEvidenceReference.count(),
      database.documentAnalysisJob.count({ where: { deletedAt: null, status: 'FAILED' } }),
      database.documentAnalysisJob.count({
        where: { deletedAt: null, status: 'OCR_REQUIRED' },
      }),
      database.budgetRecord.count({ where: { deletedAt: null } }),
      database.budgetLine.count({ where: { deletedAt: null } }),
      database.budgetRecord.aggregate({
        where: { deletedAt: null },
        _sum: { totalPlanned: true },
      }),
    ]);
    return {
      analyzed,
      awaitingReview,
      awaitingApproval,
      imported,
      failed,
      ocrRequired,
      budget: {
        records: budgetRecords,
        lines: budgetLines,
        totalPlanned: Number(budgetTotal._sum.totalPlanned ?? 0),
      },
    };
  }

  async createAudit(input: AnalysisAuditInput) {
    await database.documentAnalysisAuditLog.create({
      data: {
        ...input,
        metadata: optionalPrismaJson(input.metadata),
      },
    });
  }

  async listAudit(jobId: string, page: number, pageSize: number) {
    const [items, total] = await database.$transaction([
      database.documentAnalysisAuditLog.findMany({
        where: { jobId },
        include: { user: { select: { id: true, fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      database.documentAnalysisAuditLog.count({ where: { jobId } }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        metadata: item.metadata ? jsonObject(item.metadata) : null,
      })),
      total,
    };
  }
}
