import { createHash } from 'node:crypto';
import { normalizeInstitutionalText } from './providers.js';
import type {
  ExtractedTableData,
  ExtractionProposalCandidate,
  InstitutionalExtractionInput,
  ProposalFieldCandidate,
} from './types.js';

const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
const easternDigits = '۰۱۲۳۴۵۶۷۸۹';
const arabicDiacritics = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/gu;
const stripControlCharacters = (value: string) =>
  [...value]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join('');

export const normalizeInstitutionalDigits = (value: string) =>
  [...value]
    .map((character) => {
      const arabicIndex = arabicDigits.indexOf(character);
      if (arabicIndex >= 0) return String(arabicIndex);
      const easternIndex = easternDigits.indexOf(character);
      return easternIndex >= 0 ? String(easternIndex) : character;
    })
    .join('');

export const normalizeArabicSemanticText = (value: string) =>
  normalizeInstitutionalDigits(normalizeInstitutionalText(value))
    .replace(/ـ+/g, '')
    .replace(arabicDiacritics, '')
    .replace(/[“”«»]/g, '"')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\s*([:،؛])\s*/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

const matchText = (value: string) =>
  normalizeArabicSemanticText(value)
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();

export const parseSemanticNumber = (raw: string) => {
  const normalized = normalizeInstitutionalDigits(raw)
    .replace(/[٬,\s]/g, '')
    .replace('٫', '.')
    .replace(/[^\d.-]/g, '');
  if (!normalized || !/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const safeEvidence = (value: string) =>
  stripControlCharacters(normalizeInstitutionalText(value)).replace(/[<>]/g, '').slice(0, 500);

export type DetectedSectionLine = {
  pageNumber: number;
  lineIndex: number;
  text: string;
};

export type DetectedSectionTable = {
  pageNumber: number;
  tableIndex: number;
};

export type DetectedInstitutionalSection = {
  heading: string;
  normalizedHeading: string;
  startPage: number;
  endPage: number;
  sourceLines: DetectedSectionLine[];
  sourceTables: DetectedSectionTable[];
  confidence: number;
  parserRuleId: string;
};

const sectionDefinitions = [
  ['بيانات الجمعية', /^(?:بيانات الجمعية|معلومات الجمعية)$/u],
  ['الفئة المستهدفة', /^(?:الفئة المستهدفة|الفئات المستهدفة)$/u],
  ['العدد أو الفئة المستهدفة', /^(?:العدد او الفئة المستهدفة|العدد والفئة المستهدفة)$/u],
  ['الهدف العام', /^الهدف العام$/u],
  ['الأهداف الفرعية', /^الاهداف الفرعية(?:\s*[-:]\s*\d+)?$/u],
  ['مؤشرات الإنجاز', /^(?:مؤشرات الانجاز|مؤشرات الاداء)$/u],
  ['خطة العمل', /^(?:خطة العمل|الخطة التنفيذية)$/u],
  ['المسؤول عن التنفيذ', /^(?:المسؤول عن التنفيذ|الجهة المسؤولة|الادارة المسؤولة)$/u],
  ['تاريخ البدء', /^تاريخ البدء$/u],
  ['تاريخ الانتهاء', /^تاريخ الانتهاء$/u],
  ['الموازنة', /^(?:الموازنة|الميزانية)$/u],
  ['الموازنة المقترحة', /^الموازنة المقترحة$/u],
  ['الإجمالي', /^(?:الاجمالي|المجموع)$/u],
  ['الإيرادات', /^الايرادات$/u],
  ['المصروفات', /^المصروفات$/u],
  ['المخاطر', /^المخاطر$/u],
  ['الحوكمة', /^الحوكمة$/u],
  ['التوصيات', /^التوصيات$/u],
] as const;

const stripHeadingNumber = (value: string) =>
  value
    .replace(/^(?:\d+|[أابتثجحخدذرزسشصضطظعغفقكلمنهوي]+)\s*[.)-]\s*/u, '')
    .replace(/\s*[.)-]\s*\d+\s*$/u, '')
    .trim();

const sectionHeading = (line: string) => {
  const normalized = stripHeadingNumber(matchText(line).replace(/[:：]\s*$/u, ''));
  const definition = sectionDefinitions.find(([, pattern]) => pattern.test(normalized));
  return definition ? { heading: definition[0], normalized } : null;
};

export const detectInstitutionalSections = (
  pages: InstitutionalExtractionInput['pages'],
  tables: ExtractedTableData[],
) => {
  const sections: DetectedInstitutionalSection[] = [];
  let active: DetectedInstitutionalSection | null = null;
  for (const page of pages) {
    const lines = page.text
      .split('\n')
      .map((text) => normalizeInstitutionalText(text))
      .filter(Boolean);
    lines.forEach((line, lineIndex) => {
      const detected = sectionHeading(line);
      if (detected) {
        if (active) active.endPage = page.pageNumber;
        active = {
          heading: detected.heading,
          normalizedHeading: detected.normalized,
          startPage: page.pageNumber,
          endPage: page.pageNumber,
          sourceLines: [],
          sourceTables: [],
          confidence: 0.96,
          parserRuleId: 'semantic.section.v2',
        };
        sections.push(active);
        return;
      }
      if (active) {
        active.endPage = page.pageNumber;
        active.sourceLines.push({ pageNumber: page.pageNumber, lineIndex, text: line });
      }
    });
  }
  for (const table of tables) {
    const owningSection = [...sections]
      .reverse()
      .find(
        (section) => table.pageNumber >= section.startPage && table.pageNumber <= section.endPage,
      );
    owningSection?.sourceTables.push({
      pageNumber: table.pageNumber,
      tableIndex: table.tableIndex,
    });
  }
  return sections;
};

export type SemanticLine = {
  text: string;
  evidence: string;
  normalized: string;
  pageNumber: number;
  lineIndex: number;
  position: number;
  section?: string;
  sourceLineIndexes: number[];
};

const semanticLines = (
  input: InstitutionalExtractionInput,
  sections: DetectedInstitutionalSection[],
) => {
  const sectionByLine = new Map<string, string>();
  for (const section of sections) {
    for (const line of section.sourceLines) {
      sectionByLine.set(`${line.pageNumber}:${line.lineIndex}`, section.heading);
    }
  }
  return input.pages.flatMap((page) =>
    page.text
      .split('\n')
      .map((text) => normalizeInstitutionalText(text))
      .filter(Boolean)
      .map((text, lineIndex) => ({
        text,
        evidence: text,
        normalized: matchText(text),
        pageNumber: page.pageNumber,
        lineIndex,
        position: page.pageNumber * 10_000 + lineIndex,
        section: sectionByLine.get(`${page.pageNumber}:${lineIndex}`),
        sourceLineIndexes: [lineIndex],
      })),
  );
};

