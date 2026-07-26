import type { ExtractedPageData, InstitutionalExtractionInput } from '../types.js';

const page = (pageNumber: number, text: string): ExtractedPageData => ({
  pageNumber,
  rawText: text,
  text,
  hasEmbeddedText: true,
  quality: 0.95,
  tables: [],
});

/**
 * Sanitized structural reproduction of the production UAT-reported shape.
 *
 * It deliberately keeps only generic institutional labels and acceptance-test
 * numbers. It contains no confidential document prose, names, or file content.
 * It was not exported from an authenticated production analysis job.
 */
export const enterprise242ProductionStructureFixture = (): InstitutionalExtractionInput => ({
  documentType: 'OPERATIONAL_PLAN',
  pages: [
    page(
      1,
      [
        'خطة تشغيلية مؤسسية لعام 2026',
        'الفئة',
        'المستهدفة',
        '390 طالبًا وطالبة',
        '50',
        'من كبار السن',
        '29 معلمًا ومعلمة',
      ].join('\n'),
    ),
    page(
      2,
      [
        'الأهداف الفرعية',
        'يعرض هذا الجزء سجلات تشغيلية منقحة للاختبار فقط',
        '530000 ريال',
        'الإجمالي',
      ].join('\n'),
    ),
    page(3, 'الموازنة\nتفاصيل البنود في الجدول المنقح'),
  ],
  tables: [
    {
      pageNumber: 2,
      tableIndex: 0,
      rows: [
        [
          'الموازنة',
          'أوجه',
          'تاريخ',
          'تاريخ',
          'المسؤول',
          'مؤشرات',
          'خطة',
          'الهدف',
          'م',
        ],
        [
          'المقترحة',
          'الصرف',
          'الانتهاء',
          'البدء',
          'عن التنفيذ',
          'الإنجاز',
          'العمل',
          'الفرعي',
          '',
        ],
        [
          '120000',
          'برامج تعليمية',
          '2026/12/31',
          '2026/01/01',
          'الشؤون التعليمية',
          'نسبة إنجاز المسار الأول',
          'تنفيذ المسار الأول',
          'رفع جودة المسار الأول',
          '1',
        ],
        [
          '130000',
          'تنمية موارد',
          '2026/12/31',
          '2026/01/01',
          'تنمية الموارد',
          'نسبة إنجاز المسار الثاني',
          'تنفيذ المسار الثاني',
          'تعزيز استدامة المسار الثاني',
          '2',
        ],
        [
          '140000',
          'حوكمة',
          '2026/12/31',
          '2026/01/01',
          'الحوكمة',
          'نسبة إنجاز المسار الثالث',
          'تنفيذ المسار الثالث',
          'رفع امتثال المسار الثالث',
          '3',
        ],
        [
          '140000',
          'تشغيل',
          '2026/12/31',
          '2026/01/01',
          'الإدارة التنفيذية',
          'نسبة إنجاز المسار الرابع',
          'تنفيذ المسار الرابع',
          'تحسين كفاءة المسار الرابع',
          '4',
        ],
        ['530000', 'الإجمالي', '', '', '', '', '', '', ''],
      ],
      confidence: 0.94,
      extractionMethod: 'sanitized-uat-reported-structure',
    },
  ],
});
