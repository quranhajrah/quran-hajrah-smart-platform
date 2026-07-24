import type {
  ExecutiveHealth,
  HealthInputs,
  HealthWeights,
  InitiativeStatus,
  KpiStatus,
  RiskImpact,
  RiskLikelihood,
} from './types.js';

const clamp = (value: number, minimum = 0, maximum = 100) =>
  Math.min(maximum, Math.max(minimum, value));

export const calculateKpiStatus = (
  current: number | null,
  target: number,
  baseline: number | null,
): KpiStatus => {
  if (current === null) return 'NOT_STARTED';
  if (current === target) return 'COMPLETED';
  const start = baseline ?? 0;
  const range = target - start;
  if (range === 0) return current >= target ? 'COMPLETED' : 'OFF_TRACK';
  const progress = ((current - start) / range) * 100;
  if (progress >= 100) return 'COMPLETED';
  if (progress >= 80) return 'ON_TRACK';
  if (progress >= 60) return 'AT_RISK';
  return 'OFF_TRACK';
};

export const calculateInitiativeProgress = (
  milestones: Array<{ progress: number; status?: KpiStatus }>,
  fallback = 0,
) =>
  milestones.length === 0
    ? clamp(fallback)
    : Math.round(
        (milestones.reduce((total, milestone) => total + clamp(milestone.progress), 0) /
          milestones.length) *
          100,
      ) / 100;

export const calculateInitiativeStatus = (
  progress: number,
  endDate: Date,
  now = new Date(),
): InitiativeStatus => {
  if (progress >= 100) return 'COMPLETED';
  if (endDate.getTime() < now.getTime()) return 'DELAYED';
  const remainingDays = (endDate.getTime() - now.getTime()) / 86_400_000;
  if (remainingDays <= 30 && progress < 75) return 'AT_RISK';
  return progress > 0 ? 'ACTIVE' : 'PLANNED';
};

export const calculateBudgetVariance = (budget: number, actualSpending: number) => ({
  amount: Math.round((budget - actualSpending) * 100) / 100,
  percentage: budget === 0 ? null : Math.round(((budget - actualSpending) / budget) * 10_000) / 100,
  overBudget: actualSpending > budget,
});

export const calculateMetricAssessment = (
  current: number | null,
  target: number | null,
  warning: number | null,
  critical: number | null,
  higherIsBetter = true,
) => {
  if (current === null) return { status: 'missing', variance: null };
  const variance = target === null ? null : Math.round((current - target) * 10_000) / 10_000;
  const meets = (threshold: number) =>
    higherIsBetter ? current >= threshold : current <= threshold;
  if (target !== null && meets(target)) return { status: 'on_target', variance };
  if (critical !== null && !meets(critical)) return { status: 'critical', variance };
  if (warning !== null && !meets(warning)) return { status: 'warning', variance };
  return { status: target === null ? 'measured' : 'below_target', variance };
};

const likelihoodValue: Record<RiskLikelihood, number> = {
  RARE: 1,
  UNLIKELY: 2,
  POSSIBLE: 3,
  LIKELY: 4,
  ALMOST_CERTAIN: 5,
};
const impactValue: Record<RiskImpact, number> = {
  INSIGNIFICANT: 1,
  MINOR: 2,
  MODERATE: 3,
  MAJOR: 4,
  SEVERE: 5,
};

export const calculateRiskScore = (likelihood: RiskLikelihood, impact: RiskImpact) =>
  likelihoodValue[likelihood] * impactValue[impact];

export const riskHeatBand = (score: number) => {
  if (score >= 20) return 'critical';
  if (score >= 12) return 'high';
  if (score >= 6) return 'medium';
  return 'low';
};

export const financialHealthScore = (executionRate: number | null) =>
  executionRate === null ? null : clamp(100 - Math.abs(100 - executionRate));

export const riskHealthScore = (averageResidualScore: number | null) =>
  averageResidualScore === null
    ? null
    : Math.round(clamp(100 - ((clamp(averageResidualScore, 1, 25) - 1) / 24) * 100) * 100) / 100;

const componentLabels: Record<keyof HealthInputs, string> = {
  governance: 'الحوكمة',
  strategic: 'التنفيذ الاستراتيجي',
  operational: 'التنفيذ التشغيلي',
  financial: 'الصحة المالية',
  risk: 'صحة المخاطر',
  knowledge: 'امتثال المعرفة والوثائق',
};

export const healthRating = (score: number | null) => {
  if (score === null) return null;
  if (score >= 90) return 'ممتاز';
  if (score >= 80) return 'جيد جدًا';
  if (score >= 70) return 'جيد';
  if (score >= 60) return 'يحتاج تحسين';
  return 'حرج';
};

export const validateHealthWeights = (weights: HealthWeights) => {
  const values = Object.values(weights);
  return (
    values.every((weight) => Number.isFinite(weight) && weight >= 0 && weight <= 100) &&
    Math.abs(values.reduce((total, weight) => total + weight, 0) - 100) < 0.001
  );
};

export const calculateExecutiveHealth = (
  inputs: HealthInputs,
  weights: HealthWeights,
): ExecutiveHealth => {
  if (!validateHealthWeights(weights)) {
    throw new Error('Executive health weights must be between 0 and 100 and total 100.');
  }
  const components = (Object.keys(weights) as Array<keyof HealthInputs>).map((key) => {
    const rawScore = inputs[key];
    const score = rawScore === null ? null : Math.round(clamp(rawScore) * 100) / 100;
    return {
      key,
      label: componentLabels[key],
      weight: weights[key],
      score,
      contribution: score === null ? null : Math.round(score * weights[key]) / 100,
      missing: score === null,
      explanation:
        score === null
          ? `لا توجد بيانات معتمدة لمكوّن ${componentLabels[key]}.`
          : `${componentLabels[key]}: ${score} من 100 بوزن ${weights[key]}%.`,
    };
  });
  const availableWeight = components.reduce(
    (total, component) => total + (component.missing ? 0 : component.weight),
    0,
  );
  const weightedTotal = components.reduce(
    (total, component) => total + (component.contribution ?? 0),
    0,
  );
  const score =
    availableWeight === 0 ? null : Math.round((weightedTotal / availableWeight) * 10_000) / 100;
  const coverage = Math.round(availableWeight * 100) / 100;
  const missingData = components
    .filter((component) => component.missing)
    .map((component) => component.label);
  const explanation =
    score === null
      ? 'لا يمكن احتساب الدرجة لعدم توفر أي مكوّن معتمد.'
      : `احتُسبت الدرجة من المكونات المتاحة بتغطية ${coverage}%، دون افتراض قيم للمكونات المفقودة.`;
  return {
    score,
    coverage,
    rating: healthRating(score),
    components,
    missingData,
    explanation,
  };
};
