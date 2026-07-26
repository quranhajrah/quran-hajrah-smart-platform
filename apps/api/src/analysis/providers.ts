import path from 'node:path';
import mammoth from 'mammoth';
import { AppError } from '../http.js';
import type {
  DocumentExtractionInput,
  DocumentExtractionResult,
  DocumentTextExtractionProvider,
  ExtractedPageData,
  ExtractedTableData,
  PositionedTextItem,
} from './types.js';

const pdfMime = 'application/pdf';
const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const textMimes = new Set(['text/plain']);

const institutionalArabicMarkers = [
  'الهدف',
  'المؤشر',
  'الموازنة',
  'المسؤول',
  'المبادرة',
  'تاريخ',
  'الفئة',
  'الإجمالي',
];
const reverseCharacters = (value: string) => [...value].reverse().join('');

export const repairVisualArabicOrder = (input: string) => {
  const normalMarkers = institutionalArabicMarkers.filter((marker) =>
    input.includes(marker),
  ).length;
  const reversedMarkers = institutionalArabicMarkers.filter((marker) =>
    input.includes(reverseCharacters(marker)),
  ).length;
  if (reversedMarkers <= normalMarkers || reversedMarkers < 2) return input;
  return input
    .replace(/[\u0600-\u06ff]+/g, reverseCharacters)
    .replace(/(^|\s):([\u0600-\u06ff]+)/gm, '$1$2:');
};

export const normalizeInstitutionalText = (input: string) =>
  repairVisualArabicOrder(
    input
      .normalize('NFC')
      .replaceAll('\u00a0', ' ')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );

const ensureLimits = (input: DocumentExtractionInput) => {
  if (input.data.byteLength === 0) {
    throw new AppError(400, 'الملف فارغ ولا يمكن تحليله.', 'ANALYSIS_FILE_EMPTY');
  }
  if (input.data.byteLength > input.maximumBytes) {
    throw new AppError(413, 'حجم الملف يتجاوز حد التحليل المسموح.', 'ANALYSIS_FILE_TOO_LARGE');
  }
};

export const validateOfficeArchive = (data: Buffer, compressedLimit: number) => {
  const centralDirectorySignature = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  const maximumUncompressedBytes = Math.min(
    250 * 1024 * 1024,
    Math.max(compressedLimit * 20, 20 * 1024 * 1024),
  );
  let offset = 0;
  let entries = 0;
  let uncompressedBytes = 0;
  while (offset < data.length) {
    const entryOffset = data.indexOf(centralDirectorySignature, offset);
    if (entryOffset < 0) break;
    if (entryOffset + 46 > data.length) {
      throw new AppError(422, 'بنية ملف DOCX غير صالحة.', 'ANALYSIS_DOCX_MALFORMED');
    }
    const flags = data.readUInt16LE(entryOffset + 8);
    const uncompressedSize = data.readUInt32LE(entryOffset + 24);
    const fileNameLength = data.readUInt16LE(entryOffset + 28);
    const extraLength = data.readUInt16LE(entryOffset + 30);
    const commentLength = data.readUInt16LE(entryOffset + 32);
    if ((flags & 1) === 1) {
      throw new AppError(422, 'ملف DOCX مشفر ولا يمكن تحليله.', 'ANALYSIS_DOCX_ENCRYPTED');
    }
    entries += 1;
    uncompressedBytes += uncompressedSize;
    if (entries > 5000 || uncompressedBytes > maximumUncompressedBytes) {
      throw new AppError(
        422,
        'تم رفض ملف DOCX لأن محتواه المضغوط يتجاوز حدود المعالجة الآمنة.',
        'ANALYSIS_ARCHIVE_LIMIT',
      );
    }
    offset = entryOffset + 46 + fileNameLength + extraLength + commentLength;
  }
};

const groupPositionedRows = (items: PositionedTextItem[]) => {
  const rows: PositionedTextItem[][] = [];
  for (const item of [...items].sort((left, right) => right.y - left.y || left.x - right.x)) {
    const row = rows.find(
      (candidate) => candidate.length > 0 && Math.abs(candidate[0]!.y - item.y) <= 3,
    );
    if (row) row.push(item);
    else rows.push([item]);
  }
  return rows.map((row) => row.sort((left, right) => left.x - right.x));
};

const columnsAreConsistent = (first: PositionedTextItem[], second: PositionedTextItem[]) => {
  if (first.length !== second.length || first.length < 2) return false;
  return first.every((item, index) => Math.abs(item.x - second[index]!.x) <= 30);
};

