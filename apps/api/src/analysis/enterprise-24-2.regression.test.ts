import { describe, expect, it } from 'vitest';
import {
  assembleLogicalLines,
  extractOperationalSemanticProposals,
  mapSemanticTableRows,
  type SemanticLine,
} from './semantic.js';
import { enterprise242ProductionStructureFixture } from './test/enterprise-24-2-production-structure.fixture.js';

const line = (text: string, lineIndex: number): SemanticLine => ({
  text,
  evidence: text,
  normalized: text,
  pageNumber: 1,
  lineIndex,
  position: 10_000 + lineIndex,
  sourceLineIndexes: [lineIndex],
});

describe('Enterprise 24.2 logical record assembler', () => {
  it('joins multiline labels, values, and split beneficiary evidence', () => {
    const records = assembleLogicalLines([
      line('الهدف الفرعي الأول', 0),
      line('رفع جودة البرامج', 1),
      line('50', 2),
      line('من كبار السن', 3),
      line('530000 ريال', 4),
      line('الإجمالي', 5),
    ]);

    expect(records.map((record) => record.normalized)).toEqual([
      'الهدف الفرعي الاول: رفع جودة البرامج',
      '50 من كبار السن',
      'الاجمالي: 530000 ريال',
    ]);
    expect(records.every((record) => record.sourceLineIndexes.length === 2)).toBe(true);
  });

  it('supports value/title before an RTL label', () => {
    const records = assembleLogicalLines([
      line('رفع جودة البرامج', 0),
      line('الهدف الفرعي الأول', 1),
      line('نسبة إنجاز البرامج', 2),
      line('المؤشر', 3),
    ]);
    expect(records.map((record) => record.normalized)).toEqual([
      'الهدف الفرعي الاول: رفع جودة البرامج',
      'المؤشر: نسبة انجاز البرامج',
    ]);
  });

  it('merges split headers, accepts reversed physical columns, and preserves cell references', () => {
    const rows = mapSemanticTableRows(enterprise242ProductionStructureFixture().tables);
    expect(rows[0]?.values).toMatchObject({
      amount: '120000',
      category: 'برامج تعليمية',
      responsible: 'الشؤون التعليمية',
      kpi: 'نسبة إنجاز المسار الأول',
      initiative: 'تنفيذ المسار الأول',
      objective: 'رفع جودة المسار الأول',
      code: '1',
    });
    expect(rows[0]?.sourceCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'amount', columnIndex: 0 }),
        expect.objectContaining({ role: 'objective', columnIndex: 7 }),
      ]),
    );
  });

  it('carries merged objective and category cells across table rows', () => {
    const rows = mapSemanticTableRows([
      {
        pageNumber: 1,
        tableIndex: 0,
        rows: [
          ['الهدف', 'البند', 'المبلغ'],
          ['هدف تشغيلي منقح', 'برامج', '100'],
          ['', '', '200'],
        ],
        confidence: 0.9,
        extractionMethod: 'test',
      },
    ]);
    expect(rows[1]?.values).toMatchObject({
      objective: 'هدف تشغيلي منقح',
      category: 'برامج',
      amount: '200',
    });
    expect(rows[1]?.sourceCells).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'objective', carriedFromRow: 1 }),
        expect.objectContaining({ role: 'category', carriedFromRow: 1 }),
      ]),
    );
  });
});

describe('Enterprise 24.2 sanitized production-structure acceptance', () => {
  it('produces the required evidence-backed records and correct summary inputs', () => {
    const proposals = extractOperationalSemanticProposals(
      enterprise242ProductionStructureFixture(),
    );
    const byType = (proposalType: string) =>
      proposals.filter((proposal) => proposal.proposalType === proposalType);

    expect(
      byType('BENEFICIARY_GROUP').map((proposal) => proposal.proposedData.totalCount),
    ).toEqual([390, 50, 29]);
    expect(byType('STRATEGIC_OBJECTIVE')).toHaveLength(4);
    expect(byType('KPI')).toHaveLength(4);
    expect(byType('INITIATIVE')).toHaveLength(4);
    expect(byType('BUDGET')).toHaveLength(1);
    expect(byType('BUDGET')[0]?.proposedData.totalPlanned).toBe(530000);
    expect(byType('BUDGET')[0]?.proposedData.currency).toBe('SAR');
    expect(byType('BUDGET_LINE')).toHaveLength(4);
    expect(
      byType('BUDGET_LINE').reduce(
        (total, proposal) => total + Number(proposal.proposedData.plannedAmount),
        0,
      ),
    ).toBe(530000);
    expect(proposals.every((proposal) => proposal.sourcePage && proposal.evidenceSnippet)).toBe(
      true,
    );
    expect(
      proposals.every(
        (proposal) =>
          Array.isArray(proposal.proposedData.sourceReferences) &&
          proposal.proposedData.sourceReferences.length > 0,
      ),
    ).toBe(true);
    expect(proposals.some((proposal) => proposal.title === 'الأهداف الفرعية - 2')).toBe(false);
  });
});
