import type { IdentityUser, RequestMeta } from '../identity/types.js';

export const metricDataTypes = ['NUMBER', 'PERCENTAGE', 'CURRENCY', 'TEXT'] as const;
export const metricFrequencies = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
  'ON_DEMAND',
] as const;
export const kpiStatuses = [
  'NOT_STARTED',
  'ON_TRACK',
  'AT_RISK',
  'OFF_TRACK',
  'COMPLETED',
] as const;
export const initiativeStatuses = [
  'PLANNED',
  'ACTIVE',
  'AT_RISK',
  'DELAYED',
  'COMPLETED',
  'CANCELLED',
  'ON_HOLD',
] as const;
export const riskLikelihoods = [
  'RARE',
  'UNLIKELY',
  'POSSIBLE',
  'LIKELY',
  'ALMOST_CERTAIN',
] as const;
export const riskImpacts = ['INSIGNIFICANT', 'MINOR', 'MODERATE', 'MAJOR', 'SEVERE'] as const;
export const riskStatuses = ['OPEN', 'UNDER_TREATMENT', 'ACCEPTED', 'CLOSED'] as const;
export const alertSeverities = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const alertStatuses = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED'] as const;
export const reportStatuses = ['DRAFT', 'GENERATED', 'APPROVED', 'ARCHIVED'] as const;
export const reportTypes = [
  'BOARD',
  'MONTHLY_PERFORMANCE',
  'QUARTERLY_PERFORMANCE',
  'OPERATIONAL_PLAN',
  'RISKS',
  'GOVERNANCE',
  'KNOWLEDGE_CENTER',
  'COMPREHENSIVE',
] as const;

export type MetricDataType = (typeof metricDataTypes)[number];
export type MetricFrequency = (typeof metricFrequencies)[number];
export type KpiStatus = (typeof kpiStatuses)[number];
export type InitiativeStatus = (typeof initiativeStatuses)[number];
export type RiskLikelihood = (typeof riskLikelihoods)[number];
export type RiskImpact = (typeof riskImpacts)[number];
export type AlertStatus = (typeof alertStatuses)[number];
export type ExecutiveReportStatus = (typeof reportStatuses)[number];
export type ExecutiveEntity =
  'metrics' | 'objectives' | 'kpis' | 'initiatives' | 'risks' | 'reports';

export type PageQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  department?: string;
  objectiveId?: string;
};

export type PageResult<T = Record<string, unknown>> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type MetricSummary = {
  id: string;
  key: string;
  nameAr: string;
  unit?: string | null;
  dataType: MetricDataType;
  targetValue?: number | null;
  warningThreshold?: number | null;
  criticalThreshold?: number | null;
  currentNumericValue?: number | null;
  currentTextValue?: string | null;
  currentMeasuredAt?: Date | null;
};

export type ExecutiveDashboardBase = {
  activeUsers: number;
  recentActivity: Array<Record<string, unknown>>;
  metrics: MetricSummary[];
  objectives: { total: number; averageProgress: number | null };
  kpis: Record<string, number>;
  initiatives: {
    total: number;
    active: number;
    delayed: number;
    atRisk: number;
    completed: number;
    plannedBudget: number;
    actualSpending: number;
  };
  risks: { open: number; critical: number; averageResidualScore: number | null };
  alerts: Array<Record<string, unknown>>;
  upcomingDeadlines: Array<Record<string, unknown>>;
};

export type HealthWeights = {
  governance: number;
  strategic: number;
  operational: number;
  financial: number;
  risk: number;
  knowledge: number;
};

export type HealthInputs = {
  governance: number | null;
  strategic: number | null;
  operational: number | null;
  financial: number | null;
  risk: number | null;
  knowledge: number | null;
};

export type HealthComponent = {
  key: keyof HealthInputs;
  label: string;
  weight: number;
  score: number | null;
  contribution: number | null;
  missing: boolean;
  explanation: string;
};

export type ExecutiveHealth = {
  score: number | null;
  coverage: number;
  rating: string | null;
  components: HealthComponent[];
  missingData: string[];
  explanation: string;
};

export type AlertCandidate = {
  fingerprint: string;
  severity: (typeof alertSeverities)[number];
  title: string;
  description: string;
  sourceModule: string;
  sourceRecordId?: string;
  dueDate?: Date;
};

export type ExecutiveSourceReference = {
  module: string;
  recordId?: string;
  label: string;
  route?: string;
};

export type ExecutiveSuggestedAction = {
  label: string;
  route: string;
  permission?: string;
};

export type ExecutiveQuery = {
  text: string;
};

export type ExecutiveResponse = {
  mode: 'structured-data';
  title: string;
  summary: string;
  data: unknown;
  missingData: string[];
  sources: ExecutiveSourceReference[];
  suggestedActions: ExecutiveSuggestedAction[];
};

export interface ExecutiveAssistantService {
  query(input: ExecutiveQuery, user: IdentityUser): Promise<ExecutiveResponse>;
}

export type ExecutiveMutationContext = RequestMeta & {
  user: IdentityUser;
};
