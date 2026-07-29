import type { KnowledgeSourceReference } from '../knowledge/types.js';
import {
  EXECUTIVE_AI_VERSION,
  type ExecutiveAiQueryPlan,
  type ExecutiveAiRequest,
  type ExecutiveAiRequestType,
  type ExecutiveAiResponse,
  type ExecutiveAiSynthesisProvider,
  type ExecutiveSupportingReference,
  type ExecutiveWritingStyle,
  type RankedExecutiveEvidence,
} from './types.js';

type ExecutiveTheme =
  | 'STRATEGY'
  | 'MISSION'
  | 'BENEFICIARIES'
  | 'PERFORMANCE'
  | 'OPERATIONS'
  | 'FINANCE'
  | 'RISK'
  | 'GOVERNANCE'
  | 'PROGRAMS'
  | 'PARTNERSHIPS';

type EvidenceInsight = {
  reference: number;
  themes: ExecutiveTheme[];
  narrative: string;
  recommendation: string;
};

type WritingProfile = {
  style: ExecutiveWritingStyle;
  audience: string;
  purpose: string;
};

const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();

const normalizeArabicToken = (value: string) =>
  value
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/[^\p{L}]/gu, '');

const focusStopWords = new Set(
  [
    'الذي',
    'التي',
    'الذين',
    'هذا',
    'هذه',
    'ذلك',
    'تلك',
    'الى',
    'على',
    'عن',
    'من',
    'في',
    'مع',
    'وفق',
    'خلال',
    'بعد',
    'قبل',
    'بين',
    'ضمن',
    'ذات',
    'كما',
    'وقد',
    'وهو',
    'وهي',
    'او',
    'ثم',
    'كل',
    'تم',
    'يتم',
    'تتم',
    'ان',
    'المعتمد',
    'المعتمدة',
    'التقرير',
    'الوثيقة',
    'البيانات',
    'المذكور',
    'المذكورة',
    'المؤسسية',
    'الجمعية',
    'اعداد',
    'بشان',
    'تشير',
    'تظهر',
    'توضح',
    'تتطلب',
    'بلغ',
    'بلغت',
  ].map(normalizeArabicToken),
);

const joinArabic = (values: string[]) => {
  if (values.length <= 1) return values[0] ?? '';
  if (values.length === 2) return `${values[0]} و${values[1]}`;
  return `${values.slice(0, -1).join('، ')}، و${values.at(-1)}`;
};

const extractFocusTerms = (text: string) => {
  const selected = new Map<string, string>();
  for (const raw of normalize(text).match(/[\p{L}\u064B-\u065F\u0670]{3,}/gu) ?? []) {
    const normalized = normalizeArabicToken(raw);
    const key = normalized.replace(/^ال/, '');
    if (normalized.length < 3 || focusStopWords.has(normalized) || selected.has(key)) continue;
    selected.set(key, raw.replace(/[\u064B-\u065F\u0670]/g, ''));
    if (selected.size >= 5) break;
  }
  return [...selected.values()];
};

