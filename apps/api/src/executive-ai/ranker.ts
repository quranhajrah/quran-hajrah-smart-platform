import type { KnowledgeSearchResult } from '../knowledge/types.js';
import type {
  ExecutiveAiEvidenceRanker,
  ExecutiveAiQueryPlan,
  RankedExecutiveEvidence,
} from './types.js';

const intentSignals: Record<ExecutiveAiQueryPlan['intent'], string[]> = {
  VISION: ['رؤية', 'الرؤية'],
  MISSION: ['رسالة', 'الرسالة'],
  BENEFICIARIES: ['مستفيد', 'طالب', 'طالبة', 'فئة مستهدفة'],
  STRATEGIC_OBJECTIVES: ['هدف', 'أهداف', 'محور', 'استراتيجي'],
  OPERATIONAL_RISKS: ['خطر', 'مخاطر', 'معالجة', 'تشغيلي'],
  BOARD_REPORT: ['أداء', 'خطة', 'موازنة', 'مخاطر', 'حوكمة'],
  CEO_RECOMMENDATIONS: ['انحراف', 'متعثر', 'متأخر', 'مخاطر', 'موازنة'],
  OFFICIAL_LETTER: ['قرار', 'سياسة', 'لائحة', 'خطاب'],
  GENERAL: [],
};

const evidenceKey = (item: KnowledgeSearchResult) =>
  [item.documentVersionId, item.pageNumber ?? 0, item.section ?? '', item.excerpt].join(':');

export class DiverseExecutiveEvidenceRanker implements ExecutiveAiEvidenceRanker {
  rank(evidence: KnowledgeSearchResult[], plan: ExecutiveAiQueryPlan, limit: number) {
    const uniqueEvidence = [...new Map(evidence.map((item) => [evidenceKey(item), item])).values()];
    const scored: RankedExecutiveEvidence[] = uniqueEvidence
      .map((item) => {
        const searchable =
          `${item.documentTitle} ${item.section ?? ''} ${item.excerpt}`.toLocaleLowerCase('ar');
        const matchedSignals = intentSignals[plan.intent].filter((signal) =>
          searchable.includes(signal),
        );
        const typeBoost = plan.preferredDocumentTypes.includes(item.documentType) ? 0.08 : 0;
        const signalBoost = Math.min(0.12, matchedSignals.length * 0.03);
        return {
          ...item,
          executiveScore: Number(Math.min(1, item.score + typeBoost + signalBoost).toFixed(4)),
          matchedSignals,
        };
      })
      .sort(
        (left, right) =>
          right.executiveScore - left.executiveScore ||
          right.score - left.score ||
          left.documentTitle.localeCompare(right.documentTitle, 'ar'),
      );

    if (!plan.requiresDocumentDiversity) return scored.slice(0, limit);
    const selected: RankedExecutiveEvidence[] = [];
    const seenDocuments = new Set<string>();
    for (const item of scored) {
      if (seenDocuments.has(item.documentId)) continue;
      selected.push(item);
      seenDocuments.add(item.documentId);
      if (selected.length >= limit) return selected;
    }
    for (const item of scored) {
      if (selected.includes(item)) continue;
      selected.push(item);
      if (selected.length >= limit) break;
    }
    return selected;
  }
}
