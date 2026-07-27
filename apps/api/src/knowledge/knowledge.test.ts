import { describe, expect, it } from 'vitest';
import { buildKnowledgeChunks } from './chunking.js';
import {
  cosineSimilarity,
  knowledgeTerms,
  lexicalOverlap,
  LocalArabicHybridEmbeddingProvider,
  normalizeKnowledgeText,
} from './embedding.js';
import { ExtractiveKnowledgeAnswerComposer } from './service.js';

describe('Enterprise 25 institutional knowledge primitives', () => {
  const provider = new LocalArabicHybridEmbeddingProvider();

  it('normalizes Arabic variants without changing numeric evidence', () => {
    expect(normalizeKnowledgeText('إجمالي المُوازنة: ٥٣٠٬٠٠٠ ريال')).toContain('اجمالي');
    expect(normalizeKnowledgeText('إجمالي المُوازنة: 530000 ريال')).toContain('530000');
  });

  it('ranks related Arabic institutional text above unrelated text', () => {
    const query = provider.embed('الخطة التشغيلية ومؤشرات الأداء');
    const related = provider.embed('مؤشرات تنفيذ الخطة التشغيلية السنوية');
    const unrelated = provider.embed('سياسة كلمات المرور وحسابات المستخدمين');
    expect(cosineSimilarity(query, related)).toBeGreaterThan(cosineSimilarity(query, unrelated));
    expect(
      lexicalOverlap(
        knowledgeTerms('الخطة التشغيلية ومؤشرات الأداء'),
        knowledgeTerms('مؤشرات تنفيذ الخطة التشغيلية السنوية'),
      ),
    ).toBeGreaterThan(0);
  });

  it('creates bounded chunks while preserving page references', () => {
    const chunks = buildKnowledgeChunks(
      [
        { pageNumber: 1, section: 'الأهداف', text: 'هدف تشغيلي '.repeat(150) },
        { pageNumber: 2, section: 'الموازنة', text: 'بند الموازنة '.repeat(80) },
      ],
      200,
      40,
      provider,
    );
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((chunk) => chunk.pageNumber === 1 && chunk.section === 'الأهداف')).toBe(
      true,
    );
    expect(chunks.some((chunk) => chunk.pageNumber === 2 && chunk.section === 'الموازنة')).toBe(
      true,
    );
    expect(chunks.every((chunk) => chunk.embedding.length === provider.dimensions)).toBe(true);
    expect(new Set(chunks.map((chunk) => chunk.contentHash)).size).toBe(chunks.length);
  });

  it('never composes an answer without source references', () => {
    const composer = new ExtractiveKnowledgeAnswerComposer();
    const missing = composer.compose('ما الخطة؟', []);
    expect(missing.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(missing.sources).toEqual([]);

    const answered = composer.compose('ما الخطة؟', [
      {
        documentId: 'document-1',
        documentVersionId: 'version-1',
        documentTitle: 'الخطة التشغيلية',
        documentType: 'OPERATIONAL_PLAN',
        owningDepartment: 'الإدارة التنفيذية',
        versionNumber: 2,
        pageNumber: 4,
        section: 'الأهداف',
        excerpt: 'تنص الخطة التشغيلية على الهدف المدعوم بهذا النص.',
        score: 0.91,
        sourceUrl: '/documents/document-1?page=4',
      },
    ]);
    expect(answered.status).toBe('ANSWERED');
    expect(answered.answer).toContain('[1]');
    expect(answered.sources[0]).toMatchObject({
      reference: 1,
      documentId: 'document-1',
      pageNumber: 4,
    });
  });
});