const quote = (value: string, maximum = 420) => {
  const normalized = normalize(value);
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

const writingProfiles: Record<ExecutiveAiRequestType, WritingProfile> = {
  QUESTION: {
    style: 'CEO',
    audience: 'الرئيس التنفيذي والإدارة العليا',
    purpose: 'تقديم إحاطة موجزة توضح الدلالة الإدارية وما يلزم بشأنها',
  },
  BOARD_REPORT: {
    style: 'BOARD_OF_DIRECTORS',
    audience: 'مجلس الإدارة',
    purpose: 'دعم الإحاطة والرقابة واتخاذ القرار',
  },
  CEO_RECOMMENDATIONS: {
    style: 'RECOMMENDATIONS',
    audience: 'الرئيس التنفيذي',
    purpose: 'تقديم توصيات قابلة للتكليف والمتابعة',
  },
  OFFICIAL_LETTER: {
    style: 'GOVERNMENT_CORRESPONDENCE',
    audience: 'الجهة الرسمية المرسل إليها',
    purpose: 'صياغة مخاطبة رسمية واضحة ومحددة الطلب',
  },
  DONOR_PROPOSAL: {
    style: 'DONOR_PROPOSAL',
    audience: 'الجهة المانحة أو الشريك التمويلي',
    purpose: 'عرض الاحتياج والأثر والحوكمة بلغة تمويلية مهنية',
  },
  MEETING_MINUTES: {
    style: 'MEETING_MINUTES',
    audience: 'رئيس الاجتماع والأعضاء',
    purpose: 'توثيق المناقشة والقرارات والإجراءات دون اختلاق بيانات الاجتماع',
  },
  EXECUTIVE_REPORT: {
    style: 'EXECUTIVE_REPORT',
    audience: 'القيادة التنفيذية',
    purpose: 'تقديم قراءة إدارية مركزة للأداء والمخاطر والأولويات',
  },
  DECISION: {
    style: 'DECISION',
    audience: 'صاحب الصلاحية',
    purpose: 'صياغة مشروع قرار مسبب وقابل للتنفيذ',
  },
  ACTION_PLAN: {
    style: 'ACTION_PLAN',
    audience: 'ملاك التنفيذ والمتابعة',
    purpose: 'تحويل الدلالات المرجعية إلى إجراءات ومسؤوليات وضوابط متابعة',
  },
};

const themeMatchers: Array<[ExecutiveTheme, RegExp]> = [
  ['STRATEGY', /(رؤي|استراتيجي|هدف|أهداف|محور|أولوية)/i],
  ['MISSION', /(رسال|غرض|غاية|قيمة مؤسسية)/i],
  ['BENEFICIARIES', /(مستفيد|طالب|طالبة|فئة مستهدفة|مجتمع)/i],
  ['PERFORMANCE', /(مؤشر|أداء|إنجاز|نتيجة|مستهدف|نمو|نسبة)/i],
  ['OPERATIONS', /(تشغيل|تنفيذ|إجراء|موعد|تأخر|تعثر|مبادرة)/i],
  ['FINANCE', /(موازن|ميزاني|مالي|تكلفة|مصروف|إيراد|ريال|تمويل)/i],
  ['RISK', /(خطر|مخاطر|معالجة|تخفيف|احتمال|أثر)/i],
  ['GOVERNANCE', /(حوكم|امتثال|سياسة|لائحة|صلاحية|اعتماد|قرار)/i],
  ['PROGRAMS', /(برنامج|مشروع|مبادرة|خدمة|نشاط)/i],
  ['PARTNERSHIPS', /(شريك|شراكة|مانح|داعم|تمويل|تعاون)/i],
];

const themeLabels: Record<ExecutiveTheme, string> = {
  STRATEGY: 'التوجه الاستراتيجي',
  MISSION: 'الرسالة المؤسسية',
  BENEFICIARIES: 'نطاق المستفيدين',
  PERFORMANCE: 'الأداء والنتائج',
  OPERATIONS: 'التنفيذ التشغيلي',
  FINANCE: 'الوضع المالي',
  RISK: 'المخاطر والمعالجات',
  GOVERNANCE: 'الحوكمة والامتثال',
  PROGRAMS: 'البرامج والمبادرات',
  PARTNERSHIPS: 'الشراكات والاستدامة',
};

const themeNarratives: Record<ExecutiveTheme, string> = {
  STRATEGY:
    'تبيّن القراءة المؤسسية وجود اتجاه استراتيجي ينبغي أن يظل مرجعًا لترتيب الأولويات وربط المبادرات بالنتائج القابلة للقياس',
  MISSION:
    'تؤكد المعطيات أن الرسالة المؤسسية تمثل الأساس الذي تُبنى عليه البرامج وتُقاس في ضوئه قيمة الأثر',
  BENEFICIARIES:
    'تعكس البيانات نطاقًا محددًا للمستفيدين، بما يستدعي مواءمة الطاقة التشغيلية مع جودة الوصول وعمق الأثر',
  PERFORMANCE:
    'تكشف مؤشرات الأداء عن حاجة الإدارة إلى قراءة النتائج مقابل المستهدفات، ومعالجة الانحراف قبل اتساع أثره',
  OPERATIONS:
    'تشير الحالة التشغيلية إلى أن جودة التنفيذ تعتمد على وضوح المسؤولية وتسلسل الإجراء والانضباط في المتابعة',
  FINANCE:
    'تستوجب الصورة المالية ربط استخدام الموارد بالأولويات المعتمدة ومراجعة الكفاءة والاستدامة قبل التوسع',
  RISK: 'تبرز معطيات المخاطر ضرورة تحديد مستوى التعرض وفاعلية الضوابط ومالك المعالجة ضمن إطار زمني معلوم',
  GOVERNANCE:
    'تؤكد المرجعية النظامية أن سلامة الإجراء ترتبط بوضوح الصلاحية والتوثيق والامتثال قبل الاعتماد',
  PROGRAMS:
    'توضح بيانات البرامج أن القيمة التنفيذية تتحقق عند ربط الأنشطة بمخرجات محددة ومؤشرات أثر قابلة للتحقق',
  PARTNERSHIPS:
    'تدل معطيات الشراكات على أهمية تقديم قيمة مشتركة واضحة مع ترتيبات حوكمة واستدامة قابلة للمتابعة',
};

const themeRecommendations: Record<ExecutiveTheme, string> = {
  STRATEGY: 'اعتماد ترتيب واضح للأولويات وربط كل أولوية بمؤشر ومالك تنفيذي',
  MISSION: 'مراجعة اتساق المبادرات المقترحة مع الرسالة المؤسسية قبل تخصيص الموارد',
  BENEFICIARIES: 'تثبيت خط أساس للمستفيدين وقياس الوصول والجودة والأثر بصورة دورية',
  PERFORMANCE: 'تكليف مالك المؤشر بخطة تصحيحية تتضمن المستهدف والموعد وآلية التصعيد',
  OPERATIONS: 'تحويل المتطلبات إلى إجراءات محددة المسؤولية والموعد وحالة الإنجاز',
  FINANCE: 'إجراء مراجعة مالية تربط التكلفة بالعائد المؤسسي والاستدامة قبل الاعتماد',
  RISK: 'اعتماد معالجة للمخاطر تتضمن المالك والضابط والموعد ومؤشر الإغلاق',
  GOVERNANCE: 'استكمال التحقق من الصلاحية والامتثال وتوثيق مسار الاعتماد',
  PROGRAMS: 'ربط كل برنامج بمخرجات قابلة للقياس وخطة متابعة للأثر',
  PARTNERSHIPS: 'تحديد القيمة المتبادلة ونطاق الالتزام والحوكمة ومؤشرات نجاح الشراكة',
};

const defaultThemeForIntent: Record<ExecutiveAiQueryPlan['intent'], ExecutiveTheme> = {
  VISION: 'STRATEGY',
  MISSION: 'MISSION',
  BENEFICIARIES: 'BENEFICIARIES',
  STRATEGIC_OBJECTIVES: 'STRATEGY',
  OPERATIONAL_RISKS: 'RISK',
  BOARD_REPORT: 'PERFORMANCE',
  CEO_RECOMMENDATIONS: 'OPERATIONS',
  OFFICIAL_LETTER: 'GOVERNANCE',
  DONOR_PROPOSAL: 'PARTNERSHIPS',
  MEETING_MINUTES: 'OPERATIONS',
  EXECUTIVE_REPORT: 'PERFORMANCE',
  DECISION: 'GOVERNANCE',
  ACTION_PLAN: 'OPERATIONS',
  GENERAL: 'PERFORMANCE',
};

const titleForIntent: Record<ExecutiveAiQueryPlan['intent'], string> = {
  VISION: 'إحاطة تنفيذية بشأن الرؤية',
  MISSION: 'إحاطة تنفيذية بشأن الرسالة',
  BENEFICIARIES: 'إحاطة تنفيذية بشأن المستفيدين',
  STRATEGIC_OBJECTIVES: 'إحاطة تنفيذية بشأن الأهداف الاستراتيجية',
  OPERATIONAL_RISKS: 'إحاطة تنفيذية بشأن المخاطر التشغيلية',
  BOARD_REPORT: 'تقرير مرفوع إلى مجلس الإدارة',
  CEO_RECOMMENDATIONS: 'مذكرة توصيات للرئيس التنفيذي',
  OFFICIAL_LETTER: 'خطاب رسمي',
  DONOR_PROPOSAL: 'مقترح موجه إلى جهة مانحة',
  MEETING_MINUTES: 'محضر اجتماع تنفيذي',
  EXECUTIVE_REPORT: 'تقرير تنفيذي',
  DECISION: 'مشروع قرار',
  ACTION_PLAN: 'خطة عمل تنفيذية',
  GENERAL: 'الإحاطة التنفيذية',
};

const arabicNumberWords: Record<string, number> = {
  صفر: 0,
  واحد: 1,
  واحدة: 1,
  اثنان: 2,
  اثنين: 2,
  اثنتان: 2,
  اثنتين: 2,
  ثلاثة: 3,
  ثلاث: 3,
  اربعة: 4,
  اربع: 4,
  خمسة: 5,
  خمس: 5,
  ستة: 6,
  ست: 6,
  سبعة: 7,
  سبع: 7,
  ثمانية: 8,
  ثمان: 8,
  تسعة: 9,
  تسع: 9,
  عشرة: 10,
  عشر: 10,
  عشرون: 20,
  عشرين: 20,
  ثلاثون: 30,
  ثلاثين: 30,
  اربعون: 40,
  اربعين: 40,
  خمسون: 50,
  خمسين: 50,
  ستون: 60,
  ستين: 60,
  سبعون: 70,
  سبعين: 70,
  ثمانون: 80,
  ثمانين: 80,
  تسعون: 90,
  تسعين: 90,
  مئة: 100,
  مائة: 100,
  مئتان: 200,
  مئتين: 200,
  مئتا: 200,
  مئتي: 200,
  مائتان: 200,
  مائتين: 200,
  مائتا: 200,
  مائتي: 200,
  ثلاثمئة: 300,
  ثلاثمائة: 300,
  اربعمئة: 400,
  اربعمائة: 400,
  خمسمئة: 500,
  خمسمائة: 500,
  ستمئة: 600,
  ستمائة: 600,
  سبعمئة: 700,
  سبعمائة: 700,
  ثمانمئة: 800,
  ثمانمائة: 800,
  تسعمئة: 900,
  تسعمائة: 900,
  الف: 1000,
  الفا: 1000,
  مليون: 1_000_000,
};

const arabicNumberScales: Record<string, { scale: number; implicitMultiplier: number }> = {
  الف: { scale: 1000, implicitMultiplier: 1 },
  الفا: { scale: 1000, implicitMultiplier: 1 },
  الفان: { scale: 1000, implicitMultiplier: 2 },
  الفين: { scale: 1000, implicitMultiplier: 2 },
  الاف: { scale: 1000, implicitMultiplier: 1 },
  مليون: { scale: 1_000_000, implicitMultiplier: 1 },
  مليونا: { scale: 1_000_000, implicitMultiplier: 1 },
  مليونان: { scale: 1_000_000, implicitMultiplier: 2 },
  مليونين: { scale: 1_000_000, implicitMultiplier: 2 },
  ملايين: { scale: 1_000_000, implicitMultiplier: 1 },
};

const normalizeArabicNumberToken = (token: string) =>
  token
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/[^\p{L}]/gu, '')
    .replace(/^و(?=.)/, '');

