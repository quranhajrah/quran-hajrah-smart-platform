# Enterprise 26.1 — Professional Executive Writing

Version: `26.1.0`

## Goal

Enterprise 26.1 transforms the Executive Assistant from document-shaped
synthesis into professional Arabic executive writing. It keeps the approved
Enterprise 25 retrieval gateway and Enterprise 24 extraction engine unchanged.

The writing pipeline is:

```text
authorized references
  → read source evidence
  → understand themes, quantitative anchors, and status
  → select audience and executive purpose
  → create original professional Arabic
  → verify that no source paragraph was copied into the answer
  → present supporting quotations separately
  → retain protected source links and audit metadata
```

## Writing profiles

- CEO brief: concise position, administrative meaning, and next action.
- Board of Directors: oversight summary, matters for consideration, and draft
  direction.
- Government correspondence: formal addressee, subject, clear institutional
  position, requested action, and official close.
- Donor proposal: need, evidence, expected effect, governance, sustainability,
  and partnership request.
- Meeting minutes: discussion summary, proposed decisions, accountable follow-up,
  and explicit placeholders for meeting facts not present in evidence.
- Executive report: overall position, priorities, risks, and decisions required.
- Recommendations: actionable recommendations with ownership and follow-up.
- Decision: reasoned draft resolution and implementation provisions.
- Action plan: work packages, responsibility assignment, timing control, and
  closure evidence.

## Original-writing invariant

The answer never inserts an evidence excerpt or document paragraph. The local
writer converts evidence into controlled semantic themes and retains only
supported quantitative anchors. A final guard compares the draft with source
paragraphs and replaces any direct match with a safe executive abstraction.

Verbatim evidence is allowed only in `supportingReferences`, which is separate
from `answer`. Each supporting quotation carries a numbered reference and a
short relevance statement. The existing `sources` collection remains the
protected link to document, version, page, and section.

## API modes

The authenticated and rate-limited API now exposes:

- `POST /api/executive-ai/ask`
- `POST /api/executive-ai/board-report`
- `POST /api/executive-ai/recommendations`
- `POST /api/executive-ai/official-letter`
- `POST /api/executive-ai/donor-proposal`
- `POST /api/executive-ai/meeting-minutes`
- `POST /api/executive-ai/executive-report`
- `POST /api/executive-ai/decision`
- `POST /api/executive-ai/action-plan`

Existing Executive AI permissions are reused. Report-style outputs require
`executive_ai.reports`; decisions and action plans require
`executive_ai.recommendations`; official correspondence continues to require
`executive_ai.letters`.

## Safety boundaries

- No answer, recommendation, decision, or action plan is returned without an
  authorized reference.
- Numbers, dates, responsible people, and commitments are not invented.
- Meeting attendance and dates remain explicit placeholders unless supplied by
  an approved source.
- Source confidentiality remains enforced by Enterprise 25 before evidence
  reaches the writer.
- No external model, new secret, schema migration, or production data mutation
  is introduced.
