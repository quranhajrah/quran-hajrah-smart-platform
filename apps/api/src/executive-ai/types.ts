import type { IdentityUser, RequestMeta } from '../identity/types.js';
import type { KnowledgeSearchResult, KnowledgeSourceReference } from '../knowledge/types.js';

export const EXECUTIVE_AI_VERSION = '26.1.0';

export type ExecutiveAiRequestType =
  | 'QUESTION'
  | 'BOARD_REPORT'
  | 'CEO_RECOMMENDATIONS'
  | 'OFFICIAL_LETTER'
  | 'DONOR_PROPOSAL'
  | 'MEETING_MINUTES'
  | 'EXECUTIVE_REPORT'
  | 'DECISION'
  | 'ACTION_PLAN';

export type ExecutiveAiIntent =
  | 'VISION'
  | 'MISSION'
  | 'BENEFICIARIES'
  | 'STRATEGIC_OBJECTIVES'
  | 'OPERATIONAL_RISKS'
  | 'BOARD_REPORT'
  | 'CEO_RECOMMENDATIONS'
  | 'OFFICIAL_LETTER'
  | 'DONOR_PROPOSAL'
  | 'MEETING_MINUTES'
  | 'EXECUTIVE_REPORT'
  | 'DECISION'
  | 'ACTION_PLAN'
  | 'GENERAL';

export type ExecutiveWritingStyle =
  | 'CEO'
  | 'BOARD_OF_DIRECTORS'
  | 'GOVERNMENT_CORRESPONDENCE'
  | 'DONOR_PROPOSAL'
  | 'MEETING_MINUTES'
  | 'EXECUTIVE_REPORT'
  | 'RECOMMENDATIONS'
  | 'DECISION'
  | 'ACTION_PLAN';

export type ExecutiveAiRequest = {
  type: ExecutiveAiRequestType;
  question: string;
  recipient?: string;
  subject?: string;
};

export type ExecutiveAiQueryPlan = {
  intent: ExecutiveAiIntent;
  queries: string[];
  preferredDocumentTypes: string[];
  requiresDocumentDiversity: boolean;
};

export type RankedExecutiveEvidence = KnowledgeSearchResult & {
  executiveScore: number;
  matchedSignals: string[];
};

export type ExecutiveSupportingReference = {
  reference: number;
  quote: string;
  relevance: string;
};

export type ExecutiveAiResponse = {
  version: typeof EXECUTIVE_AI_VERSION;
  status: 'ANSWERED' | 'INSUFFICIENT_EVIDENCE';
  requestType: ExecutiveAiRequestType;
  intent: ExecutiveAiIntent;
  answer: string;
  executiveRecommendation: string;
  sources: KnowledgeSourceReference[];
  supportingReferences: ExecutiveSupportingReference[];
  writing: {
    style: ExecutiveWritingStyle;
    audience: string;
    purpose: string;
    method: 'PROFESSIONAL_REWRITE';
  };
  evidence: {
    chunkCount: number;
    documentCount: number;
    combinedMultipleDocuments: boolean;
  };
  limitations: string[];
};

export interface ExecutiveAiRetrievalGateway {
  retrieve(query: string, user: IdentityUser, limit: number): Promise<KnowledgeSearchResult[]>;
}

export interface ExecutiveAiQueryPlanner {
  plan(request: ExecutiveAiRequest): ExecutiveAiQueryPlan;
}

export interface ExecutiveAiEvidenceRanker {
  rank(
    evidence: KnowledgeSearchResult[],
    plan: ExecutiveAiQueryPlan,
    limit: number,
  ): RankedExecutiveEvidence[];
}

export interface ExecutiveAiSynthesisProvider {
  synthesize(
    request: ExecutiveAiRequest,
    plan: ExecutiveAiQueryPlan,
    evidence: RankedExecutiveEvidence[],
  ): ExecutiveAiResponse;
}

export interface ExecutiveAiAuditSink {
  record(input: {
    user: IdentityUser;
    request: ExecutiveAiRequest;
    response: ExecutiveAiResponse;
    durationMs: number;
    context: RequestMeta;
  }): Promise<void>;
}
