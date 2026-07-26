import type { AnalysisProposal } from './api';

const groupOrder = [
  'الفئات المستهدفة',
  'الأهداف التشغيلية',
  'مؤشرات الأداء',
  'المبادرات والأنشطة',
  'المسؤوليات',
  'التواريخ',
  'الموازنة',
  'المخاطر',
  'بيانات أخرى',
] as const;

export const proposalGroupLabel = (proposalType: string) => {
  if (proposalType === 'BENEFICIARY_GROUP') return 'الفئات المستهدفة';
  if (proposalType === 'STRATEGIC_OBJECTIVE') return 'الأهداف التشغيلية';
  if (proposalType === 'KPI' || proposalType === 'METRIC') return 'مؤشرات الأداء';
  if (proposalType === 'INITIATIVE' || proposalType === 'MILESTONE') {
    return 'المبادرات والأنشطة';
  }
  if (proposalType === 'RESPONSIBLE_DEPARTMENT') return 'المسؤوليات';
  if (proposalType === 'DOCUMENT_DATE' || proposalType === 'REPORTING_PERIOD') {
    return 'التواريخ';
  }
  if (['BUDGET', 'BUDGET_LINE', 'FINANCIAL_VALUE'].includes(proposalType)) {
    return 'الموازنة';
  }
  if (proposalType === 'RISK' || proposalType === 'RISK_TREATMENT') return 'المخاطر';
  return 'بيانات أخرى';
};

export const groupAnalysisProposals = (proposals: AnalysisProposal[]) =>
  groupOrder
    .map((label) => ({
      label,
      items: proposals.filter((proposal) => proposalGroupLabel(proposal.proposalType) === label),
    }))
    .filter((group) => group.items.length > 0);

export const buildExtractionSummary = (
  proposals: AnalysisProposal[],
  pageCount: number,
  tableCount: number,
) => {
  const count = (...types: string[]) =>
    proposals.filter((proposal) => types.includes(proposal.proposalType)).length;
  const budget = proposals.find((proposal) => proposal.proposalType === 'BUDGET');
  const budgetData = budget?.editedData ?? budget?.proposedData;
  const budgetTotal = Number(budgetData?.totalPlanned ?? budgetData?.totalPlannedAmount);
  return {
    pageCount,
    tableCount,
    objectives: count('STRATEGIC_OBJECTIVE'),
    kpis: count('KPI'),
    initiatives: count('INITIATIVE', 'MILESTONE'),
    beneficiaries: count('BENEFICIARY_GROUP'),
    budgetLines: count('BUDGET_LINE'),
    budgetTotal: Number.isFinite(budgetTotal) ? budgetTotal : null,
    lowConfidence: proposals.filter(
      (proposal) =>
        proposal.confidence < 0.8 ||
        (proposal.editedData ?? proposal.proposedData).qualityState === 'NEEDS_REVIEW',
    ).length,
  };
};
