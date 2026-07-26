import { describe, expect, it } from 'vitest';
import {
  detectPositionedTables,
  DocxTextExtractionProvider,
  extractTablesFromMammothHtml,
  normalizeInstitutionalText,
  PdfTextExtractionProvider,
  reconstructPositionedPageText,
  repairVisualArabicOrder,
  validateOfficeArchive,
} from './providers.js';
import { InstitutionalExtractionService, parseInstitutionalNumber } from './rules.js';
import { hasSufficientEmbeddedText } from './service.js';
import type { ExtractedPageData } from './types.js';

const createPdf = (pageTexts: string[]) => {
  const pageObjectNumbers = pageTexts.map((_, index) => 3 + index * 2);
  const fontObjectNumber = 3 + pageTexts.length * 2;
  const objects = new Map<number, string>();
  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`,
  );
  pageTexts.forEach((text, index) => {
    const pageNumber = pageObjectNumbers[index]!;
    const contentNumber = pageNumber + 1;
    const escaped = text.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
    const content = `BT /F1 12 Tf 72 720 Td (${escaped}) Tj ET`;
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
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );

  let output = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [0];
  for (let objectNumber = 1; objectNumber <= fontObjectNumber; objectNumber += 1) {
    offsets[objectNumber] = Buffer.byteLength(output, 'binary');
    output += `${objectNumber} 0 obj\n${objects.get(objectNumber)}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(output, 'binary');
  output += `xref\n0 ${fontObjectNumber + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let objectNumber = 1; objectNumber <= fontObjectNumber; objectNumber += 1) {
    output += `${String(offsets[objectNumber]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${fontObjectNumber + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, 'binary');
};

const pages = (text: string): ExtractedPageData[] => [
  {
    pageNumber: 1,
    text,
    hasEmbeddedText: true,
    quality: 1,
    tables: [],
  },
];

describe('document text extraction providers', () => {
  it('preserves PDF page boundaries', async () => {
    const provider = new PdfTextExtractionProvider();
    const result = await provider.extractDocument({
      fileName: 'plan.pdf',
      mimeType: 'application/pdf',
      data: createPdf(['First objective', 'Second indicator']),
      maximumBytes: 1_000_000,
      maximumPages: 10,
      maximumTables: 10,
    });
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]?.text).toContain('First objective');
    expect(result.pages[1]?.text).toContain('Second indicator');
  });

  it('preserves positioned table row and cell order', () => {
    const result = detectPositionedTables(
      2,
      [
        { text: 'البند', x: 10, y: 100, width: 30, height: 10 },
        { text: 'القيمة', x: 120, y: 100, width: 30, height: 10 },
        { text: 'تعليم', x: 10, y: 80, width: 30, height: 10 },
        { text: '1000', x: 120, y: 80, width: 30, height: 10 },
      ],
      10,
    );
    expect(result[0]?.rows).toEqual([
      ['البند', 'القيمة'],
      ['تعليم', '1000'],
    ]);
  });

  it('extracts DOCX HTML table cells in source order', () => {
    expect(
      extractTablesFromMammothHtml(
        '<table><tr><th>البند</th><th>المبلغ</th></tr><tr><td>تعليم</td><td>100</td></tr></table>',
        10,
      )[0]?.rows,
    ).toEqual([
      ['البند', 'المبلغ'],
      ['تعليم', '100'],
    ]);
  });

  it('normalizes Arabic whitespace without altering commas or numeric values', () => {
    expect(normalizeInstitutionalText(' الهدف   العام،\r\n  القيمة  ١٬٠٠٠ ')).toBe(
      'الهدف العام،\nالقيمة ١٬٠٠٠',
    );
    expect(parseInstitutionalNumber('١٢٣٬٤٥٦')).toBe(123456);
  });

  it('repairs visually reversed institutional Arabic without changing logical Arabic', () => {
    expect(repairVisualArabicOrder('فدهلا يليغشتلا رشؤملا ةنزاوملا')).toBe(
      'الهدف التشغيلي المؤشر الموازنة',
    );
    expect(repairVisualArabicOrder('الهدف التشغيلي المؤشر الموازنة')).toBe(
      'الهدف التشغيلي المؤشر الموازنة',
    );
  });

  it('joins split Arabic glyphs and reconstructs RTL positioned words', () => {
    expect(normalizeInstitutionalText('ا ل ه د ف   ا ل ع ا م')).toBe('الهدف العام');
    expect(
      reconstructPositionedPageText([
        { text: 'البرامج', x: 20, y: 100, width: 45, height: 10 },
        { text: 'جودة', x: 90, y: 100, width: 30, height: 10 },
        { text: 'رفع', x: 140, y: 100, width: 20, height: 10 },
        { text: 'الهدف:', x: 180, y: 100, width: 40, height: 10 },
      ]),
    ).toBe('الهدف: رفع جودة البرامج');
  });

  it('detects image-only content as OCR-required input', () => {
    expect(hasSufficientEmbeddedText([{ text: '' }, { text: '  ' }], 80)).toBe(false);
    expect(hasSufficientEmbeddedText([{ text: 'نص مؤسسي كافٍ' }], 5)).toBe(true);
  });

  it('rejects a DOCX archive that declares unsafe decompressed content', () => {
    const centralDirectoryEntry = Buffer.alloc(46);
    centralDirectoryEntry.set([0x50, 0x4b, 0x01, 0x02], 0);
    centralDirectoryEntry.writeUInt32LE(250_000_000, 24);
    expect(() => validateOfficeArchive(centralDirectoryEntry, 1_000_000)).toThrow('محتواه المضغوط');
  });

  it('enforces the DOCX decompression limit before parsing', async () => {
    const centralDirectoryEntry = Buffer.alloc(46);
    centralDirectoryEntry.set([0x50, 0x4b, 0x01, 0x02], 0);
    centralDirectoryEntry.writeUInt32LE(250_000_000, 24);
    const provider = new DocxTextExtractionProvider();

    await expect(
      provider.extractDocument({
        fileName: 'unsafe.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        data: centralDirectoryEntry,
        maximumBytes: 1_000_000,
        maximumPages: 10,
        maximumTables: 10,
      }),
    ).rejects.toMatchObject({ code: 'ANALYSIS_ARCHIVE_LIMIT' });
  });
});