const logicalLabelPattern =
  /^(?:الهدف\s+(?:الفرعي|التشغيلي)(?:\s+(?:الاول|الاولى|الثاني|الثانية|الثالث|الثالثة|الرابع|الرابعة|الخامس|الخامسة|\d+))?|الهدف\s*(?:رقم)?\s*\d+|المؤشر|مؤشر\s+(?:الانجاز|الاداء)|معيار\s+القياس|المبادرة|المشروع|البرنامج|النشاط|خطة\s+العمل|الاجراء\s+التنفيذي|المسؤول\s+عن\s+التنفيذ|الجهة\s+المسؤولة|الادارة\s+المسؤولة|تاريخ\s+البدء|تاريخ\s+الانتهاء|الفئة\s+المستهدفة|العدد|اجمالي\s+(?:الموازنة|الميزانية|التكلفة)|الموازنة\s+المقترحة|الاجمالي|المجموع)\s*[:-]?$/u;
const logicalNumberPattern = /^[0-9٠-٩۰-۹][0-9٠-٩۰-۹٬,.\s]*(?:ريال|ر\.?\s*س|SAR)?$/iu;
const logicalBeneficiaryGroupPattern =
  /^(?:من\s+كبار\s+السن|طالب(?:ا|ًا|اً)?\s*وطالبة|معلم(?:ا|ًا|اً)?\s*ومعلمة|طلاب|طالبات|طالب(?:ا|ًا|اً)?|طالبة|معلمون|معلمات|رجل(?:ا|ًا|اً)?|امرأة)$/u;
const logicalCompositeLabelPattern =
  /^(?:الموازنة\s+المقترحة|مؤشرات\s+الانجاز|المسؤول\s+عن\s+التنفيذ|تاريخ\s+البدء|تاريخ\s+الانتهاء|الفئة\s+المستهدفة|خطة\s+العمل)$/u;
const logicalBudgetLabelPattern =
  /^(?:اجمالي\s+(?:الموازنة|الميزانية|التكلفة)|الموازنة\s+المقترحة|الاجمالي|المجموع)$/u;

const combineLogicalLines = (
  source: SemanticLine[],
  normalized: string,
  evidence: string,
): SemanticLine => ({
  text: normalized,
  evidence,
  normalized,
  pageNumber: source[0]!.pageNumber,
  lineIndex: source[0]!.lineIndex,
  position: source[0]!.position,
  section: source.find((line) => line.section)?.section,
  sourceLineIndexes: source.flatMap((line) => line.sourceLineIndexes),
});

/**
 * Builds evidence-preserving logical records from fragmented PDF lines.
 * Raw page text remains unchanged; only the in-memory semantic view is joined.
 */
export const assembleLogicalLines = (lines: SemanticLine[]) => {
  const output: SemanticLine[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index]!;
    const next = lines[index + 1];
    const third = lines[index + 2];
    if (!next || next.pageNumber !== current.pageNumber) {
      output.push(current);
      continue;
    }

    const currentNormalized = matchText(current.text);
    const nextNormalized = matchText(next.text);
    const joinedLabel = matchText(`${current.text} ${next.text}`);
    if (
      logicalCompositeLabelPattern.test(joinedLabel) &&
      third?.pageNumber === current.pageNumber &&
      !logicalLabelPattern.test(matchText(third.text))
    ) {
      output.push(
        combineLogicalLines(
          [current, next, third],
          `${joinedLabel}: ${matchText(third.text)}`,
          `${current.text} | ${next.text} | ${third.text}`,
        ),
      );
      index += 2;
      continue;
    }

    if (
      logicalNumberPattern.test(currentNormalized) &&
      logicalBeneficiaryGroupPattern.test(nextNormalized)
    ) {
      output.push(
        combineLogicalLines(
          [current, next],
          `${currentNormalized} ${nextNormalized}`,
          `${current.text} | ${next.text}`,
        ),
      );
      index += 1;
      continue;
    }
    if (
      logicalBeneficiaryGroupPattern.test(currentNormalized) &&
      logicalNumberPattern.test(nextNormalized)
    ) {
      output.push(
        combineLogicalLines(
          [current, next],
          `${nextNormalized} ${currentNormalized}`,
          `${current.text} | ${next.text}`,
        ),
      );
      index += 1;
      continue;
    }

    if (
      logicalNumberPattern.test(currentNormalized) &&
      logicalBudgetLabelPattern.test(nextNormalized)
    ) {
      output.push(
        combineLogicalLines(
          [current, next],
          `${nextNormalized}: ${currentNormalized}`,
          `${current.text} | ${next.text}`,
        ),
      );
      index += 1;
      continue;
    }

    if (
      logicalLabelPattern.test(currentNormalized) &&
      !logicalLabelPattern.test(nextNormalized) &&
      !sectionHeading(next.text)
    ) {
      output.push(
        combineLogicalLines(
          [current, next],
          `${currentNormalized.replace(/[:-]\s*$/u, '')}: ${nextNormalized}`,
          `${current.text} | ${next.text}`,
        ),
      );
      index += 1;
      continue;
    }

    if (
      logicalLabelPattern.test(nextNormalized) &&
      meaningfulTitle(current.text) &&
      !sectionHeading(current.text)
    ) {
      output.push(
        combineLogicalLines(
          [current, next],
          `${nextNormalized.replace(/[:-]\s*$/u, '')}: ${currentNormalized}`,
          `${current.text} | ${next.text}`,
        ),
      );
      index += 1;
      continue;
    }

    output.push(current);
  }
  return output;
};

