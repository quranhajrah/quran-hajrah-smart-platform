# Enterprise 26 — Executive AI Assistant

Version: `26.0.0`

## Purpose

Enterprise 26 turns the approved Enterprise 25 institutional retrieval service
into an Arabic-first executive assistant without changing that search engine.
It supports questions about the association's vision, mission, beneficiaries,
strategic objectives, and operational risks, plus sourced Board reports, CEO
recommendations, and formal-letter drafts.

## Architecture

```text
validated executive task
  → Arabic intent and subquery plan
  → Enterprise 25 search (unchanged)
  → evidence deduplication and executive reranking
  → multi-document diversity selection
  → evidence-bound Arabic synthesis
  → numbered sources and executive recommendation
  → privacy-preserving audit metadata
```

The `executive-ai` API module owns the planner, ranker, synthesizer, routes, and
audit adapter. `Enterprise25KnowledgeGateway` depends only on the public
`InstitutionalKnowledgeService.search` method. It therefore inherits the
existing document-confidentiality filter and source URLs without duplicating or
weakening retrieval authorization.

## Capability boundary

The shipped synthesizer is deterministic and local. It does not call an LLM,
paid AI, OCR, embedding API, or other external service. It combines and
structures retrieved evidence through transparent Arabic templates. Replaceable
interfaces exist for query planning, evidence ranking, retrieval, synthesis, and
audit, but activating an external provider requires a separate security,
privacy, procurement, and production review.

## Citation invariant

- An answered response contains at least one numbered source.
- Each evidence bullet and recommendation carries a `[n]` reference.
- Sources identify document, version, page, section, and a protected document
  URL where those fields are available.
- No retrieved evidence produces `INSUFFICIENT_EVIDENCE`, an empty source list,
  and no recommendation.
- A broad task discloses when evidence could not be combined from multiple
  documents.

## API

All endpoints are authenticated, permission protected, strictly validated, and
rate limited:

- `GET /api/executive-ai/capabilities`
- `POST /api/executive-ai/ask`
- `POST /api/executive-ai/board-report`
- `POST /api/executive-ai/recommendations`
- `POST /api/executive-ai/official-letter`

Question bodies accept at most 1,200 characters. Official-letter requests also
require a bounded recipient and subject. Unknown fields are rejected.

## Audit and privacy

The common `AuditLog` receives request type, engine version, intent, answer
status, evidence count, document count, duration, and a SHA-256 question hash.
It does not store the raw question, synthesized answer, evidence snippets,
authorization header, token, cookie, or document contents.

## RBAC

The permissions are:

- `executive_ai.use`
- `executive_ai.reports`
- `executive_ai.recommendations`
- `executive_ai.letters`
- `executive_ai.configure`
- `executive_ai.audit`

These permissions control assistant tasks only. Source confidentiality is
always enforced independently by Enterprise 25.

## Administration workspace

The Arabic RTL page is `/executive-assistant`. It offers permission-aware task
tabs, example institutional questions, letter recipient/subject fields,
evidence counts, the answer, executive recommendation, source links, and
limitations. It explicitly states that no external generative provider is
active.

## Operations and acceptance

No migration or environment variable is added. Run the normal seed so the new
permissions exist. Existing documents must already be indexed with:

```bash
npm run knowledge:index
```

Production acceptance requires healthy `/health` and `/ready`, an authorized
login, at least one correctly sourced result for every permitted task type,
an insufficient-evidence result with no invented answer, and verification that
a restricted account cannot retrieve confidential citations.
