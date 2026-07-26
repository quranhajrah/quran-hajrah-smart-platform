import { describe, expect, it } from 'vitest';
import {
  applyProposalQualityGates,
  detectInstitutionalSections,
  extractOperationalSemanticProposals,
  mapSemanticTableRows,
  normalizeArabicSemanticText,
  parseSemanticNumber,
} from './semantic.js';
import type { ExtractedPageData, InstitutionalExtractionInput } from './types.js';

const page = (pageNumber: number, text: string): ExtractedPageData => ({
  pageNumber,
  rawText: text,
  text,
  hasEmbeddedText: true,
  quality: 1,
  tables: [],
});

const operationalInput = (
  pages: ExtractedPageData[],
  tables: InstitutionalExtractionInput['tables'] = [],
): InstitutionalExtractionInput => ({
  documentType: 'OPERATIONAL_PLAN',
  pages,
  tables,
});

describe('Enterprise 24.1 Arabic semantic normalization', () => {
  it('normalizes Arabic and Western digits without changing numeric values', () => {
    expect(normalizeArabicSemanticText('المبلغ ٥٣٠٬٠٠٠ ريال، 25%')).toBe(
      'المبلغ 530٬000 ريال، 25%',
    );
    expect(parseSemanticNumber('٥٣٠٬٠٠٠')).toBe(530000);
    expect(parseSemanticNumber('530,000')).toBe(530000);
  });

  it('detects structured sections with source lines and tables', () => {
    const tables = [
      {
        pageNumber: 2,
        tableIndex: 0,
        rows: [
          ['البند', 'المبلغ'],
          ['البرامج', '1000'],
        ],
        confidence: 0.9,
        extractionMethod: 'test',
      },
    ];
    const sections = detectInstitutionalSections(
      [
        page(1, 'بيانات الجمعية\nترخيص 3547\nالأهداف الفرعية\nالهدف الفرعي الأول: التعليم'),
        page(2, 'الموازنة\nإجمالي الموازنة: 530000 ريال'),
      ],
      tables,
    );
    expect(sections.map((section) => section.heading)).toEqual([
      'بيانات الجمعية',
      'الأهداف الفرعية',
      'الموازنة',
    ]);
    expect(sections[0]?.sourceLines[0]?.text).toBe('ترخيص 3547');
    expect(sections[2]?.sourceTables).toEqual([{ pageNumber: 2, tableIndex: 0 }]);
    expect(sections.every((section) => section.parserRuleId === 'semantic.section.v2')).toBe(true);
  });

  it('maps table rows by semantic headers and preserves row references', () => {
    const rows = mapSemanticTableRows([
      {
        pageNumber: 4,
        tableIndex: 2,
        rows: [
          ['الهدف', 'النشاط', 'المؤشر', 'المسؤول', 'المبلغ'],
          ['رفع الجودة', 'تأهيل المعلمين', 'نسبة الإنجاز', 'الشؤون التعليمية', '50000'],
        ],
        confidence: 0.92,
        extractionMethod: 'test',
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      pageNumber: 4,
      tableIndex: 2,
      rowIndex: 1,
      values: {
        objective: 'رفع الجودة',
        initiative: 'تأهيل المعلمين',
        kpi: 'نسبة الإنجاز',
        responsible: 'الشؤون التعليمية',
        amount: '50000',
      },
    });
  });
});

describe('Enterprise 24.1 semantic proposal quality', () => {
  it('rejects heading-only and duplicate proposals', () => {
    const base = {
      proposedData: {},
      importTargetType: 'KPI' as const,
      extractionRuleId: 'semantic.kpi.v2',
      extractionMethod: 'deterministic-semantic-v2',
      confidence: 0.9,
      sourcePage: 1,
    };
    const accepted = applyProposalQualityGates([
      {
        ...base,
        candidateKey: 'heading',
        proposalType: 'STRATEGIC_OBJECTIVE',
        title: 'الأهداف الفرعية - 2',
        evidenceSnippet: 'الأهداف الفرعية - 2',
        fields: [
          {
            key: 'title',
            labelAr: 'العنوان',
            dataType: 'string',
            value: 'الأهداف الفرعية - 2',
            sourceValue: 'الأهداف الفرعية - 2',
          },
        ],
      },
      {
        ...base,
        candidateKey: 'valid-a',
        proposalType: 'KPI',
        title: 'نسبة إنجاز البرامج',
        evidenceSnippet: 'المؤشر: نسبة إنجاز البرامج',
        fields: [
          {
            key: 'title',
            labelAr: 'العنوان',
            dataType: 'string',
            value: 'نسبة إنجاز البرامج',
            sourceValue: 'نسبة إنجاز البرامج',
          },
        ],
      },
      {
        ...base,
        candidateKey: 'valid-b',
        proposalType: 'KPI',
        title: 'نسبة إنجاز البرامج',
        evidenceSnippet: 'مؤشر الإنجاز: نسبة إنجاز البرامج',
        fields: [
          {
            key: 'title',
            labelAr: 'العنوان',
            dataType: 'string',
            value: 'نسبة إنجاز البرامج',
            sourceValue: 'نسبة إنجاز البرامج',
          },
        ],
      },
    ]);
    expect(accepted).toHaveLength(1);
    expect(accepted[0]?.title).toBe('نسبة إنجاز البرامج');
  });

  it('extracts beneficiary groups without inventing gender splits', () => {
    const proposals = extractOperationalSemanticProposals(
      operationalInput([
        page(
          1,
          [
            'الفئة المستهدفة',
            '390 طالبًا وطالبة',
            '50 من كبار السن',
            '٢٩ معلمًا ومعلمة',
            '137 طالبًا',
            '185 طالبة',
          ].join('\n'),
        ),
      ]),
    ).filter((proposal) => proposal.proposalType === 'BENEFICIARY_GROUP');
    expect(proposals).toHaveLength(5);
    expect(proposals.map((proposal) => proposal.proposedData.totalCount)).toEqual([
      390, 50, 29, 137, 185,
    ]);
    expect(proposals[0]?.proposedData.maleCount).toBeUndefined();
    expect(proposals[0]?.proposedData.femaleCount).toBeUndefined();
    expect(proposals[3]?.proposedData.maleCount).toBe(137);
    expect(proposals[4]?.proposedData.femaleCount).toBe(185);
  });

  it('preserves Hijri dates and normalizes unambiguous Gregorian dates', () => {
    const proposals = extractOperationalSemanticProposals(
      operationalInput([
        page(
          1,
          [
            'الهدف الفرعي الأول: رفع جودة البرامج',
            'تاريخ البدء: 2026/01/01',
            'تاريخ الانتهاء: 1448/01/20 هـ',
          ].join('\n'),
        ),
      ]),
    ).filter((proposal) => proposal.proposalType === 'DOCUMENT_DATE');
    expect(proposals).toHaveLength(2);
    expect(proposals[0]?.proposedData).toMatchObject({
      calendarType: 'GREGORIAN',
      normalizedValue: '2026-01-01',
    });
    expect(proposals[1]?.proposedData).toMatchObject({
      calendarType: 'HIJRI',
      normalizedValue: '1448-01-20',
    });
  });
});

describe('production operational-plan semantic acceptance fixture', () => {
  it('produces complete evidence-backed institutional proposals', () => {
    const input = operationalInput(
      [
        page(
          1,
          [
            'الخطة التشغيلية والموازنة لعام 2026',
            'بيانات الجمعية',
            'ترخيص 3547',
            'الفئة المستهدفة',
            '390 طالبًا وطالبة',
            '50 من كبار السن',
            '29 معلمًا ومعلمة',
          ].join('\n'),
        ),
        page(
          2,
          [
            'الأهداف الفرعية',
            'الهدف الفرعي الأول: رفع جودة البرامج التعليمية',
            'المؤشر: نسبة إنجاز البرامج التعليمية',
            'المسؤول عن التنفيذ: الشؤون التعليمية',
            'تاريخ البدء: 2026/01/01',
            'تاريخ الانتهاء: 2026/12/31',
            'الهدف الفرعي الثاني: تنمية الموارد المالية',
            'مؤشر الإنجاز: نسبة نمو الموارد المالية',
            'المسؤول عن التنفيذ: تنمية الموارد',
          ].join('\n'),
        ),
        page(
          3,
          [
            'الهدف الفرعي الثالث: تعزيز الحوكمة والامتثال',
            'معيار القياس: نسبة الالتزام بالسياسات',
            'المسؤول عن التنفيذ: الحوكمة',
            'الهدف الفرعي الرابع: تحسين الكفاءة التشغيلية',
            'المؤشر: نسبة إنجاز الخطة التشغيلية',
            'المسؤول عن التنفيذ: الإدارة التنفيذية',
          ].join('\n'),
        ),
        page(4, 'الموازنة\nإجمالي الموازنة: 530000 ريال'),
      ],
      [
        {
          pageNumber: 4,
          tableIndex: 0,
          rows: [
            ['البند', 'المبلغ', 'المسؤول'],
            ['الرواتب والمكافآت', '200000', 'الموارد البشرية'],
            ['البرامج التعليمية', '180000', 'الشؤون التعليمية'],
            ['التشغيل', '100000', 'الإدارة التنفيذية'],
            ['التسويق والإعلام', '50000', 'الإعلام'],
          ],
          confidence: 0.94,
          extractionMethod: 'fixture-table',
        },
      ],
    );
    const proposals = extractOperationalSemanticProposals(input);
    const byType = (type: string) => proposals.filter((proposal) => proposal.proposalType === type);

    expect(byType('BENEFICIARY_GROUP')).toHaveLength(3);
    expect(byType('STRATEGIC_OBJECTIVE')).toHaveLength(4);
    expect(byType('KPI')).toHaveLength(4);
    expect(byType('BUDGET')).toHaveLength(1);
    expect(byType('BUDGET')[0]?.proposedData).toMatchObject({
      fiscalYear: 2026,
      totalPlanned: 530000,
      currency: 'SAR',
    });
    expect(byType('BUDGET_LINE')).toHaveLength(4);
    expect(
      byType('BUDGET_LINE').reduce(
        (sum, proposal) => sum + Number(proposal.proposedData.plannedAmount),
        0,
      ),
    ).toBe(530000);
    expect(
      proposals.some(
        (proposal) => proposal.proposedData.responsibleDepartment === 'الشؤون التعليمية',
      ),
    ).toBe(true);
    expect(proposals.some((proposal) => proposal.proposedData.startDate === '2026-01-01')).toBe(
      true,
    );
    expect(proposals.every((proposal) => proposal.sourcePage && proposal.evidenceSnippet)).toBe(
      true,
    );
    expect(proposals.some((proposal) => proposal.parentCandidateKey && proposal.relationType)).toBe(
      true,
    );
    expect(proposals.some((proposal) => proposal.title === 'الأهداف الفرعية - 2')).toBe(false);
  });
});
