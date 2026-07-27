import { createHash } from 'node:crypto';
import type { InstitutionalKnowledgeService } from '../knowledge/service.js';
import type { IdentityStore } from '../identity/store.js';
import type { IdentityUser, RequestMeta } from '../identity/types.js';
import { ArabicExecutiveQueryPlanner } from './planner.js';
import { DiverseExecutiveEvidenceRanker } from './ranker.js';
import { EvidenceBoundExecutiveSynthesisProvider } from './synthesis.js';
import type {
  ExecutiveAiAuditSink,
  ExecutiveAiEvidenceRanker,
  ExecutiveAiQueryPlanner,
  ExecutiveAiRequest,
  ExecutiveAiResponse,
  ExecutiveAiRetrievalGateway,
  ExecutiveAiSynthesisProvider,
} from './types.js';

export class Enterprise25KnowledgeGateway implements ExecutiveAiRetrievalGateway {
  constructor(private readonly knowledge: InstitutionalKnowledgeService) {}

  retrieve(query: string, user: IdentityUser, limit: number) {
    return this.knowledge.search(query, user, limit);
  }
}

export class IdentityAuditSink implements ExecutiveAiAuditSink {
  constructor(private readonly identityStore: IdentityStore) {}

  async record(input: {
    user: IdentityUser;
    request: ExecutiveAiRequest;
    response: ExecutiveAiResponse;
    durationMs: number;
    context: RequestMeta;
  }) {
    await this.identityStore.createAudit({
      userId: input.user.id,
      action: `EXECUTIVE_AI_${input.request.type}`,
      entityType: 'ExecutiveAiReasoning',
      description: 'Evidence-bound executive reasoning request completed.',
      metadata: {
        version: input.response.version,
        questionHash: createHash('sha256').update(input.request.question.trim()).digest('hex'),
        intent: input.response.intent,
        status: input.response.status,
        evidenceCount: input.response.evidence.chunkCount,
        documentCount: input.response.evidence.documentCount,
        durationMs: input.durationMs,
      },
      ...input.context,
    });
  }
}

export class ExecutiveAiReasoningService {
  constructor(
    private readonly retrieval: ExecutiveAiRetrievalGateway,
    private readonly audit: ExecutiveAiAuditSink,
    private readonly planner: ExecutiveAiQueryPlanner = new ArabicExecutiveQueryPlanner(),
    private readonly ranker: ExecutiveAiEvidenceRanker = new DiverseExecutiveEvidenceRanker(),
    private readonly synthesis: ExecutiveAiSynthesisProvider = new EvidenceBoundExecutiveSynthesisProvider(),
  ) {}

  async execute(
    request: ExecutiveAiRequest,
    user: IdentityUser,
    context: RequestMeta,
  ): Promise<ExecutiveAiResponse> {
    const startedAt = Date.now();
    const plan = this.planner.plan(request);
    const retrieved = (
      await Promise.all(plan.queries.map((query) => this.retrieval.retrieve(query, user, 12)))
    ).flat();
    const response = this.synthesis.synthesize(request, plan, this.ranker.rank(retrieved, plan, 8));
    await this.audit.record({
      user,
      request,
      response,
      durationMs: Date.now() - startedAt,
      context,
    });
    return response;
  }
}
