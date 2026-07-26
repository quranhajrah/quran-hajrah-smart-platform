import { describe, expect, it } from 'vitest';
import { PdfTextExtractionProvider } from './providers.js';
import { InstitutionalExtractionService } from './rules.js';
import type { AnalysisPipelineStage } from './types.js';

const createOperationalPlanPdf = (pageTexts: string[]) => {
  const pageObjectNumbers = pageTexts.map((_, index) => 3 + index * 2);
  const fontObjectNumber = 3 + pageTexts.length * 2;
  const toUnicodeObjectNumber = fontObjectNumber + 1;
  const lastObjectNumber = toUnicodeObjectNumber;
  const objects = new Map<number, string>();
  const characters = [...new Set(pageTexts.join('\n'))];
  const characterCodes = new Map(
    characters.map((character, index) => [character, index + 33] as const),
  );
  const encodedHex = (value: string) =>
    [...value]
      .map((character) => characterCodes.get(character)!.toString(16).padStart(2, '0'))
      .join('');

  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`,
  );

  pageTexts.forEach((text, index) => {
    const pageNumber = pageObjectNumbers[index]!;
    const contentNumber = pageNumber + 1;
    const lines = text.split('\n');
    const content = [
      'BT',
      '/F1 12 Tf',
      '72 760 Td',
      ...lines.flatMap((line, lineIndex) => [
        ...(lineIndex > 0 ? ['0 -20 Td'] : []),
        `<${encodedHex(line)}> Tj`,
      ]),
      'ET',
    ].join('\n');
    objects.set(
      pageNumber,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontObjectNumber} 0 R >> >> /Contents ${contentNumber} 0 R >>`,
    );
    objects.set(
      contentNumber,
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  });

  objects.set(
    fontObjectNumber,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /ToUnicode ${toUnicodeObjectNumber} 0 R >>`,
  );

  const unicodeMap = [
    '/CIDInit /ProcSet findresource begin',
    '12 dict begin',
    'begincmap',
    '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
    '/CMapName /InstitutionalArabic-UCS def',
    '/CMapType 2 def',
    '1 begincodespacerange',
    '<00> <FF>',
    'endcodespacerange',
    `${characters.length} beginbfchar`,
    ...characters.map((character) => {
      const source = characterCodes.get(character)!.toString(16).padStart(2, '0');
      const destination = character.codePointAt(0)!.toString(16).padStart(4, '0');
      return `<${source}> <${destination}>`;
    }),
    'endbfchar',
    'endcmap',
    'CMapName currentdict /CMap defineresource pop',
    'end',
    'end',
  ].join('\n');
  objects.set(
    toUnicodeObjectNumber,
    `<< /Length ${Buffer.byteLength(unicodeMap)} >>\nstream\n${unicodeMap}\nendstream`,
  );

  let output = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let objectNumber = 1; objectNumber <= lastObjectNumber; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(output, 'binary');
    output += `${objectNumber} 0 obj\n${objects.get(objectNumber)}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(output, 'binary');
  output += `xref\n0 ${lastObjectNumber + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let objectNumber = 1; objectNumber <= lastObjectNumber; objectNumber += 1) {
    output += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${lastObjectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'binary');
};

describe('operational plan PDF production pipeline fixture', () => {
  it('extracts pages and generates evidence-backed proposals', async () => {
    const pdf = createOperationalPlanPdf([
      [
        'الخطة التشغيلية والموازنة لعام 2026',
        'الهدف التشغيلي: رفع جودة البرامج التعليمية',
        'المؤشر: نسبة إنجاز البرامج التعليمية',
        'المسؤول عن التنفيذ: الشؤون التعليمية',
      ].join('\n'),
      [
        'الهدف التشغيلي: تنمية الموارد المالية',
        'المبادرة: تطوير برنامج الاستدامة',
        'تاريخ البدء: 2026/01/01',
        'تاريخ الانتهاء: 2026/12/31',
      ].join('\n'),
      [
        'الهدف التشغيلي: تعزيز الحوكمة',
        'الفئة المستهدفة: المستفيدون العدد: 120',
        'المؤشر: نسبة الالتزام بالسياسات',
      ].join('\n'),
      [
        'الهدف التشغيلي: تحسين الكفاءة التشغيلية',
        'إجمالي الموازنة: 1,500,000 ريال',
        'الموازنة المقترحة: 1,500,000 ريال',
      ].join('\n'),
    ]);
    const stages: AnalysisPipelineStage[] = [];
    const provider = new PdfTextExtractionProvider();
    const extraction = await provider.extractDocument({
      fileName: 'الخطة التشغيلية والموازنة لعام 2026.pdf',
      mimeType: 'application/pdf',
      data: pdf,
      maximumBytes: 5_000_000,
      maximumPages: 20,
      maximumTables: 20,
      reportStage: (stage) => stages.push(stage),
    });
    const proposals = new InstitutionalExtractionService().extract({
      documentType: 'OPERATIONAL_PLAN',
      pages: extraction.pages,
      tables: provider.extractTables(extraction.pages, 20),
    });

    expect(stages).toEqual(['pdf_parsing', 'text_extraction']);
    expect(extraction.pages).toHaveLength(4);
    expect(extraction.pages.every((page) => page.text.length > 0)).toBe(true);
    expect(
      proposals.filter((proposal) => proposal.proposalType === 'STRATEGIC_OBJECTIVE'),
    ).toHaveLength(4);
    expect(proposals.some((proposal) => proposal.proposalType === 'KPI')).toBe(true);
    expect(proposals.some((proposal) => proposal.proposalType === 'INITIATIVE')).toBe(true);
    expect(proposals.some((proposal) => proposal.proposalType === 'BUDGET')).toBe(true);
    expect(proposals.some((proposal) => proposal.proposalType === 'BENEFICIARY_GROUP')).toBe(true);
    expect(
      proposals.every(
        (proposal) =>
          proposal.sourcePage !== undefined &&
          proposal.evidenceSnippet !== undefined &&
          proposal.evidenceSnippet.length > 0,
      ),
    ).toBe(true);
  });
});