const extractWrittenArabicNumbers = (text: string) => {
  const values: number[] = [];
  let group = 0;
  let total = 0;
  let matched = false;
  const flush = () => {
    const value = total + group;
    if (matched && value >= 100) values.push(value);
    group = 0;
    total = 0;
    matched = false;
  };
  for (const rawToken of normalize(text).split(/\s+/)) {
    const token = normalizeArabicNumberToken(rawToken);
    const scale = arabicNumberScales[token];
    if (scale) {
      matched = true;
      total += (group || scale.implicitMultiplier) * scale.scale;
      group = 0;
      continue;
    }
    const value = arabicNumberWords[token];
    if (value === undefined) {
      flush();
      continue;
    }
    matched = true;
    group += value;
  }
  flush();
  return [...new Set(values.map(String))];
};

const extractFigures = (text: string) => {
  const matches =
    normalize(text).match(
      /[\d٠-٩]+(?:[.,٬٫][\d٠-٩]+)*(?:\s*(?:%|٪|مليون|ألف|ريال|مستفيد(?:ًا)?|طالب(?:ًا)?|طالبة))?/g,
    ) ?? [];
  return [...new Set([...extractWrittenArabicNumbers(text), ...matches])].slice(0, 3);
};

const figuresNarrative = (text: string, figures: string[]) => {
  if (figures.length === 0) return '';
  const values = figures.join('، ');
  if (/(مستفيد|طالب|طالبة|فئة مستهدفة)/i.test(text))
    return `وتتضمن البيانات قيمة كمية مرتبطة بنطاق المستفيدين مقدارها ${values}`;
  if (/(موازن|ميزاني|مالي|تكلفة|مصروف|إيراد|ريال)/i.test(text))
    return `كما تتضمن البيانات المالية قيمًا مقدارها ${values}`;
  if (/(مؤشر|أداء|إنجاز|نمو|نسبة|مستهدف)/i.test(text))
    return `وتورد مؤشرات الأداء قيمًا كمية مقدارها ${values}`;
  if (/(تاريخ|عام|سنة|موعد|فترة|ربع)/i.test(text))
    return `وترتبط المعلومة بالفترة أو الموعد ${values}`;
  return `وتتضمن البيانات قيمًا كمية مقدارها ${values}`;
};

