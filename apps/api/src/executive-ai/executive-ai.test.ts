import { describe, expect, it, vi } from 'vitest';
import type { IdentityUser } from '../identity/types.js';
import type { IdentityStore } from '../identity/store.js';
import type { KnowledgeSearchResult } from '../knowledge/types.js';
import { ArabicExecutiveQueryPlanner } from './planner.js';
import { DiverseExecutiveEvidenceRanker } from './ranker.js';
import { ExecutiveAiReasoningService, IdentityAuditSink } from './service.js';
import { ProfessionalArabicExecutiveWritingProvider } from './synthesis.js';
import type { ExecutiveAiAuditSink, ExecutiveAiRetrievalGateway } from './types.js';

const user: IdentityUser = {
  id: '00000000-0000-0000-0000-000000000001',
  fullName: 'مدير تنفيذي',
  email: 'executive@example.test',
  passwordHash: 'not-returned',
  isActive: true,
  createdAt: new Date('2026-07-27T00:00:00Z'),
  updatedAt: new Date('2026-07-27T00:00:00Z'),
  roles: [],
};

const evidence = (
  documentId: string,
  title: string,
  excerpt: string,
  overrides: Partial<KnowledgeSearchResult> = {},
): KnowledgeSearchResult => ({
  documentId,
  documentVersionId: `${documentId}-version`,
  documentTitle: title,
  documentType: 'REPORT',
  owningDepartment: 'الإدارة التنفيذية',
  versionNumber: 1,
  pageNumber: 2,
  section: 'الملخص',
  excerpt,
  score: 0.74,
  sourceUrl: `/documents/${documentId}?page=2`,
  ...overrides,
});

