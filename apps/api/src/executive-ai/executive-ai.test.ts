import { describe, expect, it, vi } from 'vitest';
import type { IdentityUser } from '../identity/types.js';
import type { IdentityStore } from '../identity/store.js';
import type { KnowledgeSearchResult } from '../knowledge/types.js';
import { ArabicExecutiveQueryPlanner } from './planner.js';
import { DiverseExecutiveEvidenceRanker } from './ranker.js';
import { ExecutiveAiReasoningService, IdentityAuditSink } from './service.js';
import { EvidenceBoundExecutiveSynthesisProvider } from './synthesis.js';
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
    const response = new EvidenceBoundExecutiveSynthesisProvider().synthesize(request, plan, []);
    expect(response.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(response.answer).toBe('');
    expect(response.sources).toEqual([]);
    expect(response.executiveRecommendation).toBe('');
  });

  it('combines multiple documents and cites every evidence statement', () => {
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
    const response = new EvidenceBoundExecutiveSynthesisProvider().synthesize(
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
    expect(response.answer).toContain('[1]');
    expect(response.answer).toContain('[2]');
    expect(response.answer).toContain('[3]');
    expect(
      response.answer
        .split('\n')
        .filter((line) => line.startsWith('•'))
        .every((line) => /\[\d+\]$/.test(line)),
    ).toBe(true);
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
    const response = new EvidenceBoundExecutiveSynthesisProvider().synthesize(
      request,
      plan,
      ranked,
    );
    expect(response.answer).toContain('إلى: الجهة المختصة');
    expect(response.answer).toContain('الموضوع: تنفيذ السياسة المؤسسية');
    expect(response.answer).toContain('[1]');
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
        version: '26.0.0',
        status: 'ANSWERED',
        requestType: 'QUESTION',
        intent: 'GENERAL',
        answer: 'إجابة حساسة [1]',
        executiveRecommendation: 'توصية حساسة [1]',
        sources: [],
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