const statusNarrative = (text: string) => {
  if (/(متعثر|متأخر|تأخر|لم ينجز|انحراف)/i.test(text))
    return 'وتظهر إشارة تستدعي تدخلًا تصحيحيًا ومتابعة أقرب من المعتاد';
  if (/(مكتمل|منجز|تحقق|تم الإنجاز)/i.test(text))
    return 'كما تسجل المعطيات تقدمًا ينبغي التحقق من استدامته وأثره الفعلي';
  if (/(حرج|مرتفع|عالي)/i.test(text) && /(خطر|مخاطر)/i.test(text))
    return 'وتشير درجة التعرض إلى أولوية مرتفعة للمعالجة والرفع إلى صاحب الصلاحية';
  if (/(معتمد|اعتمد|موافقة)/i.test(text))
    return 'وتدل حالة الاعتماد على انتقال الموضوع من مرحلة التصور إلى مسؤولية التنفيذ والمتابعة';
  return '';
};

const understandEvidence = (
  source: KnowledgeSourceReference,
  plan: ExecutiveAiQueryPlan,
): EvidenceInsight => {
  const text = normalize(`${source.documentTitle} ${source.section ?? ''} ${source.excerpt}`);
  const themes = themeMatchers
    .filter(([, matcher]) => matcher.test(text))
    .map(([theme]) => theme)
    .slice(0, 3);
  if (themes.length === 0) themes.push(defaultThemeForIntent[plan.intent]);
  const primaryTheme = themes[0]!;
  const focusTerms = extractFocusTerms(source.excerpt);
  const focusNarrative =
    focusTerms.length >= 2 ? `ويتمحور مضمون المرجع حول ${joinArabic(focusTerms)}` : '';
  const additions = [
    focusNarrative,
    figuresNarrative(text, extractFigures(source.excerpt)),
    statusNarrative(text),
  ]
    .filter(Boolean)
    .join('، ');
  return {
    reference: source.reference,
    themes,
    narrative: `${themeNarratives[primaryTheme]}${additions ? `، ${additions}` : ''}. [${source.reference}]`,
    recommendation: `${themeRecommendations[primaryTheme]}. [${source.reference}]`,
  };
};

