import { createHash } from 'node:crypto';
import type { DocumentType } from '../documents/types.js';
import { normalizeInstitutionalText } from './providers.js';
import {
  applyProposalQualityGates,
  extractOperationalSemanticProposals,
  extractStrategicSemanticProposals,
} from './semantic.js';
import type {
  ExtractedPageData,
  ExtractedTableData,
  ExtractionProposalCandidate,
  ExtractionProposalType,
  ImportTargetType,
  InstitutionalExtractionInput,
  ProposalFieldCandidate,
  SpecializedInstitutionalExtractor,
} from './types.js';

export const institutionalRuleIds = [
  'section.objective.v1',
  'section.kpi.v1',
  'section.strategic_axis.v1',
  'section.initiative.v1',
  'section.milestone.v1',
  'field.responsible_department.v1',
  'field.date.v1',
  'field.beneficiary_group.v1',
  'amount.budget_total.v1',
  'table.budget_line.v1',
  'section.risk.v1',
  'section.risk_treatment.v1',
  'score.governance.v1',
  'amount.financial.v1',
  'section.policy_requirement.v1',
  'period.reporting.v1',
  'semantic.operational_objective.v2',
  'semantic.kpi.v2',
  'semantic.initiative.v2',
  'semantic.responsibility.v2',
  'semantic.date.v2',
  'semantic.beneficiary.v2',
  'semantic.table_row.v2',
  'semantic.budget_total.v2',
  'semantic.budget_line.v2',
] as const;

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
const easternDigits = '۰۱۲۳۴۵۶۷۸۹';

export const parseInstitutionalNumber = (raw: string) => {
  const normalized = [...raw]
    .map((character) => {
      const arabicIndex = arabicDigits.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);
      const easternIndex = easternDigits.indexOf(character);
      return easternIndex >= 0 ? String(easternIndex) : character;
    })
    .join('')
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.')
    .replace(/[^\d.-]/g, '');
  if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const snippet = (value: string) => normalizeInstitutionalText(value).slice(0, 500);
const field = (
  key: string,
  labelAr: string,
  dataType: ProposalFieldCandidate['dataType'],
  value: ProposalFieldCandidate['value'],
  sourceValue?: string,
  confidence?: number,
): ProposalFieldCandidate => ({
  key,
  labelAr,
  dataType,
  value,
  ...(sourceValue ? { sourceValue } : {}),
  ...(confidence !== undefined ? { confidence } : {}),
});

const candidate = (input: {
  proposalType: ExtractionProposalType;
  title: string;
  importTargetType?: ImportTargetType;
  rule: string;
  confidence: number;
  page?: number;
  section?: string;
  evidence: string;
  fields: ProposalFieldCandidate[];
}): ExtractionProposalCandidate => ({
  proposalType: input.proposalType,
  title: input.title,
  proposedData: Object.fromEntries(input.fields.map((item) => [item.key, item.value])),
  importTargetType: input.importTargetType ?? 'NONE',
  extractionRuleId: input.rule,
  extractionMethod: 'deterministic-rules-v1',
  confidence: input.confidence,
  ...(input.page ? { sourcePage: input.page } : {}),
  ...(input.section ? { sourceSection: input.section } : {}),
  evidenceSnippet: snippet(input.evidence),
  fields: input.fields,
});

const headingPattern =
  /^(?:الفصل|الباب|المحور|القسم|الهدف|الأهداف|المؤشر|الموازنة|المخاطر|الحوكمة|التقرير المالي|السياسة|اللائحة)\b/u;

const pageLines = (page: ExtractedPageData) => {
  let section = '';
  return page.text
    .split('\n')
    .map((line) => normalizeInstitutionalText(line))
    .filter(Boolean)
    .map((line) => {
      if (line.length <= 140 && headingPattern.test(line)) section = line;
      return { line, section };
    });
};

