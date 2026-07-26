import { describe, expect, it } from 'vitest';
import { StrategicPlanExtractor } from './rules.js';
import { extractStrategicSemanticProposals } from './semantic.js';
import type { ExtractedPageData, InstitutionalExtractionInput } from './types.js';

const page = (pageNumber: number, lines: string[]): ExtractedPageData => ({
  pageNumber,
  rawText: lines.join('\n'),
  text: lines.join('\n'),
  hasEmbeddedText: true,
  quality: 0.95,
  tables: [],
});

const input = (...pages: ExtractedPageData[]): InstitutionalExtractionInput => ({
  documentType: 'STRATEGIC_PLAN',
  pages,
  tables: [],
});

describe('Enterprise 24.2.1 strategic-axis reconstruction', () => {
  it('joins a split axis label, ordinal, and continuation title with source references', () => {
    const proposals = extractStrategicSemanticProposals(
      input(page(2, ['المحور', 'الأول', 'التميز في التعليم', 'القرآني المؤسسي'])),
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({
      proposalType: 'OTHER',
      title: 'التميز في التعليم القرآني المؤسسي',
      sourcePage: 2,
      evidenceSnippet: 'المحور | الأول | التميز في التعليم | القرآني المؤسسي',
    });
    expect(proposals[0]?.proposedData).toMatchObject({
      strategicAxis: 'التميز في التعليم القرآني المؤسسي',
      sequenceNumber: 1,
      sourceReferences: ['page:2/line:1', 'page:2/line:2', 'page:2/line:3', 'page:2/line:4'],
    });
  });

  it('supports an axis ordinal after a multiline title', () => {
    const proposals = extractStrategicSemanticProposals(
      input(page(3, ['الاستدامة المالية', 'وتنمية الموارد', 'المحور الثالث'])),
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.title).toBe('الاستدامة المالية وتنمية الموارد');
    expect(proposals[0]?.proposedData.sequenceNumber).toBe(3);
  });

  it('rejects ordinal-only strategic-axis proposals in the full strategic extractor', () => {
    const proposals = new StrategicPlanExtractor().extract(
      input(page(1, ['المحور الأول', 'المحور الثاني', 'المحور الثالث', 'المحور الرابع'])),
    );

    expect(
      proposals.filter((proposal) => proposal.extractionRuleId === 'section.strategic_axis.v1'),
    ).toHaveLength(0);
    expect(
      proposals.some((proposal) =>
        ['الأول', 'الثاني', 'الثالث', 'الرابع'].includes(proposal.title),
      ),
    ).toBe(false);
  });

  it('extracts a complete title when the ordinal precedes it on the same logical line', () => {
    const proposals = extractStrategicSemanticProposals(
      input(page(4, ['المحور الرابع: الحوكمة والتميز المؤسسي'])),
    );

    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.title).toBe('الحوكمة والتميز المؤسسي');
    expect(proposals[0]?.evidenceSnippet).toContain('الحوكمة والتميز المؤسسي');
  });
});