const supportingReferencesFor = (
  sources: KnowledgeSourceReference[],
  insights: EvidenceInsight[],
): ExecutiveSupportingReference[] =>
  sources.map((source, index) => ({
    reference: source.reference,
    quote: quote(source.excerpt),
    relevance: `يدعم ${insights[index]!.themes.map((theme) => themeLabels[theme]).join(' و')}.`,
  }));

const numbered = (items: string[]) => items.map((item, index) => `${index + 1}. ${item}`);

const compactInsights = (insights: EvidenceInsight[], maximum = 6) =>
  insights.slice(0, maximum).map((insight) => insight.narrative);

const recommendationsFor = (insights: EvidenceInsight[], maximum = 5) => {
  const selected = new Map<ExecutiveTheme, EvidenceInsight>();
  for (const insight of insights) {
    const theme = insight.themes[0]!;
    if (!selected.has(theme)) selected.set(theme, insight);
    if (selected.size >= maximum) break;
  }
  return [...selected.values()].map((insight) => insight.recommendation);
};

const referenceList = (insights: EvidenceInsight[], maximum = 6) =>
  insights
    .slice(0, maximum)
    .map((insight) => `[${insight.reference}]`)
    .join('، ');

const executivePosition = (insights: EvidenceInsight[]) => {
  const first = insights[0]!;
  return `يوصى بالانتقال من الإحاطة إلى التنفيذ عبر ${themeRecommendations[
    first.themes[0]!
  ].replace(/^./, (character) =>
    character.toLocaleLowerCase('ar'),
  )}، مع رفع نتيجة المتابعة إلى صاحب الصلاحية. [${first.reference}]`;
};

