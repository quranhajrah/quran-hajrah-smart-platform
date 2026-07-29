import { api, type ExecutiveRecord } from './api';
import type { ExecutiveAiWritingResponse } from './executive-insights-data';

export type ExecutiveStructuredQueryResult = {
  mode: 'structured-data';
  title: string;
  summary: string;
  data: unknown;
  missingData: string[];
  sources: Array<{
    module: string;
    recordId?: string;
    label: string;
    route?: string;
  }>;
  suggestedActions: Array<{
    label: string;
    route: string;
    permission?: string;
  }>;
};

export type KnowledgeSearchItem = {
  documentId: string;
  documentVersionId: string;
  documentTitle: string;
  documentType: string;
  owningDepartment: string;
  versionNumber: number;
  pageNumber?: number;
  section?: string;
  excerpt: string;
  score: number;
  sourceUrl: string;
};

export type KnowledgeAnswer = {
  status: 'ANSWERED' | 'INSUFFICIENT_EVIDENCE';
  answer: string;
  sources: Array<KnowledgeSearchItem & { reference: number }>;
  limitations: string[];
};

export type ExecutiveAiCapabilities = {
  version: string;
  language: 'ar';
  evidenceRequired: boolean;
  externalGenerativeProvider: boolean;
  professionalRewrite: boolean;
  directParagraphCopying: boolean;
  referencesPresentedSeparately: boolean;
  modes: ExecutiveWritingCapability[];
};

export type ExecutiveWritingCapability =
  | 'QUESTION'
  | 'BOARD_REPORT'
  | 'CEO_RECOMMENDATIONS'
  | 'OFFICIAL_LETTER'
  | 'DONOR_PROPOSAL'
  | 'MEETING_MINUTES'
  | 'EXECUTIVE_REPORT'
  | 'DECISION'
  | 'ACTION_PLAN';

export type ExecutiveWritingDefinition = {
  capability: ExecutiveWritingCapability;
  label: string;
  endpoint: string;
  permission: string;
  needsRecipient?: boolean;
};

export const executiveWritingDefinitions: ExecutiveWritingDefinition[] = [
  {
    capability: 'QUESTION',
    label: 'إجابة تنفيذية مهنية',
    endpoint: '/executive-ai/ask',
    permission: 'executive_ai.use',
  },
  {
    capability: 'BOARD_REPORT',
    label: 'تقرير مجلس الإدارة',
    endpoint: '/executive-ai/board-report',
    permission: 'executive_ai.reports',
  },
  {
    capability: 'CEO_RECOMMENDATIONS',
    label: 'توصيات الرئيس التنفيذي',
    endpoint: '/executive-ai/recommendations',
    permission: 'executive_ai.recommendations',
  },
  {
    capability: 'OFFICIAL_LETTER',
    label: 'خطاب رسمي',
    endpoint: '/executive-ai/official-letter',
    permission: 'executive_ai.letters',
    needsRecipient: true,
  },
  {
    capability: 'DONOR_PROPOSAL',
    label: 'مقترح جهة مانحة',
    endpoint: '/executive-ai/donor-proposal',
    permission: 'executive_ai.reports',
  },
  {
    capability: 'MEETING_MINUTES',
    label: 'محضر اجتماع',
    endpoint: '/executive-ai/meeting-minutes',
    permission: 'executive_ai.reports',
  },
  {
    capability: 'EXECUTIVE_REPORT',
    label: 'تقرير تنفيذي',
    endpoint: '/executive-ai/executive-report',
    permission: 'executive_ai.reports',
  },
  {
    capability: 'DECISION',
    label: 'مشروع قرار',
    endpoint: '/executive-ai/decision',
    permission: 'executive_ai.recommendations',
  },
  {
    capability: 'ACTION_PLAN',
    label: 'خطة عمل',
    endpoint: '/executive-ai/action-plan',
    permission: 'executive_ai.recommendations',
  },
];

export const runStructuredExecutiveQuery = (text: string, signal?: AbortSignal) =>
  api<ExecutiveStructuredQueryResult>('/executive/query', {
    method: 'POST',
    body: JSON.stringify({ text }),
    signal,
  });

export const searchInstitutionalKnowledge = (query: string, signal?: AbortSignal) =>
  api<{ items: KnowledgeSearchItem[] }>('/knowledge/search', {
    method: 'POST',
    body: JSON.stringify({ query, limit: 8 }),
    signal,
  });

export const answerFromInstitutionalKnowledge = (query: string, signal?: AbortSignal) =>
  api<KnowledgeAnswer>('/knowledge/answer', {
    method: 'POST',
    body: JSON.stringify({ query }),
    signal,
  });

export const loadExecutiveAiCapabilities = (signal?: AbortSignal) =>
  api<ExecutiveAiCapabilities>('/executive-ai/capabilities', { signal });

export const generateSmartBarWriting = (
  definition: ExecutiveWritingDefinition,
  input: { question: string; recipient?: string; subject?: string },
  signal?: AbortSignal,
) =>
  api<ExecutiveAiWritingResponse>(definition.endpoint, {
    method: 'POST',
    body: JSON.stringify(
      definition.needsRecipient
        ? {
            question: input.question,
            recipient: input.recipient,
            subject: input.subject,
          }
        : { question: input.question },
    ),
    signal,
  });

export const structuredRecords = (data: unknown): ExecutiveRecord[] =>
  Array.isArray(data)
    ? data.filter((item): item is ExecutiveRecord =>
        Boolean(item && typeof item === 'object' && typeof item.id === 'string'),
      )
    : [];