describe('Enterprise 26 executive reasoning layer', () => {
  it('plans Arabic executive intents without changing the retrieval contract', () => {
    const planner = new ArabicExecutiveQueryPlanner();
    expect(planner.plan({ type: 'QUESTION', question: 'ما رؤية الجمعية؟' }).intent).toBe('VISION');
    expect(
      planner.plan({ type: 'QUESTION', question: 'ما المخاطر التي تهدد الخطة التشغيلية؟' }),
    ).toMatchObject({ intent: 'OPERATIONAL_RISKS', requiresDocumentDiversity: true });
    expect(
      planner.plan({ type: 'BOARD_REPORT', question: 'جهّز تقرير مجلس الإدارة' }).queries.length,
    ).toBeGreaterThan(3);
  });

  it('reranks evidence while preserving document diversity for broad questions', () => {
    const plan = new ArabicExecutiveQueryPlanner().plan({
      type: 'BOARD_REPORT',
      question: 'تقرير مجلس الإدارة',
    });
    const ranked = new DiverseExecutiveEvidenceRanker().rank(
      [
        evidence('doc-1', 'الخطة التشغيلية', 'تنفيذ الخطة ومؤشرات الأداء', { score: 0.91 }),
        evidence('doc-1', 'الخطة التشغيلية', 'مبادرة تشغيلية أخرى', {
          score: 0.9,
          pageNumber: 3,
        }),
        evidence('doc-2', 'التقرير المالي', 'الموازنة والأداء المالي', { score: 0.8 }),
      ],
      plan,
      3,
    );
    expect(ranked.slice(0, 2).map((item) => item.documentId)).toEqual(['doc-1', 'doc-2']);
  });

  it('refuses to answer or recommend when no reference exists', () => {
    const request = { type: 'QUESTION' as const, question: 'ما رؤية الجمعية؟' };
    const plan = new ArabicExecutiveQueryPlanner().plan(request);
    const response = new ProfessionalArabicExecutiveWritingProvider().synthesize(request, plan, []);
    expect(response.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(response.answer).toBe('');
    expect(response.sources).toEqual([]);
    expect(response.supportingReferences).toEqual([]);
    expect(response.executiveRecommendation).toBe('');
  });

  it('combines multiple documents in Board style and keeps quotations separate', () => {
    const request = { type: 'BOARD_REPORT' as const, question: 'أعد تقرير مجلس الإدارة' };
    const plan = new ArabicExecutiveQueryPlanner().plan(request);
    const ranked = new DiverseExecutiveEvidenceRanker().rank(
      [
        evidence('doc-1', 'الخطة الاستراتيجية', 'الرؤية والأهداف الاستراتيجية المعتمدة'),
        evidence('doc-2', 'التقرير المالي', 'عرض الموازنة والأداء المالي للفترة'),
        evidence('doc-3', 'سجل المخاطر', 'المخاطر التشغيلية وخطط المعالجة'),
      ],
      plan,
      8,
    );
    const response = new ProfessionalArabicExecutiveWritingProvider().synthesize(
      request,
      plan,
      ranked,
    );
    expect(response.status).toBe('ANSWERED');
    expect(response.evidence).toMatchObject({
      documentCount: 3,
      combinedMultipleDocuments: true,
    });
    expect(response.sources).toHaveLength(3);
    expect(response.writing.style).toBe('BOARD_OF_DIRECTORS');
    expect(response.answer).toContain('مذكرة مرفوعة إلى مجلس الإدارة');
    expect(response.answer).toContain('المسائل التي تستلزم نظر المجلس');
    expect(response.answer).toContain('[1]');
    expect(response.answer).toContain('[2]');
    expect(response.answer).toContain('[3]');
    expect(response.answer).not.toContain('الرؤية والأهداف الاستراتيجية المعتمدة');
    expect(response.supportingReferences.map((item) => item.quote)).toContain(
      'الرؤية والأهداف الاستراتيجية المعتمدة',
    );
  });

  it('produces an evidence-bound official Arabic letter', () => {
    const request = {
      type: 'OFFICIAL_LETTER' as const,
      question: 'اكتب خطابًا عن تنفيذ السياسة',
      recipient: 'الجهة المختصة',
      subject: 'تنفيذ السياسة المؤسسية',
    };
    const plan = new ArabicExecutiveQueryPlanner().plan(request);
    const ranked = new DiverseExecutiveEvidenceRanker().rank(
      [evidence('doc-1', 'السياسة المؤسسية', 'يلتزم المسؤول بتنفيذ الإجراء المعتمد')],
      plan,
      8,
    );
    const response = new ProfessionalArabicExecutiveWritingProvider().synthesize(
      request,
      plan,
      ranked,
    );
    expect(response.answer).toContain('إلى سعادة/ الجهة المختصة');
    expect(response.answer).toContain('الموضوع: تنفيذ السياسة المؤسسية');
    expect(response.answer).toContain('[1]');
    expect(response.writing.style).toBe('GOVERNMENT_CORRESPONDENCE');
  });

  it('never copies a document paragraph into the professionally rewritten answer', () => {
    const paragraph =
      'بلغ عدد المستفيدين من البرامج التعليمية ألفًا ومئتين وخمسين مستفيدًا خلال الربع الأول، وارتفعت نسبة إكمال البرنامج إلى 88٪ وفق التقرير المعتمد.';
    const request = { type: 'EXECUTIVE_REPORT' as const, question: 'اكتب تقرير الأداء' };
    const plan = new ArabicExecutiveQueryPlanner().plan(request);
    const ranked = new DiverseExecutiveEvidenceRanker().rank(
      [evidence('doc-1', 'تقرير الأداء', paragraph)],
      plan,
      8,
    );
    const response = new ProfessionalArabicExecutiveWritingProvider().synthesize(
      request,
      plan,
      ranked,
    );
    expect(response.answer).not.toContain(paragraph);
    expect(response.answer).toContain('1250');
    expect(response.answer).toContain('88٪');
    expect(response.supportingReferences).toEqual([
      expect.objectContaining({ reference: 1, quote: paragraph }),
    ]);
    expect(response.limitations[0]).toContain('صياغة تنفيذية أصلية');
  });

  it('preserves compound Arabic quantities without inventing a different value', () => {
    const paragraph =
      'بلغ نطاق المستفيدين مليونًا ومئتي ألف مستفيد، ونفذت البرامج خمسة آلاف ساعة تعليمية وفق السجل المعتمد.';
    const request = { type: 'EXECUTIVE_REPORT' as const, question: 'اكتب تقرير الأثر' };
    const plan = new ArabicExecutiveQueryPlanner().plan(request);
    const ranked = new DiverseExecutiveEvidenceRanker().rank(
      [evidence('doc-1', 'تقرير الأثر', paragraph)],
      plan,
      8,
    );
    const response = new ProfessionalArabicExecutiveWritingProvider().synthesize(
      request,
      plan,
      ranked,
    );

    expect(response.answer).toContain('1200000');
    expect(response.answer).toContain('5000');
    expect(response.answer).not.toContain('1001200');
    expect(response.answer).not.toContain(paragraph);
  });

  it('retains the substantive meaning as concepts instead of copying its sentence', () => {
    const sourceSentence =
      'ترتكز الرؤية على الريادة في تعليم القرآن وخدمة المجتمع من خلال برامج نوعية مستدامة.';
    const request = { type: 'QUESTION' as const, question: 'ما جوهر الرؤية المؤسسية؟' };
    const plan = new ArabicExecutiveQueryPlanner().plan(request);
    const ranked = new DiverseExecutiveEvidenceRanker().rank(
      [evidence('doc-1', 'الخطة الاستراتيجية', sourceSentence)],
      plan,
      8,
    );
    const response = new ProfessionalArabicExecutiveWritingProvider().synthesize(
      request,
      plan,
      ranked,
    );
    expect(response.answer).not.toContain(sourceSentence);
    expect(response.answer).toContain('الريادة');
    expect(response.answer).toContain('تعليم');
    expect(response.answer).toContain('القرآن');
    expect(response.supportingReferences[0]?.quote).toBe(sourceSentence);
  });

  it.each([
    ['QUESTION', 'CEO', 'الخلاصة التنفيذية'],
    ['BOARD_REPORT', 'BOARD_OF_DIRECTORS', 'المسائل التي تستلزم نظر المجلس'],
    ['CEO_RECOMMENDATIONS', 'RECOMMENDATIONS', 'التوصيات المقترحة'],
    ['OFFICIAL_LETTER', 'GOVERNMENT_CORRESPONDENCE', 'السلام عليكم ورحمة الله وبركاته'],
    ['DONOR_PROPOSAL', 'DONOR_PROPOSAL', 'مبررات التدخل'],
    ['MEETING_MINUTES', 'MEETING_MINUTES', 'القرارات المقترحة للتوثيق'],
    ['EXECUTIVE_REPORT', 'EXECUTIVE_REPORT', 'الأولويات الإدارية'],
    ['DECISION', 'DECISION', 'يُقترح ما يأتي'],
    ['ACTION_PLAN', 'ACTION_PLAN', 'حزم العمل'],
  ] as const)(
    'writes %s in its professional Arabic profile',
    (type, expectedStyle, expectedHeading) => {
      const request = {
        type,
        question: 'معالجة الأداء والمخاطر المؤسسية',
        ...(type === 'OFFICIAL_LETTER'
          ? { recipient: 'الجهة المختصة', subject: 'متابعة الأداء المؤسسي' }
          : {}),
      };
      const plan = new ArabicExecutiveQueryPlanner().plan(request);
      const ranked = new DiverseExecutiveEvidenceRanker().rank(
        [
          evidence(
            'doc-1',
            'تقرير الأداء المؤسسي',
            'تتطلب مؤشرات الأداء معالجة المخاطر التشغيلية ومتابعة المبادرات.',
          ),
        ],
        plan,
        8,
      );
      const response = new ProfessionalArabicExecutiveWritingProvider().synthesize(
        request,
        plan,
        ranked,
      );
      expect(response.writing).toMatchObject({
        style: expectedStyle,
        method: 'PROFESSIONAL_REWRITE',
      });
      expect(response.answer).toContain(expectedHeading);
      expect(response.supportingReferences).toHaveLength(1);
    },
  );

  it('plans all Enterprise 26.1 writing modes without altering the retrieval gateway', () => {
    const planner = new ArabicExecutiveQueryPlanner();
    expect(planner.plan({ type: 'DONOR_PROPOSAL', question: 'مقترح للمانح' }).intent).toBe(
      'DONOR_PROPOSAL',
    );
    expect(planner.plan({ type: 'MEETING_MINUTES', question: 'محضر اللجنة' }).intent).toBe(
      'MEETING_MINUTES',
    );
    expect(planner.plan({ type: 'EXECUTIVE_REPORT', question: 'تقرير الأداء' }).intent).toBe(
      'EXECUTIVE_REPORT',
    );
    expect(planner.plan({ type: 'DECISION', question: 'اعتماد المبادرة' }).intent).toBe('DECISION');
    expect(planner.plan({ type: 'ACTION_PLAN', question: 'تنفيذ المبادرة' }).intent).toBe(
      'ACTION_PLAN',
    );
  });

  it('audits only hashed query metadata after retrieval and synthesis', async () => {
    const retrieve = vi.fn<ExecutiveAiRetrievalGateway['retrieve']>(async () => [
      evidence('doc-1', 'الخطة الاستراتيجية', 'رؤية الجمعية وتوجهها المؤسسي'),
    ]);
    const record = vi.fn<ExecutiveAiAuditSink['record']>(async () => undefined);
    const service = new ExecutiveAiReasoningService(
      { retrieve } satisfies ExecutiveAiRetrievalGateway,
      { record } satisfies ExecutiveAiAuditSink,
    );
    const response = await service.execute(
      { type: 'QUESTION', question: 'ما رؤية الجمعية؟' },
      user,
      { ipAddress: '127.0.0.1' },
    );
    expect(response.status).toBe('ANSWERED');
    expect(retrieve).toHaveBeenCalled();
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0]?.[0].request.question).toBe('ما رؤية الجمعية؟');
    expect(response.sources[0]?.sourceUrl).toBe('/documents/doc-1?page=2');
  });

  it('does not persist the raw question, answer, or evidence in the common audit log', async () => {
    const createAudit = vi.fn<IdentityStore['createAudit']>(async () => undefined);
    const sink = new IdentityAuditSink({
      createAudit,
    } as unknown as IdentityStore);
    await sink.record({
      user,
      request: { type: 'QUESTION', question: 'سؤال مؤسسي خاص للاختبار' },
      response: {
        version: '26.1.0',
        status: 'ANSWERED',
        requestType: 'QUESTION',
        intent: 'GENERAL',
        answer: 'إجابة حساسة [1]',
        executiveRecommendation: 'توصية حساسة [1]',
        sources: [],
        supportingReferences: [],
        writing: {
          style: 'CEO',
          audience: 'الرئيس التنفيذي',
          purpose: 'إحاطة',
          method: 'PROFESSIONAL_REWRITE',
        },
        evidence: { chunkCount: 1, documentCount: 1, combinedMultipleDocuments: false },
        limitations: [],
      },
      durationMs: 8,
      context: {},
    });
    const entry = createAudit.mock.calls[0]?.[0];
    expect(entry?.metadata?.questionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(entry)).not.toContain('سؤال مؤسسي خاص للاختبار');
    expect(JSON.stringify(entry)).not.toContain('إجابة حساسة');
    expect(JSON.stringify(entry)).not.toContain('توصية حساسة');
  });
});