const writeQuestion = (plan: ExecutiveAiQueryPlan, insights: EvidenceInsight[]): string =>
  [
    titleForIntent[plan.intent],
    '',
    'الخلاصة التنفيذية',
    ...compactInsights(insights),
    '',
    'التقدير التنفيذي',
    executivePosition(insights),
  ].join('\n');

const writeBoardReport = (request: ExecutiveAiRequest, insights: EvidenceInsight[]) =>
  [
    'مذكرة مرفوعة إلى مجلس الإدارة',
    `الموضوع: ${request.question}`,
    '',
    'أولًا: الخلاصة التنفيذية',
    ...compactInsights(insights),
    '',
    'ثانيًا: المسائل التي تستلزم نظر المجلس',
    ...numbered(recommendationsFor(insights, 4)),
    '',
    'ثالثًا: مشروع التوجيه',
    `إحاطة المجلس بما ورد، وتوجيه الإدارة التنفيذية إلى استكمال الإجراءات ذات الأولوية ورفع تقرير متابعة يوضح المسؤوليات والنتائج والانحرافات. ${referenceList(insights, 4)}`,
  ].join('\n');

const writeRecommendations = (insights: EvidenceInsight[]) =>
  [
    'مذكرة إلى الرئيس التنفيذي',
    '',
    'التقدير التنفيذي',
    ...compactInsights(insights, 5),
    '',
    'التوصيات المقترحة',
    ...numbered(recommendationsFor(insights, 6)),
    '',
    'آلية المتابعة',
    'تُحوّل التوصيات المعتمدة إلى سجل تنفيذي يتضمن المالك والموعد ومؤشر الإنجاز وحالة التصعيد، ويُراجع دوريًا حتى الإغلاق.',
  ].join('\n');

const writeOfficialLetter = (request: ExecutiveAiRequest, insights: EvidenceInsight[]) => {
  const recipient = request.recipient?.trim() || 'الجهة المعنية';
  const subject = request.subject?.trim() || request.question;
  return [
    `إلى سعادة/ ${recipient}`,
    `الموضوع: ${subject}`,
    '',
    'السلام عليكم ورحمة الله وبركاته، وبعد:',
    '',
    'إشارةً إلى الموضوع أعلاه، وإلى المرجعية المؤسسية ذات الصلة، نحيط سعادتكم بما يأتي:',
    ...compactInsights(insights, 4),
    '',
    'وعليه، نأمل التكرم بالاطلاع واتخاذ ما يلزم وفق الاختصاص، وإفادتنا بما يتم حيال ذلك؛ بما يضمن وضوح المسؤولية وسلامة الإجراء واستكمال المتابعة.',
    '',
    'وتفضلوا بقبول خالص التحية والتقدير.',
  ].join('\n');
};

const writeDonorProposal = (request: ExecutiveAiRequest, insights: EvidenceInsight[]) =>
  [
    'مقترح شراكة ودعم',
    `عنوان المقترح: ${request.subject?.trim() || request.question}`,
    '',
    'الملخص التنفيذي',
    'يقدم هذا المقترح إطارًا مؤسسيًا لتحويل الاحتياج المثبت إلى تدخل قابل للقياس، مع حماية جودة التنفيذ ووضوح الحوكمة واستدامة الأثر.',
    `ويستند المقترح إلى المراجع المؤسسية ${referenceList(insights, 4)} دون افتراض نطاق أو موازنة غير مثبتة.`,
    '',
    'مبررات التدخل',
    ...numbered(compactInsights(insights, 3)),
    '',
    'الأثر المتوقع',
    'يُبنى الأثر المستهدف على خط أساس معتمد ومؤشرات وصول وجودة ونتائج، ولا تُدرج قيمة كمية أو مالية غير مثبتة في المراجع.',
    '',
    'الحوكمة والاستدامة',
    ...numbered(recommendationsFor(insights, 4)),
    '',
    'طلب الشراكة',
    'نتطلع إلى شراكة تمكّن تنفيذ التدخل ومتابعة أثره ضمن نطاق متفق عليه، على أن تُعتمد الموازنة والجدول الزمني ومؤشرات الأداء بعد المراجعة المشتركة.',
  ].join('\n');

