import type { KnowledgeSourceReference } from '../knowledge/types.js';
import {
  EXECUTIVE_AI_VERSION,
  type ExecutiveAiQueryPlan,
  type ExecutiveAiRequest,
  type ExecutiveAiResponse,
  type ExecutiveAiSynthesisProvider,
  type RankedExecutiveEvidence,
} from './types.js';

const excerpt = (value: string, maximum = 360) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum).trimEnd()}…`;
};

const sourcesFor = (evidence: RankedExecutiveEvidence[]): KnowledgeSourceReference[] =>
  evidence.map((item, index) => ({
    documentId: item.documentId,
    documentVersionId: item.documentVersionId,
    documentTitle: item.documentTitle,
    documentType: item.documentType,
    owningDepartment: item.owningDepartment,
    versionNumber: item.versionNumber,
    ...(item.pageNumber ? { pageNumber: item.pageNumber } : {}),
    ...(item.section ? { section: item.section } : {}),
    excerpt: item.excerpt,
    score: item.score,
    sourceUrl: item.sourceUrl,
    reference: index + 1,
  }));

const evidenceLines = (sources: KnowledgeSourceReference[], maximum = 6) =>
  sources.slice(0, maximum).map((source) => `• ${excerpt(source.excerpt)} [${source.reference}]`);

const recommendations = (sources: KnowledgeSourceReference[], maximum = 4) =>
  sources
    .slice(0, maximum)
    .map(
      (source) =>
        `• اعتماد مراجعة تنفيذية للنقطة الواردة في «${source.documentTitle}»، وتحديد المسؤول والإجراء والموعد قبل اتخاذ القرار. [${source.reference}]`,
    );

const titleForIntent: Record<ExecutiveAiQueryPlan['intent'], string> = {
  VISION: 'رؤية الجمعية',
  MISSION: 'رسالة الجمعية',
  BENEFICIARIES: 'المستفيدون والفئات المستهدفة',
  STRATEGIC_OBJECTIVES: 'الأهداف الاستراتيجية',
  OPERATIONAL_RISKS: 'مخاطر الخطة التشغيلية',
  BOARD_REPORT: 'تقرير مجلس الإدارة',
  CEO_RECOMMENDATIONS: 'توصيات الرئيس التنفيذي',
  OFFICIAL_LETTER: 'خطاب رسمي موثق',
  GENERAL: 'الإجابة التنفيذية',
};

const insufficient = (
  request: ExecutiveAiRequest,
  plan: ExecutiveAiQueryPlan,
): ExecutiveAiResponse => ({
  version: EXECUTIVE_AI_VERSION,
  status: 'INSUFFICIENT_EVIDENCE',
  requestType: request.type,
  intent: plan.intent,
  answer: '',
  executiveRecommendation: '',
  sources: [],
  evidence: { chunkCount: 0, documentCount: 0, combinedMultipleDocuments: false },
  limitations: [
    'يحظر النظام إنشاء إجابة أو توصية بلا دليل مؤسسي قابل للفتح.',
    'عدم كفاية الأدلة لا يعني عدم وجود المعلومة في المستندات غير المفهرسة.',
  ],
});

const synthesizeBoardReport = (sources: KnowledgeSourceReference[]) => {
  const lines = evidenceLines(sources, 8);
  return [
    'تقرير موجز لمجلس الإدارة',
    '',
    'الملخص التنفيذي',
    ...lines,
    '',
    'نقاط تستلزم نظر المجلس',
    ...recommendations(sources, 4),
  ].join('\n');
};

const synthesizeLetter = (request: ExecutiveAiRequest, sources: KnowledgeSourceReference[]) => {
  const recipient = request.recipient?.trim() || 'الجهة المعنية';
  const subject = request.subject?.trim() || request.question;
  return [
    `إلى: ${recipient}`,
    `الموضوع: ${subject}`,
    '',
    'السلام عليكم ورحمة الله وبركاته، وبعد:',
    '',
    'إشارةً إلى الوثائق المؤسسية المعتمدة ذات الصلة، نفيدكم بالآتي:',
    ...evidenceLines(sources, 5),
    '',
    `وعليه، نأمل التكرم باتخاذ ما يلزم في ضوء ما ورد أعلاه والرجوع إلى المراجع المرفقة. [${sources[0]?.reference ?? 1}]`,
    '',
    'وتفضلوا بقبول خالص التحية والتقدير.',
  ].join('\n');
};

export class EvidenceBoundExecutiveSynthesisProvider implements ExecutiveAiSynthesisProvider {
  synthesize(
    request: ExecutiveAiRequest,
    plan: ExecutiveAiQueryPlan,
    evidence: RankedExecutiveEvidence[],
  ): ExecutiveAiResponse {
    if (evidence.length === 0) return insufficient(request, plan);
    const sources = sourcesFor(evidence);
    const answer =
      request.type === 'BOARD_REPORT'
        ? synthesizeBoardReport(sources)
        : request.type === 'CEO_RECOMMENDATIONS'
          ? ['توصيات تنفيذية مقترحة', ...recommendations(sources, 6)].join('\n')
          : request.type === 'OFFICIAL_LETTER'
            ? synthesizeLetter(request, sources)
            : [titleForIntent[plan.intent], '', ...evidenceLines(sources, 6)].join('\n');
    const executiveRecommendation =
      request.type === 'CEO_RECOMMENDATIONS'
        ? recommendations(sources, 4).join('\n')
        : `توصية تنفيذية: التحقق من سياق المراجع أدناه وتكليف مالك واضح بالإجراء التالي قبل اعتماد القرار. [${sources[0]?.reference ?? 1}]`;
    const documentCount = new Set(sources.map((source) => source.documentId)).size;
    return {
      version: EXECUTIVE_AI_VERSION,
      status: 'ANSWERED',
      requestType: request.type,
      intent: plan.intent,
      answer,
      executiveRecommendation,
      sources,
      evidence: {
        chunkCount: sources.length,
        documentCount,
        combinedMultipleDocuments: documentCount > 1,
      },
      limitations: [
        'هذه صياغة تنفيذية محلية مقيدة حرفيًا بالأدلة المسترجعة، وليست بديلًا عن مراجعة المستند الأصلي.',
        ...(plan.requiresDocumentDiversity && documentCount < 2
          ? [
              'لم تتوفر أدلة كافية من أكثر من مستند؛ تظهر النتيجة المتاحة دون ادعاء دمج متعدد المصادر.',
            ]
          : []),
      ],
    };
  }
}