describe('deterministic institutional rules', () => {
  const service = new InstitutionalExtractionService();

  it('detects objectives, KPI, dates, departments, and beneficiary evidence', () => {
    const proposals = service.extract({
      documentType: 'OPERATIONAL_PLAN',
      pages: pages(
        [
          'الهدف التشغيلي: تعزيز جودة البرامج التعليمية',
          'المؤشر: نسبة إنجاز البرامج',
          'المبادرة: تأهيل المعلمين',
          'المسؤول عن التنفيذ: الشؤون التعليمية',
          'تاريخ البدء: 2026/01/01',
          'تاريخ الانتهاء: 2026/12/31',
          'الفئة المستهدفة: طلاب الحلقات العدد: ١٢٠',
        ].join('\n'),
      ),
      tables: [],
    });
    expect(proposals.some((item) => item.proposalType === 'STRATEGIC_OBJECTIVE')).toBe(true);
    expect(proposals.some((item) => item.proposalType === 'KPI')).toBe(true);
    expect(proposals.some((item) => item.proposalType === 'INITIATIVE')).toBe(true);
    expect(
      proposals.some(
        (item) =>
          item.proposalType === 'RESPONSIBLE_DEPARTMENT' ||
          item.proposedData.responsibleDepartment === 'الشؤون التعليمية',
      ),
    ).toBe(true);
    expect(proposals.some((item) => item.proposalType === 'DOCUMENT_DATE')).toBe(true);
    expect(proposals.some((item) => item.proposalType === 'BENEFICIARY_GROUP')).toBe(true);
    expect(proposals.every((item) => item.evidenceSnippet && item.sourcePage === 1)).toBe(true);
  });

  it('detects budget total and budget lines only from evidence', () => {
    const proposals = service.extract({
      documentType: 'OPERATIONAL_PLAN',
      pages: pages('إجمالي الموازنة: ١٬٥٠٠٬٠٠٠ ريال'),
      tables: [
        {
          pageNumber: 3,
          tableIndex: 0,
          rows: [
            ['البند', 'المبلغ'],
            ['البرامج التعليمية', '١٠٠٠٠٠'],
          ],
          confidence: 0.9,
          extractionMethod: 'test-table',
        },
      ],
    });
    expect(
      proposals.find((item) => item.proposalType === 'BUDGET')?.proposedData.totalPlanned,
    ).toBe(1500000);
    expect(
      proposals.find((item) => item.proposalType === 'BUDGET_LINE')?.proposedData.plannedAmount,
    ).toBe(100000);
  });

  it('returns no proposals when evidence is insufficient', () => {
    const proposals = service.extract({
      documentType: 'OPERATIONAL_PLAN',
      pages: pages('هذه مقدمة عامة لا تتضمن حقولًا مؤسسية قابلة للاستخراج.'),
      tables: [],
    });
    expect(proposals).toEqual([]);
  });
});