const proposalField = (
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

const lineSourceReferenceField = (line: SemanticLine) =>
  proposalField(
    'sourceReferences',
    'مراجع أسطر المصدر',
    'array',
    line.sourceLineIndexes.map((lineIndex) => `page:${line.pageNumber}/line:${lineIndex + 1}`),
  );

const candidateKey = (type: string, page: number, identity: string) =>
  `${type.toLowerCase()}:${createHash('sha256')
    .update(`${page}|${matchText(identity)}`)
    .digest('hex')
    .slice(0, 18)}`;

const makeCandidate = (input: {
  proposalType: ExtractionProposalCandidate['proposalType'];
  title: string;
  importTargetType?: ExtractionProposalCandidate['importTargetType'];
  rule: string;
  confidence: number;
  page: number;
  section?: string;
  evidence: string;
  fields: ProposalFieldCandidate[];
  key?: string;
  parentKey?: string;
  relationType?: string;
  warnings?: string[];
}): ExtractionProposalCandidate => {
  const proposedData: Record<string, unknown> = Object.fromEntries(
    input.fields.map((item) => [item.key, item.value]),
  );
  proposedData.qualityState =
    input.confidence < 0.8 || input.warnings?.length ? 'NEEDS_REVIEW' : 'READY';
  if (input.warnings?.length) proposedData.qualityWarnings = input.warnings;
  return {
    candidateKey:
      input.key ?? candidateKey(input.proposalType, input.page, `${input.title}|${input.evidence}`),
    ...(input.parentKey ? { parentCandidateKey: input.parentKey } : {}),
    ...(input.relationType ? { relationType: input.relationType } : {}),
    proposalType: input.proposalType,
    title: input.title,
    proposedData,
    importTargetType: input.importTargetType ?? 'NONE',
    extractionRuleId: input.rule,
    extractionMethod: 'deterministic-semantic-v2',
    confidence: input.confidence,
    sourcePage: input.page,
    ...(input.section ? { sourceSection: input.section } : {}),
    evidenceSnippet: safeEvidence(input.evidence),
    fields: input.fields,
  };
};

const addField = (proposal: ExtractionProposalCandidate, nextField: ProposalFieldCandidate) => {
  if (!proposal.fields.some((current) => current.key === nextField.key)) {
    proposal.fields.push(nextField);
    proposal.proposedData[nextField.key] = nextField.value;
  }
};

const ordinalValues = new Map<string, number>([
  ['الاول', 1],
  ['الاولى', 1],
  ['الثاني', 2],
  ['الثانية', 2],
  ['الثالث', 3],
  ['الثالثة', 3],
  ['الرابع', 4],
  ['الرابعة', 4],
  ['الخامس', 5],
  ['الخامسة', 5],
  ['السادس', 6],
  ['السادسة', 6],
  ['السابع', 7],
  ['السابعة', 7],
  ['الثامن', 8],
  ['الثامنة', 8],
  ['التاسع', 9],
  ['التاسعة', 9],
  ['العاشر', 10],
  ['العاشرة', 10],
]);

const ordinalNumber = (value?: string) => {
  if (!value) return null;
  const normalized = matchText(value);
  return /^\d+$/.test(normalized) ? Number(normalized) : (ordinalValues.get(normalized) ?? null);
};

const genericHeadingValues = new Set(
  sectionDefinitions.flatMap(([heading]) => [matchText(heading)]),
);

const meaningfulTitle = (value: string) => {
  const normalized = matchText(value).replace(/^[-:.\s]+|[-:.\s]+$/g, '');
  if (normalized.length < 4 || genericHeadingValues.has(normalized)) return false;
  if (/^\d+(?:\s*[-/]\s*\d+)*$/u.test(normalized)) return false;
  if (/^(?:الاهداف الفرعية|المؤشرات|الموازنة)\s*[-:]\s*\d+$/u.test(normalized)) {
    return false;
  }
  return /[\p{L}]{3,}/u.test(normalized);
};

const findNearest = (
  entries: Array<{ position: number; candidate: ExtractionProposalCandidate }>,
  position: number,
) =>
  [...entries]
    .reverse()
    .find(
      (entry) =>
        entry.position <= position &&
        Math.floor(entry.position / 10_000) >= Math.floor(position / 10_000) - 1,
    )?.candidate;

const beneficiaryPattern =
  /(?<count>[0-9٠-٩۰-۹][0-9٠-٩۰-۹٬,.]*)\s*(?<group>طالب(?:ا|ًا|اً)?\s*وطالبة|من\s+كبار\s+السن|معلم(?:ا|ًا|اً)?\s*ومعلمة|طالبات|طالبة|معلمات|امرأة|طلاب|معلمون|طالب(?:ا|ًا|اً)?|رجل(?:ا|ًا|اً)?)(?=$|\s|[،,.;])/gu;

const beneficiaryGender = (group: string) => {
  const normalized = matchText(group);
  if (/^(?:طالبا?|طلاب|رجلا?|معلمون)$/u.test(normalized)) return 'male';
  if (/^(?:طالبة|طالبات|امراة|معلمات)$/u.test(normalized)) return 'female';
  return null;
};

const beneficiaryUnit = (group: string) =>
  matchText(group)
    .replace(/^من\s+/u, '')
    .replace(/\s+/g, ' ')
    .trim();

const extractBeneficiaries = (line: SemanticLine, parentKey?: string) => {
  const proposals: ExtractionProposalCandidate[] = [];
  const matches = [...line.text.matchAll(beneficiaryPattern)];
  const labelledMatch =
    /(?:الفئة المستهدفة|المستفيدون|المستفيدين)\s*[:-]\s*(?<group>.+?)\s+(?:العدد)\s*[:-]?\s*(?<count>[0-9٠-٩۰-۹][0-9٠-٩۰-۹٬,.]*)/u.exec(
      line.text,
    );
  if (labelledMatch) matches.push(labelledMatch);
  for (const match of matches) {
    const rawCount = match.groups?.count;
    const group = match.groups?.group?.trim();
    const totalCount = rawCount ? parseSemanticNumber(rawCount) : null;
    if (!rawCount || !group || totalCount === null) continue;
    const gender = beneficiaryGender(group);
    const fields = [
      proposalField('groupNameAr', 'الفئة المستهدفة', 'string', group, group, 0.96),
      proposalField('totalCount', 'العدد الإجمالي', 'number', totalCount, rawCount, 0.98),
      proposalField('unit', 'الوحدة', 'string', beneficiaryUnit(group), group, 0.88),
      ...(gender === 'male'
        ? [proposalField('maleCount', 'عدد الذكور', 'number', totalCount, rawCount, 0.96)]
        : []),
      ...(gender === 'female'
        ? [proposalField('femaleCount', 'عدد الإناث', 'number', totalCount, rawCount, 0.96)]
        : []),
      lineSourceReferenceField(line),
    ];
    proposals.push(
      makeCandidate({
        proposalType: 'BENEFICIARY_GROUP',
        title: `${normalizeInstitutionalDigits(rawCount)} ${group}`,
        rule: 'semantic.beneficiary.v2',
        confidence: 0.95,
        page: line.pageNumber,
        section: line.section ?? 'الفئة المستهدفة',
        evidence: line.evidence,
        fields,
        parentKey,
        relationType: parentKey ? 'OBJECTIVE_BENEFICIARY' : undefined,
      }),
    );
  }
  return proposals;
};

type NormalizedDate = {
  originalText: string;
  calendarType: 'GREGORIAN' | 'HIJRI';
  normalizedValue: string;
};

const normalizeDateValue = (raw: string): NormalizedDate | null => {
  const normalized = normalizeInstitutionalDigits(raw).trim();
  const match = /(?<year>\d{4})[/-](?<month>\d{1,2})[/-](?<day>\d{1,2})(?:\s*(?<era>هـ|م))?/u.exec(
    normalized,
  );
  if (!match?.groups) return null;
  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const calendarType =
    match.groups.era === 'هـ' || (year >= 1300 && year < 1600) ? 'HIJRI' : 'GREGORIAN';
  return {
    originalText: raw,
    calendarType,
    normalizedValue: `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
  };
};

const dateLabelPattern =
  /(?<label>تاريخ البدء|تاريخ الانتهاء|تاريخ الاصدار|تاريخ الوثيقة|تاريخ المراجعة)\s*[:-]?\s*(?<value>[0-9٠-٩۰-۹]{4}[/-][0-9٠-٩۰-۹]{1,2}[/-][0-9٠-٩۰-۹]{1,2}(?:\s*(?:هـ|م))?)/gu;

const relationFieldForDate = (label: string) =>
  matchText(label) === 'تاريخ البدء'
    ? 'startDate'
    : matchText(label) === 'تاريخ الانتهاء'
      ? 'endDate'
      : null;

const knownDepartments = [
  'الإدارة التنفيذية',
  'الشؤون التعليمية',
  'الشؤون المالية',
  'تنمية الموارد',
  'الحوكمة',
  'الإعلام',
  'الموارد البشرية',
  'مجلس الإدارة',
];

const normalizeDepartment = (value: string) => {
  const normalized = matchText(value);
  return (
    knownDepartments.find((department) => matchText(department) === normalized) ?? value.trim()
  );
};

const responsiblePattern =
  /(?:المسؤول عن التنفيذ|الجهة المسؤولة|الادارة المسؤولة|منفذ البرنامج|المشرف)\s*[:-]\s*(?<value>.+)$/u;

type TableRole =
  | 'code'
  | 'objective'
  | 'initiative'
  | 'kpi'
  | 'responsible'
  | 'start'
  | 'end'
  | 'target'
  | 'amount'
  | 'category'
  | 'beneficiary';

const tableRolePatterns: Array<[TableRole, RegExp]> = [
  ['code', /^(?:م|الرقم|الرمز|الكود)$/u],
  ['objective', /(?:الهدف الفرعي|الهدف التشغيلي|الاهداف الفرعية|الهدف|الاهداف)/u],
  [
    'initiative',
    /(?:النشاط|المبادرة|البرنامج|المشروع|خطة العمل|الاجراء التنفيذي|العمل المطلوب|الوسيلة|البرامج والانشطة|الانشطة التنفيذية)/u,
  ],
  [
    'kpi',
    /(?:المؤشر|مؤشرات الانجاز|مؤشر الانجاز|مؤشرات قياس الاداء|معيار القياس|معيار النجاح)/u,
  ],
  ['responsible', /(?:المسؤول|الجهة المسؤولة|الادارة المسؤولة|المنفذ|المشرف)/u],
  ['start', /(?:البداية|تاريخ البدء|من تاريخ)/u],
  ['end', /(?:النهاية|تاريخ الانتهاء|الى تاريخ)/u],
  ['target', /(?:المستهدف|خط الاساس|نسبة الانجاز)/u],
  [
    'amount',
    /(?:المبلغ|التكلفة|الموازنة|الاجمالي|القيمة|الاعتماد|المبلغ التقديري|التكلفة التقديرية)/u,
  ],
  ['beneficiary', /(?:الفئة المستهدفة|المستفيد|العدد)/u],
  [
    'category',
    /(?:البند|الفئة|الوصف|اوجه الصرف|مصروفات|بيان المصروف|نوع المصروف|الباب)/u,
  ],
];

export type SemanticCellReference = {
  role: TableRole;
  columnIndex: number;
  rowIndex: number;
  carriedFromRow?: number;
};

export type SemanticTableRow = {
  pageNumber: number;
  tableIndex: number;
  rowIndex: number;
  values: Partial<Record<TableRole, string>>;
  cells: string[];
  sourceCells: SemanticCellReference[];
  evidence: string;
  confidence: number;
};

const roleForHeader = (header: string) =>
  tableRolePatterns.find(([, pattern]) => pattern.test(matchText(header)))?.[0];

export const mapSemanticTableRows = (tables: ExtractedTableData[]) => {
  const output: SemanticTableRow[] = [];
  for (const table of tables) {
    const columnCount = Math.max(0, ...table.rows.map((row) => row.length));
    let headerRowCount = 1;
    let roles = new Map<number, TableRole>();
    for (
      let candidateHeaderRows = 1;
      candidateHeaderRows <= Math.min(4, table.rows.length);
      candidateHeaderRows += 1
    ) {
      const candidateRoles = new Map<number, TableRole>();
      const headers = Array.from({ length: columnCount }, (_, column) =>
        table.rows
          .slice(0, candidateHeaderRows)
          .map((row) => row[column] ?? '')
          .filter(Boolean)
          .join(' '),
      );
      for (let column = 0; column < columnCount; column += 1) {
        const header = headers[column] ?? '';
        const role = roleForHeader(header);
        if (role) candidateRoles.set(column, role);
      }
      const assignedRoles = new Set(candidateRoles.values());
      for (let column = 0; column < columnCount; column += 1) {
        if (candidateRoles.has(column)) continue;
        for (const neighbour of [column + 1, column - 1]) {
          if (neighbour < 0 || neighbour >= columnCount) continue;
          const combinedHeaders = [
            `${headers[column] ?? ''} ${headers[neighbour] ?? ''}`,
            `${headers[neighbour] ?? ''} ${headers[column] ?? ''}`,
          ];
          const role = combinedHeaders.map(roleForHeader).find(Boolean);
          if (!role || assignedRoles.has(role)) continue;
          const populatedInColumn = table.rows
            .slice(candidateHeaderRows)
            .filter((row) => normalizeInstitutionalText(row[column] ?? '')).length;
          const populatedInNeighbour = table.rows
            .slice(candidateHeaderRows)
            .filter((row) => normalizeInstitutionalText(row[neighbour] ?? '')).length;
          const targetColumn =
            populatedInNeighbour > populatedInColumn && !candidateRoles.has(neighbour)
              ? neighbour
              : column;
          candidateRoles.set(targetColumn, role);
          assignedRoles.add(role);
          break;
        }
      }
      if (candidateRoles.size > roles.size) {
        roles = candidateRoles;
        headerRowCount = candidateHeaderRows;
      }
    }
    if (roles.size === 0) continue;
    const carried = new Map<number, { value: string; rowIndex: number }>();
    table.rows.slice(headerRowCount).forEach((rawRow, relativeIndex) => {
      const values: Partial<Record<TableRole, string>> = {};
      const sourceCells: SemanticCellReference[] = [];
      const rowIndex = relativeIndex + headerRowCount;
      for (const [column, role] of roles) {
        let value = normalizeInstitutionalText(rawRow[column] ?? '');
        let carriedFromRow: number | undefined;
        if (!value && ['objective', 'responsible', 'category'].includes(role)) {
          const previous = carried.get(column);
          value = previous?.value ?? '';
          carriedFromRow = previous?.rowIndex;
        }
        if (value) {
          if (carriedFromRow === undefined) carried.set(column, { value, rowIndex });
          values[role] = value;
          sourceCells.push({
            role,
            columnIndex: column,
            rowIndex,
            ...(carriedFromRow === undefined ? {} : { carriedFromRow }),
          });
        }
      }
      const populatedValues = Object.values(values).filter(Boolean);
      if (populatedValues.length === 0) return;
      const referencedValues = sourceCells
        .map((reference) => values[reference.role])
        .filter((value): value is string => Boolean(value));
      const evidence = [...new Set([...rawRow.filter(Boolean), ...referencedValues])].join(' | ');
      output.push({
        pageNumber: table.pageNumber,
        tableIndex: table.tableIndex,
        rowIndex,
        values,
        cells: rawRow,
        sourceCells,
        evidence,
        confidence: Math.max(
          0.68,
          Math.min(
            0.96,
            table.confidence -
              (headerRowCount - 1) * 0.04 -
              (populatedValues.length === 1 ? 0.08 : 0),
          ),
        ),
      });
    });
  }
  return output;
};

const tableSourceReferenceField = (row: SemanticTableRow) =>
  proposalField(
    'sourceReferences',
    'مراجع خلايا المصدر',
    'array',
    row.sourceCells.map(
      (cell) =>
        `page:${row.pageNumber}/table:${row.tableIndex + 1}/row:${cell.rowIndex + 1}/cell:${
          cell.columnIndex + 1
        }${cell.carriedFromRow === undefined ? '' : `/merged-from-row:${cell.carriedFromRow + 1}`}`,
    ),
  );

const fiscalYearFrom = (input: InstitutionalExtractionInput) => {
  const text = input.pages.map((page) => normalizeInstitutionalDigits(page.text)).join('\n');
  const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => Number(match[1]));
  return years[0] ?? null;
};

const buildLineCandidates = (input: InstitutionalExtractionInput, lines: SemanticLine[]) => {
  const proposals: ExtractionProposalCandidate[] = [];
  const objectives: Array<{ position: number; candidate: ExtractionProposalCandidate }> = [];
  const linkable: Array<{ position: number; candidate: ExtractionProposalCandidate }> = [];

  for (const line of lines) {
    const objectiveMatch =
      /^(?:الهدف\s+(?:الفرعي|التشغيلي)\s*(?<ordinal>الاول|الاولى|الثاني|الثانية|الثالث|الثالثة|الرابع|الرابعة|الخامس|الخامسة|\d+)|الهدف\s*(?:رقم)?\s*(?<number>\d+)|الهدف\s+التشغيلي)\s*[:-]?\s*(?<title>.+)$/u.exec(
        line.normalized,
      ) ??
      /^(?<title>.+?)\s+(?:الهدف\s+(?:الفرعي|التشغيلي)\s*(?<ordinal>الاول|الاولى|الثاني|الثانية|الثالث|الثالثة|الرابع|الرابعة|الخامس|الخامسة|\d+)|الهدف\s*(?:رقم)?\s*(?<number>\d+))$/u.exec(
        line.normalized,
      ) ??
      (line.section === 'الأهداف الفرعية'
        ? (/^(?<number>\d+)\s*[.)-]\s*(?<title>.+)$/u.exec(line.normalized) ??
          /^(?<title>.+?)\s*[.)-]\s*(?<number>\d+)$/u.exec(line.normalized))
        : null);
    const objectiveTitle = objectiveMatch?.groups?.title?.trim();
    if (objectiveMatch && objectiveTitle && meaningfulTitle(objectiveTitle)) {
      const sequence = ordinalNumber(
        objectiveMatch.groups?.ordinal ?? objectiveMatch.groups?.number,
      );
      const fields = [
        ...(sequence !== null
          ? [proposalField('code', 'رمز الهدف', 'string', String(sequence), String(sequence), 0.92)]
          : []),
        proposalField('title', 'عنوان الهدف', 'string', objectiveTitle, objectiveTitle, 0.96),
        proposalField('description', 'الوصف', 'string', objectiveTitle, objectiveTitle, 0.9),
        proposalField('objectiveLevel', 'مستوى الهدف', 'string', 'OPERATIONAL', line.evidence, 0.96),
        ...(sequence !== null
          ? [
              proposalField(
                'sequenceNumber',
                'التسلسل',
                'number',
                sequence,
                objectiveMatch.groups?.ordinal ?? objectiveMatch.groups?.number,
                0.94,
              ),
            ]
          : []),
        lineSourceReferenceField(line),
      ];
      const objective = makeCandidate({
        proposalType: 'STRATEGIC_OBJECTIVE',
        title: objectiveTitle,
        importTargetType: 'STRATEGIC_OBJECTIVE',
        rule: 'semantic.operational_objective.v2',
        confidence: sequence !== null ? 0.94 : 0.86,
        page: line.pageNumber,
        section: line.section ?? 'الأهداف الفرعية',
        evidence: line.evidence,
        fields,
      });
      proposals.push(objective);
      objectives.push({ position: line.position, candidate: objective });
      linkable.push({ position: line.position, candidate: objective });
      continue;
    }

    const parent = findNearest(objectives, line.position);
    const kpiMatch =
      /^(?:(?:المؤشر|مؤشر الانجاز|مؤشر الاداء|معيار القياس)\s*[:-]\s*)(?<title>.+)$/u.exec(
        line.normalized,
      ) ??
      /^(?<title>.+?)\s+(?:المؤشر|مؤشر الانجاز|مؤشر الاداء|معيار القياس)$/u.exec(
        line.normalized,
      ) ??
      (line.section === 'مؤشرات الإنجاز'
        ? /^(?:\d+\s*[.)-]\s*)?(?<title>.+)$/u.exec(line.normalized)
        : null);
    const kpiTitle = kpiMatch?.groups?.title?.trim();
    if (kpiTitle && meaningfulTitle(kpiTitle)) {
      const targetMatch = /(?:المستهدف|الهدف الكمي)\s*[:-]?\s*([0-9.,]+)\s*(%?)/u.exec(
        line.normalized,
      );
      const target = targetMatch ? parseSemanticNumber(targetMatch[1] ?? '') : null;
      const fields = [
        proposalField('title', 'عنوان المؤشر', 'string', kpiTitle, kpiTitle, 0.95),
        proposalField('description', 'الوصف', 'string', kpiTitle, kpiTitle, 0.9),
        ...(kpiTitle.includes('%') || /نسبة/u.test(kpiTitle)
          ? [proposalField('unit', 'الوحدة', 'string', '%', line.evidence, 0.86)]
          : []),
        ...(target !== null
          ? [proposalField('target', 'المستهدف', 'number', target, targetMatch?.[1], 0.93)]
          : []),
        lineSourceReferenceField(line),
      ];
      const kpi = makeCandidate({
        proposalType: 'KPI',
        title: kpiTitle,
        importTargetType: 'KPI',
        rule: 'semantic.kpi.v2',
        confidence: parent ? 0.92 : 0.82,
        page: line.pageNumber,
        section: line.section ?? 'مؤشرات الإنجاز',
        evidence: line.evidence,
        fields,
        parentKey: parent?.candidateKey,
        relationType: parent ? 'OBJECTIVE_KPI' : undefined,
      });
      proposals.push(kpi);
      linkable.push({ position: line.position, candidate: kpi });
      continue;
    }

    const initiativeMatch =
      /^(?:المبادرة|المشروع|البرنامج|النشاط|خطة العمل|الاجراء التنفيذي)\s*[:-]\s*(?<title>.+)$/u.exec(
        line.normalized,
      ) ??
      /^(?<title>.+?)\s+(?:المبادرة|المشروع|البرنامج|النشاط|خطة العمل|الاجراء التنفيذي)$/u.exec(
        line.normalized,
      );
    const initiativeTitle = initiativeMatch?.groups?.title?.trim();
    if (initiativeTitle && meaningfulTitle(initiativeTitle)) {
      const initiative = makeCandidate({
        proposalType: 'INITIATIVE',
        title: initiativeTitle,
        importTargetType: 'INITIATIVE',
        rule: 'semantic.initiative.v2',
        confidence: parent ? 0.91 : 0.82,
        page: line.pageNumber,
        section: line.section ?? 'خطة العمل',
        evidence: line.evidence,
        fields: [
          proposalField(
            'name',
            'اسم المبادرة أو النشاط',
            'string',
            initiativeTitle,
            initiativeTitle,
            0.96,
          ),
          proposalField('description', 'الوصف', 'string', initiativeTitle, initiativeTitle, 0.9),
          lineSourceReferenceField(line),
        ],
        parentKey: parent?.candidateKey,
        relationType: parent ? 'OBJECTIVE_INITIATIVE' : undefined,
      });
      proposals.push(initiative);
      linkable.push({ position: line.position, candidate: initiative });
      continue;
    }

    proposals.push(...extractBeneficiaries(line, parent?.candidateKey));

    const responsible = responsiblePattern.exec(line.normalized)?.groups?.value?.trim();
    if (responsible) {
      const target = findNearest(linkable, line.position);
      const department = normalizeDepartment(responsible);
      if (target) {
        addField(
          target,
          proposalField(
            'responsibleDepartment',
            'المسؤول عن التنفيذ',
            'string',
            department,
            responsible,
            knownDepartments.includes(department) ? 0.96 : 0.78,
          ),
        );
      } else {
        proposals.push(
          makeCandidate({
            proposalType: 'RESPONSIBLE_DEPARTMENT',
            title: department,
            rule: 'semantic.responsibility.v2',
            confidence: knownDepartments.includes(department) ? 0.94 : 0.76,
            page: line.pageNumber,
            section: line.section ?? 'المسؤول عن التنفيذ',
            evidence: line.evidence,
            fields: [
              proposalField('department', 'الإدارة المسؤولة', 'string', department, responsible),
              lineSourceReferenceField(line),
            ],
          }),
        );
      }
    }

    for (const dateMatch of line.normalized.matchAll(dateLabelPattern)) {
      const label = dateMatch.groups?.label;
      const rawValue = dateMatch.groups?.value;
      const date = rawValue ? normalizeDateValue(rawValue) : null;
      if (!label || !date) continue;
      const relationKey = relationFieldForDate(label);
      const target = findNearest(linkable, line.position);
      if (target && relationKey) {
        addField(
          target,
          proposalField(
            relationKey,
            label,
            'date',
            date.normalizedValue,
            date.originalText,
            date.calendarType === 'GREGORIAN' ? 0.96 : 0.86,
          ),
        );
      }
      proposals.push(
        makeCandidate({
          proposalType: 'DOCUMENT_DATE',
          title: `${label}: ${date.originalText}`,
          rule: 'semantic.date.v2',
          confidence: date.calendarType === 'GREGORIAN' ? 0.95 : 0.84,
          page: line.pageNumber,
          section: line.section ?? label,
          evidence: line.evidence,
          fields: [
            proposalField('label', 'نوع التاريخ', 'string', label, label),
            proposalField(
              'originalText',
              'النص الأصلي',
              'string',
              date.originalText,
              date.originalText,
            ),
            proposalField(
              'calendarType',
              'نوع التقويم',
              'string',
              date.calendarType,
              date.originalText,
            ),
            proposalField(
              'normalizedValue',
              'القيمة المنظّمة',
              'date',
              date.normalizedValue,
              date.originalText,
            ),
            lineSourceReferenceField(line),
          ],
          parentKey: target?.candidateKey,
          relationType: target ? 'ENTITY_DATE' : undefined,
        }),
      );
    }
  }
  return { proposals, objectives, linkable };
};

const buildTableCandidates = (
  rows: SemanticTableRow[],
  existingObjectives: Array<{ position: number; candidate: ExtractionProposalCandidate }>,
) => {
  const proposals: ExtractionProposalCandidate[] = [];
  const objectives = [...existingObjectives];
  for (const row of rows) {
    const position = row.pageNumber * 10_000 + row.rowIndex;
    const evidence = row.evidence;
    let objective = row.values.objective
      ? objectives.find(
          (entry) => matchText(entry.candidate.title) === matchText(row.values.objective ?? ''),
        )?.candidate
      : findNearest(objectives, position);
    if (row.values.objective && meaningfulTitle(row.values.objective) && !objective) {
      const sequence = row.values.code ? parseSemanticNumber(row.values.code) : null;
      objective = makeCandidate({
        proposalType: 'STRATEGIC_OBJECTIVE',
        title: row.values.objective,
        importTargetType: 'STRATEGIC_OBJECTIVE',
        rule: 'semantic.table_row.v2',
        confidence: row.confidence,
        page: row.pageNumber,
        section: 'الأهداف الفرعية',
        evidence,
        fields: [
          ...(row.values.code
            ? [proposalField('code', 'رمز الهدف', 'string', row.values.code, row.values.code)]
            : []),
          proposalField(
            'title',
            'عنوان الهدف',
            'string',
            row.values.objective,
            row.values.objective,
          ),
          proposalField(
            'description',
            'الوصف',
            'string',
            row.values.objective,
            row.values.objective,
          ),
          proposalField(
            'objectiveLevel',
            'مستوى الهدف',
            'string',
            'OPERATIONAL',
            row.values.objective,
          ),
          ...(sequence !== null
            ? [proposalField('sequenceNumber', 'التسلسل', 'number', sequence, row.values.code)]
            : []),
          proposalField('tableIndex', 'رقم الجدول', 'number', row.tableIndex + 1),
          proposalField('tableRow', 'صف الجدول', 'number', row.rowIndex + 1),
          tableSourceReferenceField(row),
        ],
      });
      proposals.push(objective);
      objectives.push({ position, candidate: objective });
    }
    const commonFields = [
      ...(row.values.responsible
        ? [
            proposalField(
              'responsibleDepartment',
              'المسؤول عن التنفيذ',
              'string',
              normalizeDepartment(row.values.responsible),
              row.values.responsible,
            ),
          ]
        : []),
      ...(row.values.start && normalizeDateValue(row.values.start)
        ? [
            proposalField(
              'startDate',
              'تاريخ البدء',
              'date',
              normalizeDateValue(row.values.start)!.normalizedValue,
              row.values.start,
            ),
          ]
        : []),
      ...(row.values.end && normalizeDateValue(row.values.end)
        ? [
            proposalField(
              'endDate',
              'تاريخ الانتهاء',
              'date',
              normalizeDateValue(row.values.end)!.normalizedValue,
              row.values.end,
            ),
          ]
        : []),
    ];
    if (objective) commonFields.forEach((item) => addField(objective!, item));

    if (row.values.kpi && meaningfulTitle(row.values.kpi)) {
      const kpi = makeCandidate({
        proposalType: 'KPI',
        title: row.values.kpi,
        importTargetType: 'KPI',
        rule: 'semantic.table_row.v2',
        confidence: row.confidence,
        page: row.pageNumber,
        section: 'مؤشرات الإنجاز',
        evidence,
        fields: [
          proposalField('title', 'عنوان المؤشر', 'string', row.values.kpi, row.values.kpi),
          proposalField('description', 'الوصف', 'string', row.values.kpi, row.values.kpi),
          ...(row.values.target && parseSemanticNumber(row.values.target) !== null
            ? [
                proposalField(
                  'target',
                  'المستهدف',
                  'number',
                  parseSemanticNumber(row.values.target),
                  row.values.target,
                ),
              ]
            : []),
          ...commonFields,
          proposalField('tableIndex', 'رقم الجدول', 'number', row.tableIndex + 1),
          proposalField('tableRow', 'صف الجدول', 'number', row.rowIndex + 1),
          tableSourceReferenceField(row),
        ],
        parentKey: objective?.candidateKey,
        relationType: objective ? 'OBJECTIVE_KPI' : undefined,
      });
      proposals.push(kpi);
    }
    if (row.values.initiative && meaningfulTitle(row.values.initiative)) {
      const initiative = makeCandidate({
        proposalType: 'INITIATIVE',
        title: row.values.initiative,
        importTargetType: 'INITIATIVE',
        rule: 'semantic.table_row.v2',
        confidence: row.confidence,
        page: row.pageNumber,
        section: 'خطة العمل',
        evidence,
        fields: [
          proposalField(
            'name',
            'اسم المبادرة أو النشاط',
            'string',
            row.values.initiative,
            row.values.initiative,
          ),
          proposalField(
            'description',
            'الوصف',
            'string',
            row.values.initiative,
            row.values.initiative,
          ),
          ...commonFields,
          proposalField('tableIndex', 'رقم الجدول', 'number', row.tableIndex + 1),
          proposalField('tableRow', 'صف الجدول', 'number', row.rowIndex + 1),
          tableSourceReferenceField(row),
        ],
        parentKey: objective?.candidateKey,
        relationType: objective ? 'OBJECTIVE_INITIATIVE' : undefined,
      });
      proposals.push(initiative);
      if (row.values.amount && parseSemanticNumber(row.values.amount) !== null) {
        addField(
          initiative,
          proposalField(
            'budget',
            'الموازنة المخططة',
            'currency',
            parseSemanticNumber(row.values.amount),
            row.values.amount,
          ),
        );
      }
    }
    if (row.values.beneficiary) {
      const line: SemanticLine = {
        text: row.values.beneficiary,
        evidence: row.evidence,
        normalized: matchText(row.values.beneficiary),
        pageNumber: row.pageNumber,
        lineIndex: row.rowIndex,
        position,
        section: 'الفئة المستهدفة',
        sourceLineIndexes: [],
      };
      const beneficiaryProposals = extractBeneficiaries(line, objective?.candidateKey);
      beneficiaryProposals.forEach((proposal) => {
        proposal.fields = proposal.fields.filter((field) => field.key !== 'sourceReferences');
        const sourceReference = tableSourceReferenceField(row);
        proposal.proposedData.sourceReferences = sourceReference.value;
        proposal.fields.push(sourceReference);
      });
      proposals.push(...beneficiaryProposals);
    }
  }
  return { proposals, objectives };
};

const buildBudgetCandidates = (
  input: InstitutionalExtractionInput,
  lines: SemanticLine[],
  rows: SemanticTableRow[],
) => {
  const proposals: ExtractionProposalCandidate[] = [];
  const fiscalYear = fiscalYearFrom(input);
  const totalCandidates: ExtractionProposalCandidate[] = [];
  const labelBeforeTotalPattern =
    /(?:اجمالي\s+(?:الموازنة|الميزانية|التكلفة)|الموازنة المقترحة|الاجمالي)\s*[:-]?\s*(?<amount>[0-9٠-٩۰-۹٬,.]+)\s*(?<currency>ريال|ر\.?\s*س|SAR)?/giu;
  const valueBeforeTotalPattern =
    /(?<amount>[0-9٠-٩۰-۹٬,.]+)\s*(?<currency>ريال|ر\.?\s*س|SAR)?\s*[-:]?\s*(?:اجمالي\s+(?:الموازنة|الميزانية|التكلفة)|الموازنة المقترحة|الاجمالي)/giu;
  for (const line of lines) {
    if (
      !line.section?.includes('الموازنة') &&
      !/(?:الموازنة|الميزانية|الاجمالي)/u.test(line.normalized)
    ) {
      continue;
    }
    const totalMatches = [
      ...line.normalized.matchAll(labelBeforeTotalPattern),
      ...line.normalized.matchAll(valueBeforeTotalPattern),
    ];
    for (const match of totalMatches) {
      const rawAmount = match.groups?.amount;
      const amount = rawAmount ? parseSemanticNumber(rawAmount) : null;
      if (amount === null) continue;
      const currency = match.groups?.currency ? 'SAR' : undefined;
      const budget = makeCandidate({
        proposalType: 'BUDGET',
        title: 'إجمالي الموازنة',
        importTargetType: 'BUDGET_RECORD',
        rule: 'semantic.budget_total.v2',
        confidence: currency ? 0.97 : 0.88,
        page: line.pageNumber,
        section: line.section ?? 'الموازنة',
        evidence: line.evidence,
        fields: [
          ...(fiscalYear
            ? [
                proposalField(
                  'fiscalYear',
                  'السنة المالية',
                  'number',
                  fiscalYear,
                  String(fiscalYear),
                ),
              ]
            : []),
          proposalField('title', 'عنوان الموازنة', 'string', 'إجمالي الموازنة', match[0]),
          proposalField('totalPlanned', 'إجمالي الموازنة', 'currency', amount, rawAmount, 0.98),
          ...(currency
            ? [proposalField('currency', 'العملة', 'string', currency, match.groups?.currency)]
            : []),
          lineSourceReferenceField(line),
        ],
        key: candidateKey('budget', line.pageNumber, `${fiscalYear ?? ''}|${amount}`),
      });
      proposals.push(budget);
      totalCandidates.push(budget);
    }
  }

  const budgetLines: ExtractionProposalCandidate[] = [];
  for (const row of rows) {
    const rawAmount = row.values.amount;
    const amount = rawAmount ? parseSemanticNumber(rawAmount) : null;
    const category = row.values.category ?? row.values.initiative;
    if (!category || amount === null) continue;
    if (/^(?:الاجمالي|المجموع)$/u.test(matchText(category))) {
      if (totalCandidates.length === 0) {
        const budget = makeCandidate({
          proposalType: 'BUDGET',
          title: 'إجمالي الموازنة',
          importTargetType: 'BUDGET_RECORD',
          rule: 'semantic.budget_total.v2',
          confidence: row.confidence,
          page: row.pageNumber,
          section: 'الموازنة',
          evidence: row.evidence,
          fields: [
            ...(fiscalYear
              ? [
                  proposalField(
                    'fiscalYear',
                    'السنة المالية',
                    'number',
                    fiscalYear,
                    String(fiscalYear),
                  ),
                ]
              : []),
            proposalField('title', 'عنوان الموازنة', 'string', 'إجمالي الموازنة', category),
            proposalField('totalPlanned', 'إجمالي الموازنة', 'currency', amount, rawAmount),
            proposalField('currency', 'العملة', 'string', 'SAR', row.evidence),
            tableSourceReferenceField(row),
          ],
        });
        proposals.push(budget);
        totalCandidates.push(budget);
      }
      continue;
    }
    budgetLines.push(
      makeCandidate({
        proposalType: 'BUDGET_LINE',
        title: category,
        importTargetType: 'BUDGET_LINE',
        rule: 'semantic.budget_line.v2',
        confidence: row.confidence,
        page: row.pageNumber,
        section: 'بنود الموازنة',
        evidence: row.evidence,
        fields: [
          proposalField('category', 'بند الموازنة', 'string', category, category),
          ...(row.values.initiative && row.values.initiative !== category
            ? [
                proposalField(
                  'description',
                  'الوصف',
                  'string',
                  row.values.initiative,
                  row.values.initiative,
                ),
              ]
            : []),
          proposalField('plannedAmount', 'المبلغ المخطط', 'currency', amount, rawAmount),
          ...(row.values.responsible
            ? [
                proposalField(
                  'department',
                  'الإدارة المسؤولة',
                  'string',
                  normalizeDepartment(row.values.responsible),
                  row.values.responsible,
                ),
              ]
            : []),
          proposalField('tableIndex', 'رقم الجدول', 'number', row.tableIndex + 1),
          proposalField('tableRow', 'صف الجدول', 'number', row.rowIndex + 1),
          tableSourceReferenceField(row),
        ],
      }),
    );
  }
  const budgetParent = totalCandidates[0];
  const total = budgetParent ? Number(budgetParent.proposedData.totalPlanned) : null;
  const lineTotal = budgetLines.reduce(
    (sum, proposal) => sum + Number(proposal.proposedData.plannedAmount ?? 0),
    0,
  );
  if (budgetParent && total !== null && lineTotal > total) {
    budgetParent.proposedData.qualityState = 'NEEDS_REVIEW';
    budgetParent.proposedData.qualityWarnings = [
      `مجموع البنود (${lineTotal}) يتجاوز الإجمالي المكتشف (${total}).`,
    ];
  }
  for (const budgetLine of budgetLines) {
    if (budgetParent?.candidateKey) {
      budgetLine.parentCandidateKey = budgetParent.candidateKey;
      budgetLine.relationType = 'BUDGET_LINE_ITEM';
    }
  }
  return [...proposals, ...budgetLines];
};

const normalizedProposalIdentity = (proposal: ExtractionProposalCandidate) =>
  `${proposal.proposalType}|${matchText(proposal.title)}`;

export const applyProposalQualityGates = (proposals: ExtractionProposalCandidate[]) => {
  const accepted: ExtractionProposalCandidate[] = [];
  const keyRedirect = new Map<string, string>();
  const seen = new Map<string, ExtractionProposalCandidate>();
  for (const proposal of proposals) {
    if (!proposal.sourcePage || !proposal.evidenceSnippet) continue;
    if (!meaningfulTitle(proposal.title)) continue;
    const sources = proposal.fields
      .map((item) => item.sourceValue)
      .filter((value): value is string => Boolean(value));
    if (
      sources.length > 0 &&
      !sources.some((source) =>
        matchText(proposal.evidenceSnippet ?? '').includes(matchText(source)),
      )
    ) {
      continue;
    }
    const identity = normalizedProposalIdentity(proposal);
    const existing = seen.get(identity);
    if (existing) {
      if (proposal.candidateKey && existing.candidateKey) {
        keyRedirect.set(proposal.candidateKey, existing.candidateKey);
      }
      if (proposal.confidence > existing.confidence) {
        Object.assign(existing, proposal, { candidateKey: existing.candidateKey });
      }
      continue;
    }
    seen.set(identity, proposal);
    accepted.push(proposal);
  }
  const keys = new Set(accepted.map((proposal) => proposal.candidateKey).filter(Boolean));
  return accepted.map((proposal) => {
    if (proposal.parentCandidateKey) {
      proposal.parentCandidateKey =
        keyRedirect.get(proposal.parentCandidateKey) ?? proposal.parentCandidateKey;
      if (!keys.has(proposal.parentCandidateKey)) {
        delete proposal.parentCandidateKey;
        delete proposal.relationType;
        proposal.proposedData.qualityState = 'NEEDS_REVIEW';
      }
    }
    return proposal;
  });
};

export const extractOperationalSemanticProposals = (input: InstitutionalExtractionInput) => {
  const sections = detectInstitutionalSections(input.pages, input.tables);
  const lines = assembleLogicalLines(semanticLines(input, sections));
  const lineCandidates = buildLineCandidates(input, lines);
  const semanticRows = mapSemanticTableRows(input.tables);
  const tableCandidates = buildTableCandidates(semanticRows, lineCandidates.objectives);
  const budgetCandidates = buildBudgetCandidates(input, lines, semanticRows);
  return applyProposalQualityGates([
    ...lineCandidates.proposals,
    ...tableCandidates.proposals,
    ...budgetCandidates,
  ]);
};