const writeMeetingMinutes = (request: ExecutiveAiRequest, insights: EvidenceInsight[]) =>
  [
    'محضر اجتماع تنفيذي — مسودة',
    `موضوع الاجتماع: ${request.question}`,
    'التاريخ والحضور: يُستكملان من سجل الاجتماع المعتمد',
    '',
    'موجز المناقشة',
    ...compactInsights(insights, 5),
    '',
    'القرارات المقترحة للتوثيق',
    ...numbered(recommendationsFor(insights, 4)),
    '',
    'الإجراءات والمتابعة',
    ...numbered(
      recommendationsFor(insights, 4).map(
        (item) =>
          `${item.replace(/\s+\[\d+\]$/, '')} — المسؤول: يحدده رئيس الاجتماع — الموعد: يُعتمد في المحضر. ${item.match(/\[\d+\]$/)?.[0] ?? ''}`,
      ),
    ),
    '',
    'ملاحظة توثيقية',
    'لا يصبح هذا النص محضرًا معتمدًا إلا بعد استكمال بيانات الاجتماع ومراجعته وإقراره من صاحب الصلاحية.',
  ].join('\n');

const writeExecutiveReport = (request: ExecutiveAiRequest, insights: EvidenceInsight[]) =>
  [
    'التقرير التنفيذي',
    `الموضوع: ${request.question}`,
    '',
    'الموقف العام',
    ...compactInsights(insights, 5),
    '',
    'الأولويات الإدارية',
    ...numbered(recommendationsFor(insights, 5)),
    '',
    'القرارات المطلوبة',
    `اعتماد الأولويات المناسبة، وتكليف ملاك التنفيذ بإجراءات محددة، وتحديد دورية رفع لا تتوقف حتى إغلاق الانحرافات. ${referenceList(insights, 5)}`,
  ].join('\n');

const writeDecision = (request: ExecutiveAiRequest, insights: EvidenceInsight[]) =>
  [
    'مشروع قرار',
    `بشأن: ${request.question}`,
    '',
    'بعد الاطلاع',
    `على المراجع المؤسسية الداعمة ${referenceList(insights, 6)}، وبعد دراسة الدلالات التنفيذية والحوكمية ذات الصلة؛`,
    '',
    'يُقترح ما يأتي',
    ...numbered(recommendationsFor(insights, 4)),
    '',
    'أحكام التنفيذ',
    'تتولى الجهة التي يحددها صاحب الصلاحية إعداد برنامج التنفيذ ورفع تقارير المتابعة، ويعمل بهذا القرار من تاريخ اعتماده، ويُبلّغ من يلزم لتنفيذه.',
  ].join('\n');

const writeActionPlan = (request: ExecutiveAiRequest, insights: EvidenceInsight[]) =>
  [
    'خطة عمل تنفيذية',
    `الغاية: ${request.question}`,
    '',
    'الأولويات',
    ...numbered(compactInsights(insights, 4)),
    '',
    'حزم العمل',
    ...numbered(
      recommendationsFor(insights, 5).map(
        (item) =>
          `${item.replace(/\s+\[\d+\]$/, '')}\n   المسؤولية: يحددها صاحب الصلاحية\n   الإطار الزمني: يعتمد بعد تثبيت خط الأساس\n   دليل الإقفال: نتيجة موثقة ومؤشر قابل للتحقق ${item.match(/\[\d+\]$/)?.[0] ?? ''}`,
      ),
    ),
    '',
    'ضبط المتابعة',
    'تُراجع الخطة دوريًا وفق حالة الإنجاز والانحراف والمخاطر، ولا يُغلق أي إجراء قبل التحقق من دليل الإنجاز.',
  ].join('\n');