const objectivePatterns = [
  /^(?:(?<code>[\d٠-٩]+(?:[.-][\d٠-٩]+)*)\s*[-.)]?\s*)?(?:الهدف العام|الهدف الاستراتيجي|الهدف التشغيلي|الهدف الفرعي|الأهداف الفرعية)\s*[:：-]?\s*(?<title>.+)$/u,
  /^(?<code>[\d٠-٩]+(?:[.-][\d٠-٩]+)+)\s*[-–—]\s*(?<title>.{4,})$/u,
];
const kpiPattern =
  /^(?:(?<code>[\d٠-٩]+(?:[.-][\d٠-٩]+)*)\s*[-.)]?\s*)?(?:المؤشر|مؤشر الأداء|مؤشرات الإنجاز)\s*[:：-]?\s*(?<title>.+)$/u;
const strategicAxisPattern =
  /^(?:(?<code>[\d٠-٩]+(?:[.-][\d٠-٩]+)*)\s*[-.)]?\s*)?(?:المحور|المحور الاستراتيجي)\s*[:：-]?\s*(?<title>.+)$/u;
const initiativePattern =
  /^(?:(?<code>[\d٠-٩]+(?:[.-][\d٠-٩]+)*)\s*[-.)]?\s*)?(?:المبادرة|النشاط|البرنامج التنفيذي)\s*[:：-]?\s*(?<title>.+)$/u;
const milestonePattern =
  /^(?:(?<code>[\d٠-٩]+(?:[.-][\d٠-٩]+)*)\s*[-.)]?\s*)?(?:المرحلة الرئيسية|المعلم|المخرج)\s*[:：-]?\s*(?<title>.+)$/u;
const responsiblePattern =
  /(?:المسؤول عن التنفيذ|الجهة المسؤولة|الإدارة المسؤولة|مسؤول التنفيذ)\s*[:：-]\s*(?<value>.+)$/u;
const beneficiaryPattern =
  /(?:الفئة المستهدفة|المستفيدون|المستفيدين)\s*[:：-]\s*(?<value>.+?)(?:\s+(?:العدد)\s*[:：-]?\s*(?<count>[\d٠-٩۰-۹٬,.]+))?$/u;
const datePattern =
  /(?<label>تاريخ البدء|تاريخ الانتهاء|تاريخ الإصدار|تاريخ الوثيقة|فترة التقرير)\s*[:：-]\s*(?<value>[\d٠-٩۰-۹]{1,4}[/-][\d٠-٩۰-۹]{1,2}[/-][\d٠-٩۰-۹]{1,4}(?:\s*(?:هـ|م))?)/gu;
const budgetTotalPattern =
  /(?:إجمالي الموازنة|إجمالي الميزانية|الموازنة المقترحة|إجمالي التكلفة)\s*[:：-]?\s*(?<amount>[\d٠-٩۰-۹٬,.]+)\s*(?<currency>ر\.?\s*س|ريال(?:اً|ا)?|SAR)?/u;
const riskPattern =
  /^(?:(?<code>[\d٠-٩]+(?:[.-][\d٠-٩]+)*)\s*[-.)]?\s*)?(?:الخطر|المخاطر)\s*[:：-]?\s*(?<title>.+)$/u;
const treatmentPattern = /(?:خطة المعالجة|إجراء المعالجة)\s*[:：-]\s*(?<value>.+)$/u;
const governancePattern =
  /(?:درجة الحوكمة|نسبة الحوكمة|مؤشر الحوكمة)\s*[:：-]?\s*(?<value>[\d٠-٩۰-۹٬,.]+)\s*%?/u;
const financialPattern =
  /(?<kind>الإيرادات|المصروفات|الفائض|العجز)\s*[:：-]?\s*(?<value>[\d٠-٩۰-۹٬,.-]+)\s*(?<currency>ر\.?\s*س|ريال(?:اً|ا)?|SAR)?/u;
const policyPattern =
  /^(?:يجب|يلتزم|تلتزم|يتعين|يحظر|لا يجوز|تختص|تكون مسؤولية)\s+(?<value>.{8,})$/u;
const reportingPeriodPattern =
  /(?:الفترة المالية|فترة التقرير|السنة المالية)\s*[:：-]\s*(?<value>.+)$/u;