export const detectPositionedTables = (
  pageNumber: number,
  items: PositionedTextItem[],
  maximumTables: number,
): ExtractedTableData[] => {
  const rows = groupPositionedRows(items).filter((row) => row.length >= 2 && row.length <= 12);
  const groups: PositionedTextItem[][][] = [];
  for (const row of rows) {
    const current = groups.at(-1);
    if (current?.length && columnsAreConsistent(current.at(-1)!, row)) current.push(row);
    else groups.push([row]);
  }
  return groups
    .filter((rowsInTable) => rowsInTable.length >= 2)
    .slice(0, maximumTables)
    .map((rowsInTable, tableIndex) => ({
      pageNumber,
      tableIndex,
      rows: rowsInTable.map((row) => row.map((item) => normalizeInstitutionalText(item.text))),
      confidence: Math.min(0.95, 0.65 + rowsInTable.length * 0.03),
      extractionMethod: 'pdf-positioned-text-v1',
    }));
};

export class PdfTextExtractionProvider implements DocumentTextExtractionProvider {
  readonly name = 'pdfjs';
  readonly version = '5.4';

  canHandle(input: Pick<DocumentExtractionInput, 'fileName' | 'mimeType'>) {
    return input.mimeType === pdfMime || path.extname(input.fileName).toLowerCase() === '.pdf';
  }

  async extractDocument(input: DocumentExtractionInput): Promise<DocumentExtractionResult> {
    const pages = await this.extractPages(input);
    return {
      provider: this.name,
      providerVersion: this.version,
      extractionMethod: 'embedded-pdf-text',
      pages,
      metadata: {
        pageCount: pages.length,
        tableCount: pages.reduce((total, page) => total + page.tables.length, 0),
        encrypted: false,
      },
    };
  }

  async extractPages(input: DocumentExtractionInput) {
    ensureLimits(input);
    try {
      input.reportStage?.('pdf_parsing');
      // Keep the sizeable parser off the server startup path. Hostinger must be
      // able to listen immediately; PDF.js is loaded only for an explicit job.
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const task = getDocument({
        data: new Uint8Array(input.data),
        useSystemFonts: true,
        // Real institutional PDFs frequently contain recoverable font/xref defects.
        // PDF.js remains responsible for rejecting genuinely unreadable documents.
        stopAtErrors: false,
      });
      const pdf = await task.promise;
      if (pdf.numPages > input.maximumPages) {
        await pdf.destroy();
        throw new AppError(
          422,
          `عدد صفحات الملف يتجاوز الحد المسموح (${input.maximumPages}).`,
          'ANALYSIS_PAGE_LIMIT',
        );
      }
      const pages: ExtractedPageData[] = [];
      let remainingTables = input.maximumTables;
      input.reportStage?.('text_extraction');
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent({
          disableNormalization: false,
          includeMarkedContent: false,
        });
        const positionedItems = content.items
          .flatMap((item): PositionedTextItem[] => {
            if (!('str' in item)) return [];
            return [
              {
                text: String(item.str),
                x: Number(item.transform[4] ?? 0),
                y: Number(item.transform[5] ?? 0),
                width: Number(item.width),
                height: Number(item.height),
              },
            ];
          })
          .filter((item) => item.text.trim().length > 0);
        const rows = groupPositionedRows(positionedItems);
        const text = normalizeInstitutionalText(
          rows.map((row) => row.map((item) => item.text).join(' ')).join('\n'),
        );
        const tables = detectPositionedTables(pageNumber, positionedItems, remainingTables);
        remainingTables -= tables.length;
        pages.push({
          pageNumber,
          text,
          hasEmbeddedText: text.length > 0,
          width: viewport.width,
          height: viewport.height,
          quality: text.length === 0 ? 0 : Math.min(1, text.length / 500),
          positionedItems,
          tables,
        });
        page.cleanup();
      }
      await pdf.destroy();
      return pages;
    } catch (error) {
      if (error instanceof AppError) throw error;
      const name = error instanceof Error ? error.name : '';
      const message = error instanceof Error ? error.message : '';
      if (/password/i.test(`${name} ${message}`)) {
        throw new AppError(
          422,
          'ملف PDF مشفّر أو محمي بكلمة مرور ولا يمكن استخراجه.',
          'ANALYSIS_PDF_ENCRYPTED',
        );
      }
      throw new AppError(
        422,
        'ملف PDF تالف أو غير قابل للاستخراج النصي.',
        'ANALYSIS_PDF_MALFORMED',
      );
    }
  }

  extractTables(pages: ExtractedPageData[], maximumTables: number) {
    return pages.flatMap((page) => page.tables).slice(0, maximumTables);
  }

  getMetadata(result: DocumentExtractionResult) {
    return result.metadata;
  }
}

const decodeHtml = (value: string) =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));

const textFromHtml = (value: string) =>
  normalizeInstitutionalText(decodeHtml(value.replace(/<[^>]+>/g, ' ')));