const writeAnswer = (
  request: ExecutiveAiRequest,
  plan: ExecutiveAiQueryPlan,
  insights: EvidenceInsight[],
) => {
  switch (request.type) {
    case 'BOARD_REPORT':
      return writeBoardReport(request, insights);
    case 'CEO_RECOMMENDATIONS':
      return writeRecommendations(insights);
    case 'OFFICIAL_LETTER':
      return writeOfficialLetter(request, insights);
    case 'DONOR_PROPOSAL':
      return writeDonorProposal(request, insights);
    case 'MEETING_MINUTES':
      return writeMeetingMinutes(request, insights);
    case 'EXECUTIVE_REPORT':
      return writeExecutiveReport(request, insights);
    case 'DECISION':
      return writeDecision(request, insights);
    case 'ACTION_PLAN':
      return writeActionPlan(request, insights);
    case 'QUESTION':
      return writeQuestion(plan, insights);
  }
};

const containsDirectParagraph = (answer: string, sources: KnowledgeSourceReference[]) => {
  const normalizedAnswer = normalize(answer);
  return sources.some((source) =>
    source.excerpt
      .split(/\n{2,}|(?<=[.!؟])\s+/)
      .map(normalize)
      .filter((paragraph) => paragraph.length >= 60)
      .some((paragraph) => normalizedAnswer.includes(paragraph)),
  );
};

const safeFallback = (plan: ExecutiveAiQueryPlan, insights: EvidenceInsight[]) =>
  [
    titleForIntent[plan.intent],
    '',
    'الخلاصة التنفيذية',
    ...insights
      .slice(0, 5)
      .map((insight) => `${themeNarratives[insight.themes[0]!]}. [${insight.reference}]`),
    '',
    'التوجيه المقترح',
    executivePosition(insights),
  ].join('\n');

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
  supportingReferences: [],
  writing: { ...writingProfiles[request.type], method: 'PROFESSIONAL_REWRITE' },
  evidence: { chunkCount: 0, documentCount: 0, combinedMultipleDocuments: false },
  limitations: [
    'يحظر النظام إنشاء صياغة تنفيذية أو توصية بلا دليل مؤسسي قابل للفتح.',
    'عدم كفاية الأدلة لا يعني عدم وجود المعلومة في المستندات غير المفهرسة.',
  ],
});

export class ProfessionalArabicExecutiveWritingProvider implements ExecutiveAiSynthesisProvider {
  synthesize(
    request: ExecutiveAiRequest,
    plan: ExecutiveAiQueryPlan,
    evidence: RankedExecutiveEvidence[],
  ): ExecutiveAiResponse {
    if (evidence.length === 0) return insufficient(request, plan);
    const sources = sourcesFor(evidence);
    const insights = sources.map((source) => understandEvidence(source, plan));
    const draftedAnswer = writeAnswer(request, plan, insights);
    const answer = containsDirectParagraph(draftedAnswer, sources)
      ? safeFallback(plan, insights)
      : draftedAnswer;
    const documentCount = new Set(sources.map((source) => source.documentId)).size;
    return {
      version: EXECUTIVE_AI_VERSION,
      status: 'ANSWERED',
      requestType: request.type,
      intent: plan.intent,
      answer,
      executiveRecommendation: executivePosition(insights),
      sources,
      supportingReferences: supportingReferencesFor(sources, insights),
      writing: { ...writingProfiles[request.type], method: 'PROFESSIONAL_REWRITE' },
      evidence: {
        chunkCount: sources.length,
        documentCount,
        combinedMultipleDocuments: documentCount > 1,
      },
      limitations: [
        'متن النتيجة صياغة تنفيذية أصلية مبنية على فهم الدلالات؛ أما النصوص المرجعية فتظهر منفصلة في قسم الاقتباسات الداعمة.',
        'لا تُنشأ أرقام أو مواعيد أو أسماء مسؤولين غير مثبتة في المراجع.',
        ...(plan.requiresDocumentDiversity && documentCount < 2
          ? [
              'لم تتوفر أدلة كافية من أكثر من مستند؛ تظهر النتيجة المتاحة دون ادعاء دمج متعدد المصادر.',
            ]
          : []),
      ],
    };
  }
}

// Compatibility alias for integrations that instantiate the Enterprise 26 provider by name.
export class EvidenceBoundExecutiveSynthesisProvider extends ProfessionalArabicExecutiveWritingProvider {}