const extractLineCandidates = (
  pages: ExtractedPageData[],
  allowed: Set<ExtractionProposalType>,
) => {
  const proposals: ExtractionProposalCandidate[] = [];
  for (const page of pages) {
    for (const { line, section } of pageLines(page)) {
      if (allowed.has('STRATEGIC_OBJECTIVE')) {
        const match = objectivePatterns.map((pattern) => pattern.exec(line)).find(Boolean);
        const title = match?.groups?.title?.trim();
        if (title) {
          const code = match?.groups?.code?.trim();
          const fields = [
            ...(code ? [field('code', 'الرمز', 'string', code, code, 0.9)] : []),
            field('title', 'الهدف', 'string', title, title, 0.92),
            ...(section
              ? [field('strategicAxis', 'المحور الاستراتيجي', 'string', section, section)]
              : []),
          ];
          proposals.push(
            candidate({
              proposalType: 'STRATEGIC_OBJECTIVE',
              title,
              importTargetType: 'STRATEGIC_OBJECTIVE',
              rule: 'section.objective.v1',
              confidence: code ? 0.9 : 0.82,
              page: page.pageNumber,
              section,
              evidence: line,
              fields,
            }),
          );
        }
      }
      if (allowed.has('KPI')) {
        const match = kpiPattern.exec(line);
        const title = match?.groups?.title?.trim();
        if (title) {
          const code = match?.groups?.code?.trim();
          proposals.push(
            candidate({
              proposalType: 'KPI',
              title,
              importTargetType: 'KPI',
              rule: 'section.kpi.v1',
              confidence: code ? 0.9 : 0.84,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [
                ...(code ? [field('code', 'رمز المؤشر', 'string', code, code)] : []),
                field('title', 'المؤشر', 'string', title, title),
              ],
            }),
          );
        }
      }
      if (allowed.has('OTHER')) {
        const match = strategicAxisPattern.exec(line);
        const title = match?.groups?.title?.trim();
        if (title) {
          proposals.push(
            candidate({
              proposalType: 'OTHER',
              title,
              rule: 'section.strategic_axis.v1',
              confidence: 0.9,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [
                ...(match?.groups?.code
                  ? [field('code', 'رمز المحور', 'string', match.groups.code)]
                  : []),
                field('strategicAxis', 'المحور الاستراتيجي', 'string', title, title),
              ],
            }),
          );
        }
      }
      if (allowed.has('INITIATIVE')) {
        const match = initiativePattern.exec(line);
        const title = match?.groups?.title?.trim();
        if (title) {
          proposals.push(
            candidate({
              proposalType: 'INITIATIVE',
              title,
              importTargetType: 'INITIATIVE',
              rule: 'section.initiative.v1',
              confidence: match?.groups?.code ? 0.91 : 0.84,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [
                ...(match?.groups?.code
                  ? [field('code', 'رمز المبادرة', 'string', match.groups.code)]
                  : []),
                field('name', 'اسم المبادرة', 'string', title, title),
              ],
            }),
          );
        }
      }
      if (allowed.has('MILESTONE')) {
        const match = milestonePattern.exec(line);
        const title = match?.groups?.title?.trim();
        if (title) {
          proposals.push(
            candidate({
              proposalType: 'MILESTONE',
              title,
              importTargetType: 'MILESTONE',
              rule: 'section.milestone.v1',
              confidence: 0.84,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [field('title', 'المرحلة الرئيسية', 'string', title, title)],
            }),
          );
        }
      }
      if (allowed.has('RESPONSIBLE_DEPARTMENT')) {
        const match = responsiblePattern.exec(line);
        const value = match?.groups?.value?.trim();
        if (value) {
          proposals.push(
            candidate({
              proposalType: 'RESPONSIBLE_DEPARTMENT',
              title: value,
              rule: 'field.responsible_department.v1',
              confidence: 0.94,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [field('department', 'الإدارة المسؤولة', 'string', value, value)],
            }),
          );
        }
      }
      if (allowed.has('BENEFICIARY_GROUP')) {
        const match = beneficiaryPattern.exec(line);
        const value = match?.groups?.value?.trim();
        if (value) {
          const countRaw = match?.groups?.count;
          const count = countRaw ? parseInstitutionalNumber(countRaw) : null;
          proposals.push(
            candidate({
              proposalType: 'BENEFICIARY_GROUP',
              title: value,
              rule: 'field.beneficiary_group.v1',
              confidence: 0.9,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [
                field('group', 'الفئة المستهدفة', 'string', value, value),
                ...(count !== null ? [field('count', 'العدد', 'number', count, countRaw)] : []),
              ],
            }),
          );
        }
      }
      if (allowed.has('DOCUMENT_DATE')) {
        for (const match of line.matchAll(datePattern)) {
          const label = match.groups?.label;
          const value = match.groups?.value;
          if (!label || !value) continue;
          proposals.push(
            candidate({
              proposalType: label === 'فترة التقرير' ? 'REPORTING_PERIOD' : 'DOCUMENT_DATE',
              title: `${label}: ${value}`,
              rule: label === 'فترة التقرير' ? 'period.reporting.v1' : 'field.date.v1',
              confidence: 0.93,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [
                field('label', 'نوع التاريخ', 'string', label),
                field('date', label, 'date', value),
              ],
            }),
          );
        }
      }
      if (allowed.has('BUDGET')) {
        const match = budgetTotalPattern.exec(line);
        const raw = match?.groups?.amount;
        const amount = raw ? parseInstitutionalNumber(raw) : null;
        if (amount !== null) {
          proposals.push(
            candidate({
              proposalType: 'BUDGET',
              title: 'إجمالي الموازنة',
              importTargetType: 'BUDGET_RECORD',
              rule: 'amount.budget_total.v1',
              confidence: 0.93,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [
                field('totalPlanned', 'إجمالي الموازنة', 'currency', amount, raw),
                ...(match?.groups?.currency
                  ? [
                      field(
                        'currency',
                        'العملة',
                        'string',
                        match.groups.currency.trim(),
                        match.groups.currency.trim(),
                      ),
                    ]
                  : []),
              ],
            }),
          );
        }
      }
      if (allowed.has('RISK')) {
        const match = riskPattern.exec(line);
        const title = match?.groups?.title?.trim();
        if (title) {
          proposals.push(
            candidate({
              proposalType: 'RISK',
              title,
              importTargetType: 'RISK',
              rule: 'section.risk.v1',
              confidence: 0.82,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [
                ...(match?.groups?.code
                  ? [field('code', 'رمز الخطر', 'string', match.groups.code)]
                  : []),
                field('title', 'الخطر', 'string', title, title),
              ],
            }),
          );
        }
      }
      if (allowed.has('RISK_TREATMENT')) {
        const match = treatmentPattern.exec(line);
        const value = match?.groups?.value?.trim();
        if (value) {
          proposals.push(
            candidate({
              proposalType: 'RISK_TREATMENT',
              title: value,
              importTargetType: 'RISK_TREATMENT',
              rule: 'section.risk_treatment.v1',
              confidence: 0.88,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [field('title', 'خطة المعالجة', 'string', value, value)],
            }),
          );
        }
      }
      if (allowed.has('GOVERNANCE_SCORE')) {
        const match = governancePattern.exec(line);
        const raw = match?.groups?.value;
        const value = raw ? parseInstitutionalNumber(raw) : null;
        if (value !== null && value >= 0 && value <= 100) {
          proposals.push(
            candidate({
              proposalType: 'GOVERNANCE_SCORE',
              title: 'درجة الحوكمة',
              importTargetType: 'METRIC_VALUE',
              rule: 'score.governance.v1',
              confidence: 0.94,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [
                field('metricKey', 'المؤشر', 'string', 'governance_score'),
                field('numericValue', 'درجة الحوكمة', 'percentage', value, raw),
              ],
            }),
          );
        }
      }
      if (allowed.has('FINANCIAL_VALUE')) {
        for (const match of line.matchAll(new RegExp(financialPattern.source, 'gu'))) {
          const kind = match.groups?.kind;
          const raw = match.groups?.value;
          const value = raw ? parseInstitutionalNumber(raw) : null;
          if (!kind || value === null) continue;
          proposals.push(
            candidate({
              proposalType: 'FINANCIAL_VALUE',
              title: kind,
              rule: 'amount.financial.v1',
              confidence: 0.9,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [
                field('kind', 'البند المالي', 'string', kind),
                field('value', 'القيمة', 'currency', value, raw),
                ...(match.groups?.currency
                  ? [
                      field(
                        'currency',
                        'العملة',
                        'string',
                        match.groups.currency.trim(),
                        match.groups.currency.trim(),
                      ),
                    ]
                  : []),
              ],
            }),
          );
        }
      }
      if (allowed.has('POLICY_REQUIREMENT')) {
        const match = policyPattern.exec(line);
        const value = match?.groups?.value?.trim();
        if (value) {
          proposals.push(
            candidate({
              proposalType: 'POLICY_REQUIREMENT',
              title: snippet(line).slice(0, 120),
              rule: 'section.policy_requirement.v1',
              confidence: 0.8,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [field('requirement', 'المتطلب', 'string', line, line)],
            }),
          );
        }
      }
      if (allowed.has('REPORTING_PERIOD')) {
        const match = reportingPeriodPattern.exec(line);
        const value = match?.groups?.value?.trim();
        if (value) {
          proposals.push(
            candidate({
              proposalType: 'REPORTING_PERIOD',
              title: value,
              rule: 'period.reporting.v1',
              confidence: 0.88,
              page: page.pageNumber,
              section,
              evidence: line,
              fields: [field('period', 'فترة التقرير', 'string', value, value)],
            }),
          );
        }
      }
    }
  }
  return proposals;
};