export const extractTablesFromMammothHtml = (
  html: string,
  maximumTables: number,
): ExtractedTableData[] =>
  [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .slice(0, maximumTables)
    .map((tableMatch, tableIndex) => {
      const rows = [...String(tableMatch[1]).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
        .map((rowMatch) =>
          [...String(rowMatch[1]).matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) =>
            textFromHtml(String(cell[1])),
          ),
        )
        .filter((row) => row.some(Boolean));
      return {
        pageNumber: 1,
        tableIndex,
        rows,
        confidence: 0.95,
        extractionMethod: 'docx-xml-table-v1',
      };
    })
    .filter((table) => table.rows.length > 0);

export class DocxTextExtractionProvider implements DocumentTextExtractionProvider {
  readonly name = 'mammoth';
  readonly version = '1.12';

  canHandle(input: Pick<DocumentExtractionInput, 'fileName' | 'mimeType'>) {
    return input.mimeType === docxMime || path.extname(input.fileName).toLowerCase() === '.docx';
  }

  async extractDocument(input: DocumentExtractionInput): Promise<DocumentExtractionResult> {
    const pages = await this.extractPages(input);
    return {
      provider: this.name,
      providerVersion: this.version,
      extractionMethod: 'docx-openxml',
      pages,
      metadata: {
        pageCount: 1,
        tableCount: pages[0]?.tables.length ?? 0,
        pageBoundariesAvailable: false,
      },
    };
  }

  async extractPages(input: DocumentExtractionInput) {
    ensureLimits(input);
    validateOfficeArchive(input.data, input.maximumBytes);
    try {
      input.reportStage?.('text_extraction');
      const [textResult, htmlResult] = await Promise.all([
        mammoth.extractRawText({ buffer: input.data }),
        mammoth.convertToHtml(
          { buffer: input.data },
          {
            externalFileAccess: false,
            convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
          },
        ),
      ]);
      const text = normalizeInstitutionalText(textResult.value);
      return [
        {
          pageNumber: 1,
          text,
          hasEmbeddedText: text.length > 0,
          quality: text.length === 0 ? 0 : Math.min(1, text.length / 500),
          tables: extractTablesFromMammothHtml(htmlResult.value, input.maximumTables),
        },
      ];
    } catch {
      throw new AppError(422, 'ملف DOCX تالف أو غير قابل للاستخراج.', 'ANALYSIS_DOCX_MALFORMED');
    }
  }

  extractTables(pages: ExtractedPageData[], maximumTables: number) {
    return pages.flatMap((page) => page.tables).slice(0, maximumTables);
  }

  getMetadata(result: DocumentExtractionResult) {
    return result.metadata;
  }
}

export class TxtTextExtractionProvider implements DocumentTextExtractionProvider {
  readonly name = 'plain-text';
  readonly version = '1';

  canHandle(input: Pick<DocumentExtractionInput, 'fileName' | 'mimeType'>) {
    return textMimes.has(input.mimeType) || path.extname(input.fileName).toLowerCase() === '.txt';
  }

  async extractDocument(input: DocumentExtractionInput): Promise<DocumentExtractionResult> {
    const pages = await this.extractPages(input);
    return {
      provider: this.name,
      providerVersion: this.version,
      extractionMethod: 'utf8-text',
      pages,
      metadata: { pageCount: 1, tableCount: 0 },
    };
  }

  async extractPages(input: DocumentExtractionInput) {
    ensureLimits(input);
    input.reportStage?.('text_extraction');
    if (input.data.subarray(0, Math.min(input.data.length, 4096)).includes(0)) {
      throw new AppError(422, 'ملف TXT لا يحتوي نصًا صالحًا.', 'ANALYSIS_TEXT_MALFORMED');
    }
    const text = normalizeInstitutionalText(input.data.toString('utf8'));
    return [
      {
        pageNumber: 1,
        text,
        hasEmbeddedText: text.length > 0,
        quality: text.length === 0 ? 0 : 1,
        tables: [],
      },
    ];
  }

  extractTables() {
    return [];
  }

  getMetadata(result: DocumentExtractionResult) {
    return result.metadata;
  }
}

export class ExtractionProviderRegistry {
  constructor(
    readonly providers: DocumentTextExtractionProvider[] = [
      new PdfTextExtractionProvider(),
      new DocxTextExtractionProvider(),
      new TxtTextExtractionProvider(),
    ],
  ) {}

  resolve(input: Pick<DocumentExtractionInput, 'fileName' | 'mimeType'>) {
    const provider = this.providers.find((candidate) => candidate.canHandle(input));
    if (!provider) {
      throw new AppError(
        415,
        'نوع هذا الملف غير مدعوم للتحليل النصي في الإصدار الحالي.',
        'ANALYSIS_FILE_TYPE_UNSUPPORTED',
      );
    }
    return provider;
  }
}
