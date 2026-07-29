import type {
  ExecutiveAiIntent,
  ExecutiveAiQueryPlan,
  ExecutiveAiQueryPlanner,
  ExecutiveAiRequest,
} from './types.js';

const unique = (values: string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

const detectIntent = (request: ExecutiveAiRequest): ExecutiveAiIntent => {
  if (request.type === 'BOARD_REPORT') return 'BOARD_REPORT';
  if (request.type === 'CEO_RECOMMENDATIONS') return 'CEO_RECOMMENDATIONS';
  if (request.type === 'OFFICIAL_LETTER') return 'OFFICIAL_LETTER';
  if (request.type === 'DONOR_PROPOSAL') return 'DONOR_PROPOSAL';
  if (request.type === 'MEETING_MINUTES') return 'MEETING_MINUTES';
  if (request.type === 'EXECUTIVE_REPORT') return 'EXECUTIVE_REPORT';
  if (request.type === 'DECISION') return 'DECISION';
  if (request.type === 'ACTION_PLAN') return 'ACTION_PLAN';
  const question = request.question.toLocaleLowerCase('ar');
  if (/(رؤي(?:ة|تنا)|vision)/i.test(question)) return 'VISION';
  if (/(رسال(?:ة|تنا)|mission)/i.test(question)) return 'MISSION';
  if (/(مستفيد|مستفيدين|طلاب|طالبات|beneficiar)/i.test(question)) return 'BENEFICIARIES';
  if (/(أهداف?\s+(?:استراتيجية|استراتيجي)|strategic objectives?)/i.test(question))
    return 'STRATEGIC_OBJECTIVES';
  if (/(مخاطر?.*(?:تشغيل|خطة)|operational.*risk|risk.*operational)/i.test(question))
    return 'OPERATIONAL_RISKS';
  return 'GENERAL';
};

const intentQueries: Record<ExecutiveAiIntent, string[]> = {
  VISION: ['رؤية الجمعية', 'الرؤية والتوجه الاستراتيجي'],
  MISSION: ['رسالة الجمعية', 'الرسالة المؤسسية'],
  BENEFICIARIES: ['إجمالي المستفيدين والفئات المستهدفة', 'أعداد الطلاب والطالبات والمستفيدين'],
  STRATEGIC_OBJECTIVES: ['الأهداف الاستراتيجية', 'المحاور والغايات الاستراتيجية'],
  OPERATIONAL_RISKS: [
    'مخاطر الخطة التشغيلية',
    'المبادرات المتعثرة والمخاطر وخطط المعالجة',
    'المخاطر التشغيلية والضوابط',
  ],
  BOARD_REPORT: [
    'الرؤية والرسالة والأهداف الاستراتيجية',
    'مؤشرات الأداء والمستفيدون',
    'تنفيذ الخطة التشغيلية والمبادرات',
    'الموازنة والأداء المالي',
    'المخاطر والحوكمة والامتثال',
  ],
  CEO_RECOMMENDATIONS: [
    'مؤشرات الأداء المتعثرة والانحرافات',
    'المبادرات المتأخرة وخطط المعالجة',
    'المخاطر الحرجة والالتزامات',
    'الأداء المالي والموازنة',
  ],
  OFFICIAL_LETTER: ['السياسات والقرارات والبيانات المؤسسية ذات الصلة بالخطاب'],
  DONOR_PROPOSAL: [
    'الاحتياج المؤسسي والفئات المستفيدة والأثر المتوقع',
    'البرامج والمبادرات والنتائج ومؤشرات الأداء',
    'الموازنة والاستدامة والحوكمة والشراكات',
  ],
  MEETING_MINUTES: [
    'موضوع الاجتماع والقرارات السابقة',
    'الأداء والمبادرات والمخاطر والإجراءات المطلوبة',
    'المسؤوليات والمواعيد والمتابعة',
  ],
  EXECUTIVE_REPORT: [
    'ملخص الأداء التنفيذي والنتائج',
    'مؤشرات الأداء والمبادرات والموازنة',
    'المخاطر والقرارات والإجراءات التصحيحية',
  ],
  DECISION: [
    'السياسات واللوائح والصلاحيات ذات الصلة بالقرار',
    'الوقائع والمبررات والآثار التنفيذية',
    'المخاطر والضوابط والمسؤوليات',
  ],
  ACTION_PLAN: [
    'الأهداف والمبادرات والإجراءات التنفيذية',
    'مؤشرات الأداء والمسؤوليات والمواعيد',
    'المخاطر والموارد والمتابعة',
  ],
  GENERAL: [],
};

const preferredTypes: Partial<Record<ExecutiveAiIntent, string[]>> = {
  VISION: ['STRATEGIC_PLAN', 'GOVERNANCE'],
  MISSION: ['STRATEGIC_PLAN', 'GOVERNANCE'],
  BENEFICIARIES: ['OPERATIONAL_PLAN', 'REPORT', 'PROGRAM', 'EDUCATIONAL'],
  STRATEGIC_OBJECTIVES: ['STRATEGIC_PLAN'],
  OPERATIONAL_RISKS: ['OPERATIONAL_PLAN', 'REPORT', 'GOVERNANCE'],
  BOARD_REPORT: ['STRATEGIC_PLAN', 'OPERATIONAL_PLAN', 'FINANCIAL', 'GOVERNANCE', 'REPORT'],
  CEO_RECOMMENDATIONS: ['OPERATIONAL_PLAN', 'FINANCIAL', 'GOVERNANCE', 'REPORT'],
  OFFICIAL_LETTER: ['LETTER', 'POLICY', 'REGULATION', 'GOVERNANCE'],
  DONOR_PROPOSAL: ['PROGRAM', 'OPERATIONAL_PLAN', 'FINANCIAL', 'REPORT', 'GOVERNANCE'],
  MEETING_MINUTES: ['MINUTES', 'REPORT', 'OPERATIONAL_PLAN', 'GOVERNANCE'],
  EXECUTIVE_REPORT: ['REPORT', 'OPERATIONAL_PLAN', 'FINANCIAL', 'GOVERNANCE'],
  DECISION: ['DECISION', 'POLICY', 'REGULATION', 'GOVERNANCE', 'REPORT'],
  ACTION_PLAN: ['OPERATIONAL_PLAN', 'STRATEGIC_PLAN', 'REPORT', 'PROGRAM'],
};

export class ArabicExecutiveQueryPlanner implements ExecutiveAiQueryPlanner {
  plan(request: ExecutiveAiRequest): ExecutiveAiQueryPlan {
    const intent = detectIntent(request);
    return {
      intent,
      queries: unique([request.question, ...(intentQueries[intent] ?? [])]).slice(0, 6),
      preferredDocumentTypes: preferredTypes[intent] ?? [],
      requiresDocumentDiversity: [
        'BOARD_REPORT',
        'CEO_RECOMMENDATIONS',
        'OPERATIONAL_RISKS',
        'DONOR_PROPOSAL',
        'MEETING_MINUTES',
        'EXECUTIVE_REPORT',
        'DECISION',
        'ACTION_PLAN',
      ].includes(intent),
    };
  }
}