const headerIndex = (row: string[], patterns: RegExp[]) =>
  row.findIndex((cellValue) => patterns.some((pattern) => pattern.test(cellValue)));

export const extractBudgetLines = (tables: ExtractedTableData[]) => {
  const proposals: ExtractionProposalCandidate[] = [];
  for (const table of tables) {
    const header = table.rows[0]?.map((value) => normalizeInstitutionalText(value)) ?? [];
    const categoryIndex = headerIndex(header, [/البند/u, /الفئة/u, /النشاط/u, /الوصف/u]);
    const amountIndex = headerIndex(header, [/المبلغ/u, /التكلفة/u, /الموازنة/u, /الإجمالي/u]);
    if (categoryIndex < 0 || amountIndex < 0) continue;
    table.rows.slice(1).forEach((row, index) => {
      const category = normalizeInstitutionalText(row[categoryIndex] ?? '');
      const rawAmount = normalizeInstitutionalText(row[amountIndex] ?? '');
      const amount = parseInstitutionalNumber(rawAmount);
      if (!category || amount === null) return;
      const evidence = row.join(' | ');
      proposals.push(
        candidate({
          proposalType: 'BUDGET_LINE',
          title: category,
          importTargetType: 'BUDGET_LINE',
          rule: 'table.budget_line.v1',
          confidence: Math.min(0.96, table.confidence),
          page: table.pageNumber,
          section: table.sourceSection || table.title,
          evidence,
          fields: [
            field('category', 'البند', 'string', category, row[categoryIndex]),
            field('plannedAmount', 'المبلغ المخطط', 'currency', amount, rawAmount),
            field('tableRow', 'صف الجدول', 'number', index + 2),
          ],
        }),
      );
    });
  }
  return proposals;
};

const deduplicate = (proposals: ExtractionProposalCandidate[]) => {
  const seen = new Set<string>();
  return proposals.filter((proposal) => {
    const key = createHash('sha256')
      .update(
        [
          proposal.proposalType,
          proposal.sourcePage ?? '',
          proposal.title,
          proposal.evidenceSnippet ?? '',
        ].join('|'),
      )
      .digest('hex');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const allTypes = new Set<ExtractionProposalType>([
  'STRATEGIC_OBJECTIVE',
  'KPI',
  'INITIATIVE',
  'MILESTONE',
  'RESPONSIBLE_DEPARTMENT',
  'BENEFICIARY_GROUP',
  'DOCUMENT_DATE',
  'BUDGET',
  'RISK',
  'RISK_TREATMENT',
  'GOVERNANCE_SCORE',
  'FINANCIAL_VALUE',
  'POLICY_REQUIREMENT',
  'REPORTING_PERIOD',
  'OTHER',
]);

abstract class RuleBasedExtractor implements SpecializedInstitutionalExtractor {
  abstract readonly name: string;
  abstract supports(documentType: DocumentType): boolean;
  protected allowed = allTypes;
  protected includeBudgetTables = false;

  extract(input: InstitutionalExtractionInput) {
    return deduplicate([
      ...extractLineCandidates(input.pages, this.allowed),
      ...(this.includeBudgetTables ? extractBudgetLines(input.tables) : []),
    ]);
  }
}

export class StrategicPlanExtractor extends RuleBasedExtractor {
  readonly name = 'strategic-plan-rules';
  protected allowed = new Set<ExtractionProposalType>([
    'STRATEGIC_OBJECTIVE',
    'KPI',
    'OTHER',
    'RESPONSIBLE_DEPARTMENT',
    'DOCUMENT_DATE',
  ]);
  extract(input: InstitutionalExtractionInput) {
    const legacy = super
      .extract(input)
      .filter((proposal) => proposal.extractionRuleId !== 'section.strategic_axis.v1');
    return applyProposalQualityGates([
      ...legacy,
      ...extractStrategicSemanticProposals(input),
    ]);
  }
  supports(documentType: DocumentType) {
    return documentType === 'STRATEGIC_PLAN';
  }
}

export class OperationalPlanExtractor extends RuleBasedExtractor {
  readonly name = 'operational-plan-rules';
  protected allowed = new Set<ExtractionProposalType>([
    'STRATEGIC_OBJECTIVE',
    'KPI',
    'INITIATIVE',
    'MILESTONE',
    'RESPONSIBLE_DEPARTMENT',
    'BENEFICIARY_GROUP',
    'DOCUMENT_DATE',
    'BUDGET',
    'RISK',
  ]);
  protected includeBudgetTables = true;
  extract(input: InstitutionalExtractionInput) {
    return extractOperationalSemanticProposals(input);
  }
  supports(documentType: DocumentType) {
    return documentType === 'OPERATIONAL_PLAN' || documentType === 'PROGRAM';
  }
}

export class BudgetDocumentExtractor extends RuleBasedExtractor {
  readonly name = 'budget-rules';
  protected allowed = new Set<ExtractionProposalType>([
    'BUDGET',
    'RESPONSIBLE_DEPARTMENT',
    'DOCUMENT_DATE',
    'REPORTING_PERIOD',
  ]);
  protected includeBudgetTables = true;
  supports(documentType: DocumentType) {
    return documentType === 'BUDGET';
  }
}

export class GovernanceDocumentExtractor extends RuleBasedExtractor {
  readonly name = 'governance-compliance-rules';
  protected allowed = new Set<ExtractionProposalType>([
    'GOVERNANCE_SCORE',
    'POLICY_REQUIREMENT',
    'DOCUMENT_DATE',
    'REPORTING_PERIOD',
    'RISK',
    'RISK_TREATMENT',
  ]);
  supports(documentType: DocumentType) {
    return documentType === 'GOVERNANCE';
  }
}

export class FinancialReportExtractor extends RuleBasedExtractor {
  readonly name = 'financial-report-rules';
  protected allowed = new Set<ExtractionProposalType>([
    'FINANCIAL_VALUE',
    'REPORTING_PERIOD',
    'DOCUMENT_DATE',
  ]);
  supports(documentType: DocumentType) {
    return documentType === 'FINANCIAL';
  }
}

export class PolicyRegulationExtractor extends RuleBasedExtractor {
  readonly name = 'policy-regulation-rules';
  protected allowed = new Set<ExtractionProposalType>([
    'POLICY_REQUIREMENT',
    'DOCUMENT_DATE',
    'RESPONSIBLE_DEPARTMENT',
  ]);
  supports(documentType: DocumentType) {
    return documentType === 'POLICY' || documentType === 'REGULATION';
  }
}

export class GenericInstitutionalExtractor extends RuleBasedExtractor {
  readonly name = 'generic-institutional-rules';
  protected includeBudgetTables = true;
  supports() {
    return true;
  }
}

export class InstitutionalExtractionService {
  constructor(
    readonly extractors: SpecializedInstitutionalExtractor[] = [
      new StrategicPlanExtractor(),
      new OperationalPlanExtractor(),
      new BudgetDocumentExtractor(),
      new GovernanceDocumentExtractor(),
      new FinancialReportExtractor(),
      new PolicyRegulationExtractor(),
      new GenericInstitutionalExtractor(),
    ],
  ) {}

  extract(input: InstitutionalExtractionInput) {
    const extractor = this.extractors.find((candidateExtractor) =>
      candidateExtractor.supports(input.documentType),
    );
    return extractor?.extract(input) ?? [];
  }
}
